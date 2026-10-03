// The bundled offline food database (public/foods.json, built by scripts/food-db.mjs from USDA FoodData Central).
// Pure search + lookup; the only I/O is fetching the bundled JSON once (precached by the service worker).
import type { Macros } from './db'

export type Portion = { label: string; g: number }
export type Food = {
  id: number
  name: string
  /** 0 = SR Legacy (ingredients), 1 = FNDDS (foods as eaten) */
  set: 0 | 1
  /** per 100 g */
  per100: Macros
  portions: Portion[]
  words: string[]
}

type Row = [string, 0 | 1, number, number, number, number, string]

let cache: Promise<Food[]> | null = null

export function loadFoods(): Promise<Food[]> {
  cache ??= fetch('/foods.json')
    .then((r) => r.json() as Promise<{ foods: Row[] }>)
    .then(({ foods }) =>
      foods.map(([name, set, kcal, protein, carbs, fat, portions], id) => ({
        id,
        name,
        set,
        per100: { kcal, protein, carbs, fat },
        portions: portions
          ? portions.split(';').map((p) => {
              const [label, g] = p.split('=')
              return { label, g: Number(g) }
            })
          : [],
        words: tokens(name),
      })),
    )
  return cache
}

// Arabic / Iraqi names and common shorthand → words the USDA names use. Applied before searching.
export const SYNONYMS: Record<string, string> = {
  // Arabic
  رز: 'rice white cooked', تمن: 'rice white cooked', دجاج: 'chicken', جاج: 'chicken', لحم: 'beef', بيض: 'egg',
  خبز: 'bread pita', صمون: 'bread white', حليب: 'milk', لبن: 'yogurt plain', زبادي: 'yogurt plain', جبن: 'cheese',
  سمك: 'fish', شاي: 'tea', قهوة: 'coffee', موز: 'banana', تمر: 'dates', عدس: 'lentils', حمص: 'hummus',
  فلافل: 'falafel', شوربة: 'soup', مرق: 'stew', بطاطا: 'potato', بطاطة: 'potato', فاصوليا: 'beans',
  باقلاء: 'fava beans', دولمة: 'stuffed grape leaves', كباب: 'kabob', تكة: 'kabob', شاورما: 'gyro',
  برغل: 'bulgur', عسل: 'honey', زيت: 'oil olive', زبدة: 'butter', شوفان: 'oats', تفاح: 'apple', برتقال: 'orange',
  طماطة: 'tomato', خيار: 'cucumber', بصل: 'onion', باذنجان: 'eggplant', كبة: 'meatball',
  // Iraqi / Levantine dishes in English letters
  dolma: 'stuffed grape leaves', kebab: 'kabob', kebap: 'kabob', tikka: 'kabob', shawarma: 'gyro',
  timman: 'rice white cooked', tashreeb: 'stew', margat: 'stew', masgouf: 'fish', samoon: 'bread white',
  laban: 'yogurt plain', kubba: 'meatball', kibbe: 'meatball', kibbeh: 'meatball', fasolia: 'beans', bamia: 'okra',
  // Shorthand
  oats: 'oats', oatmeal: 'oatmeal', pb: 'peanut butter', whey: 'protein powder whey',
}

// Plain everyday meaning of a bare word → the exact USDA row to rank first (still database numbers).
// Keys are singular tokens joined by spaces, as produced by tokens(expandQuery(q)).
export const DEFAULTS: Record<string, string> = {
  rice: 'Rice, white, cooked, NS as to fat', 'rice white cooked': 'Rice, white, cooked, NS as to fat',
  egg: 'Egg, whole, boiled or poached', 'boiled egg': 'Egg, whole, boiled or poached', 'fried egg': 'Egg, whole, cooked, fried',
  omelet: 'Egg, whole, cooked, omelet', omelette: 'Egg, whole, cooked, omelet',
  chicken: 'Chicken breast, NS as to cooking method, skin not eaten', 'chicken breast': 'Chicken breast, NS as to cooking method, skin not eaten',
  bread: 'Bread, pita', 'bread pita': 'Bread, pita', 'bread white': 'Bread, white', toast: 'Bread, white, toasted',
  banana: 'Banana, raw', apple: 'Apple, raw', orange: 'Orange, raw', tomato: 'Tomatoes, raw', date: 'Date',
  tea: 'Tea, hot, leaf, black', coffee: 'Coffee, brewed', milk: 'Milk, whole', beef: 'Beef, steak, NFS',
  fish: 'Fish, NS as to type, baked or broiled', potato: 'Potato, boiled, NFS', oat: 'Oats, raw', oatmeal: 'Oatmeal, NFS',
  cheese: 'Cheese, NFS', 'yogurt plain': 'Yogurt, plain, whole milk', yogurt: 'Yogurt, plain, whole milk',
  pasta: 'Pasta, cooked', lentil: 'Lentils, NFS', bean: 'Beans, NFS', chickpea: 'Chickpeas, NFS', butter: 'Butter, NFS',
  meatball: 'Meatballs, NS as to type of meat, with sauce', honey: 'Honey', soup: 'Soup, vegetable', bulgur: 'Bulgur, cooked', okra: 'Okra, NS as to form, cooked',
  'protein powder whey': 'Beverages, Protein powder whey based', 'protein powder': 'Beverages, Protein powder whey based',
  'oil olive': 'Olive oil', 'olive oil': 'Olive oil', hummus: 'Hummus, plain',
}

