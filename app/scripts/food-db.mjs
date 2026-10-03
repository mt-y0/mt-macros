// Builds the offline food database shipped inside the app (public/foods.json) from USDA FoodData Central
// (public domain / CC0): SR Legacy (~7.8k raw & basic foods) + FNDDS survey foods (~5.4k foods "as eaten",
// incl. mixed dishes like hummus, falafel, kebab, rice dishes).
// Per food: kcal, protein, carbs, fat per 100 g + up to 4 household portions in grams ("1 large" = 50 g).
// Usage: node scripts/food-db.mjs   (downloads the CSV zips into .cache/usda/ once; needs `unzip`)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CACHE = new URL('../.cache/usda/', import.meta.url).pathname
const BASE = 'https://fdc.nal.usda.gov/fdc-datasets/'
const SETS = [
  { key: 'sr', zip: 'FoodData_Central_sr_legacy_food_csv_2018-04.zip' },
  { key: 'fndds', zip: 'FoodData_Central_survey_food_csv_2024-10-31.zip' },
]
// FDC nutrient ids. FNDDS files use the old SR nutrient numbers instead (208 kcal, 203 protein, 204 fat, 205 carbs).
const KCAL = '1008', PROTEIN = '1003', FAT = '1004', CARBS = '1005'
const NUTRIENT = { 1008: KCAL, 208: KCAL, 1003: PROTEIN, 203: PROTEIN, 1004: FAT, 204: FAT, 1005: CARBS, 205: CARBS }
// Skip baby food / infant formula / human milk.
const SKIP_NAME = /\b(babyfood|baby food|infant formula|milk, human|toddler)\b/i

/** Minimal RFC-4180 CSV reader (quoted fields, "" escapes). Calls fn(row) per data row as an object. */
function readCsv(file, fn) {
  const text = readFileSync(file, 'utf8')
  let header = null
  let row = []
  let field = ''
  let quoted = false
  const flush = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    flush()
    if (!header) header = row
    else if (row.length === header.length) fn(Object.fromEntries(header.map((h, i) => [h, row[i]])))
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') flush()
    else if (c === '\n') endRow()
    else if (c !== '\r') field += c
  }
  if (field || row.length) endRow()
}

function dirOf(set) {
  const zip = join(CACHE, set.zip)
  if (!existsSync(zip)) {
    mkdirSync(CACHE, { recursive: true })
    console.log('downloading', set.zip)
    // USDA rejects requests without a browser-like user agent.
    execFileSync('curl', ['-sSfL', '-A', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130', '-o', zip, BASE + set.zip])
  }
  const out = join(CACHE, set.key)
  if (!existsSync(out)) execFileSync('unzip', ['-oq', zip, '-d', out])
  // Zips contain one top-level folder.
  const inner = readdirSync(out).find((d) => !d.includes('.'))
  return inner ? join(out, inner) : out
}

const r1 = (n) => Math.round(n * 10) / 10
const foods = []

for (const [si, set] of SETS.entries()) {
  const dir = dirOf(set)
  const byId = new Map()
  readCsv(join(dir, 'food.csv'), (r) => {
    if (!SKIP_NAME.test(r.description)) byId.set(r.fdc_id, { name: r.description, n: {}, portions: [] })
  })
  readCsv(join(dir, 'food_nutrient.csv'), (r) => {
    const f = byId.get(r.fdc_id)
    const id = NUTRIENT[r.nutrient_id]
    if (f && id) f.n[id] = Number(r.amount)
  })
  readCsv(join(dir, 'food_portion.csv'), (r) => {
    const f = byId.get(r.fdc_id)
    const g = Number(r.gram_weight)
    if (!f || !(g > 0) || f.portions.length >= 4) return
    // SR Legacy: amount + modifier ("1" + "large"); FNDDS: portion_description ("1 cup").
    let label = (r.portion_description || `${r.amount || 1} ${r.modifier}`).trim()
    if (!label || /not specified|^\d+$/i.test(label)) return
    label = label.replace(/[;=]/g, ',').slice(0, 40)
    f.portions.push(`${label}=${r1(g)}`)
  })
  let kept = 0
  for (const f of byId.values()) {
    const kcal = f.n[KCAL]
    if (kcal === undefined || f.n[PROTEIN] === undefined) continue
    foods.push([f.name, si, Math.round(kcal), r1(f.n[PROTEIN]), r1(f.n[CARBS] ?? 0), r1(f.n[FAT] ?? 0), f.portions.join(';')])
    kept++
  }
  console.log(`${set.key}: ${kept} foods`)
}

foods.sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]))
const out = {
  source: 'USDA FoodData Central — SR Legacy (2018-04) + FNDDS (2024-10-31). Public domain (CC0).',
  fields: ['name', 'set (0=SR Legacy, 1=FNDDS)', 'kcal/100g', 'protein g/100g', 'carbs g/100g', 'fat g/100g', 'portions "label=grams;…"'],
  foods,
}
writeFileSync(new URL('../public/foods.json', import.meta.url).pathname, JSON.stringify(out))
console.log(`public/foods.json: ${foods.length} foods`)
