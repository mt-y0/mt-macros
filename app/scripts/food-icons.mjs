// Builds the food icon set from open emoji databases, so nobody hand-draws food.
//   Foods: every "Food & Drink" emoji in unicode-emoji-json (+ a few from other groups, e.g. 🐟).
//   Artwork: Microsoft Fluent Emoji Flat SVGs (@iconify-json/fluent-emoji-flat, MIT).
//   Search words: emojilib + the emoji names + EXTRA below (gym foods, Iraqi dishes, Arabic).
// Usage: node scripts/food-icons.mjs  → public/food/<slug>.svg + src/food-icons.json
// (dev dependencies only — nothing is fetched at runtime)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// Not food: utensils and containers.
const SKIP = new Set(['🥢', '🍽️', '🍴', '🥄', '🔪', '🫙', '🏺', '🧂', '🧊'])

// Extra search words → emoji. These win over the database (first word in a meal name that matches decides).
const EXTRA = {
  '🍳': ['omelet', 'omelette', 'eggs', 'fried egg', 'بيض', 'عجة'],
  '🍗': ['chicken', 'chicken breast', 'دجاج', 'جاج'],
  '🍚': ['rice', 'رز', 'تمن', 'برياني', 'biryani'],
  '🥤': ['shake', 'protein shake', 'smoothie', 'mass gainer', 'gainer'],
  '🥛': ['milk', 'whey', 'حليب', 'لبن', 'yogurt', 'yoghurt', 'laban', 'زبادي'],
  '🥣': ['oats', 'oatmeal', 'porridge', 'cereal', 'granola', 'شوفان'],
  '🍲': ['stew', 'soup', 'مرق', 'شوربة', 'tashreeb', 'تشريب', 'dolma', 'دولمة', 'قيمة', 'margat', 'curry'],
  '🥩': ['beef', 'meat', 'steak', 'lamb', 'لحم', 'kebab', 'كباب', 'tikka', 'تكة'],
  '🐟': ['fish', 'masgouf', 'مسكوف', 'سمك', 'tuna', 'salmon'],
  '🍞': ['bread', 'toast', 'خبز', 'samoon', 'صمون'],
  '🫓': ['flatbread', 'pita', 'naan', 'tannour', 'تنور'],
  '🥙': ['shawarma', 'شاورما', 'wrap', 'falafel sandwich'],
  '🧆': ['falafel', 'فلافل'],
  '🍵': ['tea', 'chai', 'شاي', 'green tea'],
  '☕': ['coffee', 'قهوة', 'espresso', 'nescafe'],
  '🍌': ['banana', 'موز'],
  '🥜': ['peanut butter', 'peanuts', 'nuts', 'مكسرات', 'almonds'],
  '🧀': ['cheese', 'جبن', 'labneh', 'لبنة'],
  '🥗': ['salad', 'سلطة', 'tabbouleh', 'fattoush'],
  '🫘': ['beans', 'fasolia', 'فاصوليا', 'lentils', 'عدس', 'hummus', 'حمص', 'chickpeas', 'باقلاء'],
  '🍝': ['pasta', 'spaghetti', 'macaroni', 'معكرونة'],
  '🥔': ['potato', 'potatoes', 'بطاطا', 'بطاطة'],
  '🍯': ['honey', 'عسل', 'dibis', 'دبس'],
  '🥚': ['egg', 'boiled egg'],
  '🍔': ['burger', 'cheeseburger', 'برغر', 'همبركر'],
  '🍕': ['pizza', 'بيتزا'],
}

const byEmoji = require('unicode-emoji-json/data-by-emoji.json')
const emojilib = require('emojilib')
const fluent = require('@iconify-json/fluent-emoji-flat/icons.json')

const foods = Object.entries(byEmoji)
  .filter(([e, v]) => v.group === 'Food & Drink' && !SKIP.has(e))
  .map(([e, v]) => ({ emoji: e, name: v.name, slug: v.slug.replaceAll('_', '-') }))
for (const e of Object.keys(EXTRA))
  if (!foods.some((f) => f.emoji === e)) foods.push({ emoji: e, name: byEmoji[e].name, slug: byEmoji[e].slug.replaceAll('_', '-') })

const dir = new URL('../public/food/', import.meta.url).pathname
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
const kept = []
for (const f of foods) {
  const name = fluent.aliases?.[f.slug]?.parent ?? f.slug
  const icon = fluent.icons[name]
  if (!icon) {
    console.warn('no fluent artwork for', f.emoji, f.name)
    continue
  }
  const w = icon.width ?? fluent.width, h = icon.height ?? fluent.height
  writeFileSync(`${dir}${f.slug}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${icon.body}</svg>\n`)
  kept.push(f)
}

// Search words → icon index. Lower rank wins: EXTRA (0) < whole emoji name (1) < emojilib keywords (2) < single name words (3).
const best = {}
const add = (word, index, rank) => {
  const w = word.toLowerCase().replaceAll('_', ' ').trim()
  if (!w || (best[w] && best[w][1] <= rank)) return
  best[w] = [index, rank]
}
kept.forEach((f, i) => {
  for (const w of EXTRA[f.emoji] ?? []) add(w, i, 0)
  add(f.name, i, 1)
  for (const w of emojilib[f.emoji] ?? []) add(w, i, 2)
  for (const w of f.name.split(/\s+/)) add(w, i, 3)
})
const words = Object.fromEntries(Object.entries(best).map(([w, [i]]) => [w, i]).sort())

const index = (e) => kept.findIndex((f) => f.emoji === e)
const json = {
  // Fallback per meal slot when nothing in the name matches.
  slots: { breakfast: index('🍳'), lunch: index('🍛'), shake: index('🥤'), dynamic1: index('🍲'), dynamic2: index('🍲'), snack: index('🥜') },
  icons: kept.map((f) => f.slug),
  words,
}
writeFileSync(new URL('../src/food-icons.json', import.meta.url).pathname, JSON.stringify(json) + '\n')
console.log(`${kept.length} food icons, ${Object.keys(words).length} search words`)