// Ignored in queries and names.
const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'or', 'in', 'on', 'my', 'some', 'nfs', 'ns', 'to', 'for', 'from'])
// Processing words that make a match less likely to be what someone means — unless they said it.
const ODD = ['raw', 'dry', 'dried', 'uncooked', 'dehydrated', 'powder', 'frozen', 'canned', 'flour', 'unprepared', 'concentrate', 'restaurant', 'fast', 'babyfood']

export function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => !STOP.has(w)).map(singular)
}

function singular(w: string) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && /(ches|shes|oes)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

/** Query text with synonyms expanded (Arabic → English USDA wording). */
export function expandQuery(q: string): string {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => SYNONYMS[w] ?? SYNONYMS[arabicBase(w)] ?? w)
    .join(' ')
}

/** Strips the Arabic prefixes glued to words: و "and", ال "the" (والرز → رز). */
function arabicBase(w: string): string {
  return w.replace(/^و(?=\p{Script=Arabic}{2})/u, '').replace(/^ال(?=\p{Script=Arabic}{2})/u, '')
}

/** Ranked search. Every query word must appear in the name; the head of the name (before the first comma) counts most. */
export function searchFoods(foods: Food[], query: string, limit = 8): Food[] {
  const q = tokens(expandQuery(query))
  if (!q.length) return []
  const scored: [number, Food][] = []
  for (const f of foods) {
    let s = 0
    let ok = true
    const head = tokens(f.name.split(',')[0])
    for (const w of q) {
      const i = f.words.indexOf(w)
      if (i < 0) {
        ok = false
        break
      }
      s += head.includes(w) ? 10 : 4
      s -= i * 0.3 // earlier is better
    }
    if (!ok) continue
    s -= (f.words.length - q.length) * 0.8 // fewer extra words = more generic
    if (head.length === q.length && head.every((w) => q.includes(w))) s += 6 // "Hummus, plain" for "hummus"
    for (const o of ODD) if (f.words.includes(o) && !q.includes(o)) s -= 6
    if (f.set === 1) s += 1.5 // "as eaten" beats raw ingredient
    scored.push([s, f])
  }
  const preferred = DEFAULTS[q.join(' ')]
  return scored
    .sort((a, b) => (b[1].name === preferred ? 1 : 0) - (a[1].name === preferred ? 1 : 0) || b[0] - a[0])
    .slice(0, limit)
    .map(([, f]) => f)
}

export function macrosFor(f: Food, grams: number): Macros {
  const k = grams / 100
  return {
    kcal: Math.round(f.per100.kcal * k),
    protein: Math.round(f.per100.protein * k * 10) / 10,
    carbs: Math.round(f.per100.carbs * k * 10) / 10,
    fat: Math.round(f.per100.fat * k * 10) / 10,
  }
}

/** A food's portion whose label mentions `unit` ("cup", "slice", "large"…), grams for 1 of it. */
export function portionGrams(f: Food, unit: string): number | null {
  const u = singular(unit.toLowerCase())
  for (const p of f.portions) {
    const m = p.label.match(/^([\d.]+)\s*(.*)$/)
    const amount = m ? Number(m[1]) || 1 : 1
    const rest = (m ? m[2] : p.label).toLowerCase()
    if (tokens(rest).includes(u)) return p.g / amount
  }
  return null
}

/**
 * Grams of one "piece" (egg, banana, pita…), never a cup/spoon/weight. Prefers a portion named after the food
 * ("1 banana", "1 large pita"), then by size: medium/regular > large > other > small/extra.
 */
export function pieceGrams(f: Food): number | null {
  const named = new Set(f.words)
  let best: [number, number] | null = null // [rank, grams]
  for (const p of f.portions) {
    if (/\b(cup|tbsp|tablespoon|tsp|teaspoon|oz|fl|lb|ml|g|gram|inch|slice|cubic|quantity|package)\b/i.test(p.label)) continue
    const amount = Number(p.label.match(/^([\d.]+)/)?.[1]) || 1
    const words = tokens(p.label)
    const size = words.some((w) => w === 'medium' || w === 'regular') ? 0 : words.includes('large') && !words.includes('extra') ? 0.5 : words.some((w) => w === 'small' || w === 'extra' || w === 'jumbo') ? 1 : 0.8
    const rank = (words.some((w) => named.has(w)) || words.some((w) => ['piece', 'whole', 'patty', 'item'].includes(w)) ? 0 : 2) + size
    if (!best || rank < best[0]) best = [rank, p.g / amount]
  }
  return best ? best[1] : null
}
