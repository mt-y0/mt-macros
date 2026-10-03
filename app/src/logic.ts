import type { DayCheck, Macros, MealLog, SleepLog, Targets, WeightLog } from './db'

export const MIN_VIABLE = { kcal: 2200, protein: 90 }

const MACRO_NAME: Record<keyof Macros, string> = { kcal: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' }

/** Upper sanity limits for one meal / recipe version (a 3,000 kcal single meal is already extreme). */
export const MEAL_MAX: Macros = { kcal: 3000, protein: 250, carbs: 500, fat: 250 }

/** Returns a user-facing error, or null when every value is a finite number within [0, max]. */
export function macroError(m: Macros, max: Macros = MEAL_MAX): string | null {
  for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) {
    const v = m[k]
    if (!Number.isFinite(v)) return `Enter ${MACRO_NAME[k].toLowerCase()}.`
    if (v < 0) return `${MACRO_NAME[k]} can't be negative.`
    if (v > max[k]) return `${MACRO_NAME[k]} looks too high (max ${max[k].toLocaleString()}).`
  }
  return null
}

export function targetsError(t: Macros & { waterL: number; creatineG: number }): string | null {
  if (!Number.isFinite(t.kcal) || t.kcal < 1200 || t.kcal > 6000) return 'Daily calories must be between 1,200 and 6,000.'
  const e = macroError(t, { kcal: 6000, protein: 400, carbs: 1000, fat: 400 })
  if (e) return e
  if (!Number.isFinite(t.waterL) || t.waterL < 0 || t.waterL > 10) return 'Water must be between 0 and 10 L.'
  if (!Number.isFinite(t.creatineG) || t.creatineG < 0 || t.creatineG > 20) return 'Creatine must be between 0 and 20 g.'
  return null
}

export const WEIGHT_RANGE = [20, 300] as const

/** After a calorie change, wait this long before the trend rule may suggest another one. */
export const ADJUST_COOLDOWN_DAYS = 14

