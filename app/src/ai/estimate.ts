// Deterministic half of the agent: rule-based parsing fallback + database lookup → grams and macros.
// No model, no React: safe to unit-test.
import type { Macros } from '../db'
import { expandQuery, loadFoods, macrosFor, pieceGrams, portionGrams, searchFoods, tokens, type Food } from '../foodDb'
import { gramsFor, sumMacros, type FoodUnit } from '../logic'

export type ParsedItem = { food: string; amount: number; unit: FoodUnit }

export type EstimateItem = ParsedItem & {
  grams: number
  /** how grams were worked out: unit given in g/ml, the food's USDA portion, or the generic unit table */
  how: 'given' | 'portion' | 'generic'
  foodId: number | null
  dbName: string | null
  macros: Macros
  /** other database matches the user can switch to */
  alternatives: { id: number; name: string }[]
}

export type Estimate = { items: EstimateItem[]; total: Macros }

// ── Rule-based fallback parser ("200g rice, 2 eggs and a bowl of soup") ──

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5, واحد: 1, اثنين: 2, ثلاث: 3, نص: 0.5 }
const UNIT_WORDS: Record<string, FoodUnit> = {
  g: 'g', gr: 'g', gram: 'g', grams: 'g', غرام: 'g', ml: 'ml', cup: 'cup', cups: 'cup', كوب: 'cup', glass: 'glass', قدح: 'glass',
  tbsp: 'tbsp', tablespoon: 'tbsp', spoon: 'tbsp', ملعقة: 'tbsp', tsp: 'tsp', teaspoon: 'tsp', slice: 'slice', slices: 'slice',
  bowl: 'bowl', bowls: 'bowl', صحن: 'plate', plate: 'plate', plates: 'plate', handful: 'handful', scoop: 'scoop', scoops: 'scoop',
  piece: 'piece', pieces: 'piece', حبة: 'piece', serving: 'serving',
}

export function looksLikeFood(msg: string) {
  return /\d|\b(ate|had|eat|eaten)\b|اكلت|أكلت/i.test(msg)
}

export function ruleParse(msg: string): ParsedItem[] {
  const parts = msg
    .replace(/\b(i|ate|had|have|just|for|breakfast|lunch|dinner|today)\b|اكلت|أكلت/gi, ' ')
    .split(/,|\+|&|\band\b|\bwith\b|\sو(?=\s|\p{Script=Arabic})/iu)
    .map((p) => p.trim())
    .filter(Boolean)
  const out: ParsedItem[] = []
  for (const p of parts) {
    const words = p.split(/\s+/)
    let amount = 1
    let unit: FoodUnit = 'serving'
    const rest: string[] = []
    for (const w of words) {
      const num = w.match(/^(\d+(?:\.\d+)?)([a-z]+)?$/i)
      if (num) {
        amount = Number(num[1])
        if (num[2] && UNIT_WORDS[num[2].toLowerCase()]) unit = UNIT_WORDS[num[2].toLowerCase()]
        else unit = 'piece'
      } else if (NUMBER_WORDS[w.toLowerCase()] !== undefined && rest.length === 0) {
        amount = NUMBER_WORDS[w.toLowerCase()]
        unit = 'piece'
      } else if (UNIT_WORDS[w.toLowerCase()]) unit = UNIT_WORDS[w.toLowerCase()]
      else if (w.toLowerCase() !== 'of') rest.push(w)
    }
    if (rest.length) out.push({ food: rest.join(' '), amount, unit })
  }
  return out.slice(0, 8)
}

/**
 * For each model item, if the rule parser found the same food in the user's own words with an explicit
 * amount or unit, use those (deterministic, straight from the text). Foods are compared after synonym
 * expansion, so "dolma" (model) matches "دولمة" (user).
 */
export function mergeAmounts(model: ParsedItem[], rules: ParsedItem[]): ParsedItem[] {
  const ruleKeys = rules.map((r) => ({ r, k: keyOf(r.food), explicit: r.unit !== 'serving' || r.amount !== 1 }))
  return model.map((m) => {
    const mk = keyOf(m.food)
    const hit = ruleKeys.find((x) => x.explicit && overlaps(mk, x.k))
    return hit ? { ...m, amount: hit.r.amount, unit: hit.r.unit } : m
  })
}

const overlaps = (a: Set<string>, b: Set<string>) => [...a].some((w) => b.has(w))
const keyOf = (f: string) => new Set(tokens(expandQuery(f)))

/**
 * Keeps the model honest: drops items that share no word with the user's message (tiny models copy their
 * examples), applies the user's own amounts (mergeAmounts), and adds foods the rule parser found that the
 * model missed.
 */
export function reconcile(model: ParsedItem[], rules: ParsedItem[], message: string): ParsedItem[] {
  const said = keyOf(message)
  const grounded = mergeAmounts(model.filter((m) => overlaps(keyOf(m.food), said)), rules)
  const missed = rules.filter((r) => !grounded.some((g) => overlaps(keyOf(g.food), keyOf(r.food))))
  return [...grounded, ...missed].slice(0, 8)
}

// ── Database lookup (deterministic) ──

export async function estimate(items: ParsedItem[]): Promise<Estimate> {
  const foods = await loadFoods()
  return build(items.map((it) => ({ it, matches: searchFoods(foods, it.food, 6) })))
}

/** Rebuild one item after the user changes grams or picks another database food. */
export async function rebuildItem(item: EstimateItem, change: { grams?: number; foodId?: number }): Promise<EstimateItem> {
  const foods = await loadFoods()
  const food = change.foodId !== undefined ? foods[change.foodId] : item.foodId !== null ? foods[item.foodId] : null
  if (!food) return item
  const grams = change.grams ?? (change.foodId !== undefined ? gramsOf(item, food).grams : item.grams)
  const how = change.grams !== undefined ? 'given' : change.foodId !== undefined ? gramsOf(item, food).how : item.how
  return { ...item, grams, how, foodId: food.id, dbName: food.name, macros: macrosFor(food, grams) }
}

function gramsOf(it: ParsedItem, food: Food | null) {
  return gramsFor(it.amount, it.unit, food && { portion: (u) => portionGrams(food, u), piece: () => pieceGrams(food) })
}

function build(rows: { it: ParsedItem; matches: Food[] }[]): Estimate {
  const items = rows.map(({ it, matches }) => {
    const food = matches[0] ?? null
    const { grams, how } = gramsOf(it, food)
    return {
      ...it,
      grams,
      how,
      foodId: food?.id ?? null,
      dbName: food?.name ?? null,
      macros: food ? macrosFor(food, grams) : { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      alternatives: matches.map((f) => ({ id: f.id, name: f.name })),
    }
  })
  return { items, total: totalOf(items) }
}

export function totalOf(items: EstimateItem[]): Macros {
  const t = sumMacros(items.map((i) => i.macros))
  return { kcal: Math.round(t.kcal), protein: Math.round(t.protein), carbs: Math.round(t.carbs), fat: Math.round(t.fat) }
}