export function todayISO(d = new Date()) {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

export function sumMacros(meals: Pick<MealLog, keyof Macros>[]): Macros {
  return meals.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function scaleMacros(m: Macros, s: number): Macros {
  return {
    kcal: Math.round(m.kcal * s),
    protein: Math.round(m.protein * s),
    carbs: Math.round(m.carbs * s),
    fat: Math.round(m.fat * s),
  }
}

/** Average of all weigh-ins in the 7 days ending on `date` (inclusive). */
export function weightAvg7(weights: WeightLog[], date: string): number | null {
  const from = addDays(date, -6)
  const w = weights.filter((x) => x.date >= from && x.date <= date)
  if (w.length < 3) return null
  return w.reduce((a, x) => a + x.kg, 0) / w.length
}

export type CalorieAdvice = { delta: number; text: string; weeklyRates: (number | null)[] }

/**
 * Blueprint §2 rule: 7-day avg rising < 0.15 kg/wk for 2 weeks → +250 kcal;
 * rising > 0.6 kg/wk → −200 kcal.
 */
export function calorieAdvice(weights: WeightLog[], today: string): CalorieAdvice {
  const a0 = weightAvg7(weights, today)
  const a1 = weightAvg7(weights, addDays(today, -7))
  const a2 = weightAvg7(weights, addDays(today, -14))
  const r1 = a0 != null && a1 != null ? a0 - a1 : null
  const r2 = a1 != null && a2 != null ? a1 - a2 : null
  const weeklyRates = [r1, r2]
  if (r1 == null) return { delta: 0, text: 'Need at least ~2 weeks of weigh-ins (3+ per week) to judge the trend.', weeklyRates }
  if (r1 > 0.6) return { delta: -200, text: `Gaining ${r1.toFixed(2)} kg/week (> 0.6). Remove about 200 kcal/day.`, weeklyRates }
  if (r2 != null && r1 < 0.15 && r2 < 0.15)
    return { delta: 250, text: `Gaining < 0.15 kg/week for 2 weeks. Add about 250 kcal/day.`, weeklyRates }
  return { delta: 0, text: `Gaining ${r1.toFixed(2)} kg/week — on track, keep the current target.`, weeklyRates }
}

export function sleepMinutes(s: Pick<SleepLog, 'bedtime' | 'wake'>) {
  const [bh, bm] = s.bedtime.split(':').map(Number)
  const [wh, wm] = s.wake.split(':').map(Number)
  let mins = wh * 60 + wm - (bh * 60 + bm)
  if (mins <= 0) mins += 24 * 60
  return mins
}

export function fmtHM(mins: number) {
  return `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`
}

/** Consecutive nights (ending at the latest log) with 7–9 h of sleep. */
export function sleepStreak(sleeps: SleepLog[]) {
  const sorted = [...sleeps].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  let expected = sorted[0]?.date
  for (const s of sorted) {
    if (s.date !== expected) break
    const m = sleepMinutes(s)
    if (m < 7 * 60 || m > 9 * 60) break
    streak++
    expected = addDays(s.date, -1)
  }
  return streak
}

// ── Day score (Calendar tab): how well a day went, out of 10 ──

export type ScoreKey = 'food' | 'drink' | 'sleep' | 'creatine'

/** Points per part; they add up to 10. */
export const SCORE_MAX: Record<ScoreKey, number> = { food: 4, drink: 2, sleep: 3, creatine: 1 }

export const SCORE_LABEL: Record<ScoreKey, string> = { food: 'Food', drink: 'Water', sleep: 'Sleep', creatine: 'Creatine' }

export type ScorePart = { key: ScoreKey; points: number; max: number; logged: boolean; good: boolean }
export type DayScore = { total: number; parts: ScorePart[] }

const ratio = (v: number, target: number) => (target > 0 ? Math.min(1, Math.max(0, v / target)) : 1)

/**
 * Food 4 = 2 × kcal/target + 2 × protein/target (capped, no penalty for eating over on a bulk).
 * Water 2 = 2 × litres/target. Sleep 3 = 2 for 7–9 h (minus 1 per hour outside, floor 0) + 1 × (quality − 1)/4.
 * Creatine 1 = taken. A part with nothing logged scores 0; a day with nothing logged at all has no score (null).
 * "Good" = at least 75 % of that part's points.
 */
export function dayScore(
  day: { meals: Pick<MealLog, keyof Macros>[]; sleep?: Pick<SleepLog, 'bedtime' | 'wake' | 'quality'>; check?: Pick<DayCheck, 'creatine' | 'waterL'> },
  targets: Targets,
): DayScore | null {
  const food = sumMacros(day.meals)
  const water = day.check?.waterL ?? 0
  const creatine = day.check?.creatine ?? false
  const logged: Record<ScoreKey, boolean> = { food: day.meals.length > 0, drink: water > 0, sleep: !!day.sleep, creatine }
  if (!Object.values(logged).some(Boolean)) return null

  let sleep = 0
  if (day.sleep) {
    const h = sleepMinutes(day.sleep) / 60
    const off = h < 7 ? 7 - h : h > 9 ? h - 9 : 0
    sleep = Math.max(0, 2 - off) + ratio(day.sleep.quality - 1, 4)
  }
  const points: Record<ScoreKey, number> = {
    food: logged.food ? 2 * ratio(food.kcal, targets.kcal) + 2 * ratio(food.protein, targets.protein) : 0,
    drink: 2 * ratio(water, targets.waterL),
    sleep,
    creatine: creatine ? 1 : 0,
  }
  const parts = (Object.keys(SCORE_MAX) as ScoreKey[]).map((key) => ({
    key,
    points: Math.round(points[key] * 10) / 10,
    max: SCORE_MAX[key],
    logged: logged[key],
    good: points[key] >= 0.75 * SCORE_MAX[key],
  }))
  return { total: Math.round(parts.reduce((a, p) => a + p.points, 0) * 10) / 10, parts }
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string) {
  const dow = (new Date(iso + 'T12:00:00').getDay() + 6) % 7 // Mon = 0
  return addDays(iso, -dow)
}

export type FailureKind = 'missed-meal' | 'low-day' | 'missed-gym' | 'sick'

export const RECOVERY: Record<FailureKind, { title: string; advice: string }> = {
  'missed-meal': {
    title: 'Missed a meal',
    advice:
      "Don't make it up in one sitting. Add a drink (milk + oats + banana + peanut butter, ~500 kcal) or make the next meal ~20% bigger.",
  },
  'low-day': {
    title: 'Low day (< 2,200 kcal)',
    advice:
      'Log it and move on. Minimum viable day is 2,200 kcal and 90 g protein. Resume normally tomorrow — the weekly average matters, not one day.',
  },
  'missed-gym': {
    title: 'Missed gym',
    advice: 'Shift the session to the next free day, never double up. Missed 2+ sessions this week: keep only the main lifts.',
  },
  sick: {
    title: 'Sick or travelling',
    advice: 'Keep protein and creatine. Ignore the calorie target until you are back to normal.',
  },
}

// ── AI food logging: amount + unit → grams (deterministic; the model only names foods and amounts) ──

export const FOOD_UNITS = ['g', 'ml', 'piece', 'cup', 'tbsp', 'tsp', 'slice', 'bowl', 'plate', 'handful', 'glass', 'scoop', 'serving'] as const
export type FoodUnit = (typeof FOOD_UNITS)[number]

/** Generic grams per unit, used when the food has no matching USDA household portion. */
export const UNIT_GRAMS: Record<FoodUnit, number> = {
  g: 1,
  ml: 1, // ≈ water density; fine for drinks, soups, milk
  piece: 100,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  slice: 30,
  bowl: 300,
  plate: 350,
  handful: 30,
  glass: 250,
  scoop: 30,
  serving: 150,
}

/** Portion units the USDA data names per food ("1 cup" = 158 g of rice) — preferred over UNIT_GRAMS. */
const FOOD_PORTION_UNITS: FoodUnit[] = ['cup', 'tbsp', 'tsp', 'slice', 'scoop']

/**
 * Grams for `amount` × `unit` of a food. Order: weight/volume units as given → the food's own USDA portion
 * (cup/slice/spoon, or a "piece" like "1 large egg") → generic UNIT_GRAMS. Returns how it was worked out.
 */
export function gramsFor(
  amount: number,
  unit: FoodUnit,
  food: { portion: (unit: string) => number | null; piece: () => number | null } | null,
): { grams: number; how: 'given' | 'portion' | 'generic' } {
  const n = Number.isFinite(amount) && amount > 0 ? amount : 1
  if (unit === 'g' || unit === 'ml') return { grams: Math.round(n), how: 'given' }
  // An unspecified "serving" of a countable food (bread, banana, falafel) means one piece of it.
  const own = !food ? null : unit === 'piece' || unit === 'serving' ? food.piece() : FOOD_PORTION_UNITS.includes(unit) ? food.portion(unit) : null
  if (own) return { grams: Math.round(n * own), how: 'portion' }
  return { grams: Math.round(n * UNIT_GRAMS[unit]), how: 'generic' }
}
