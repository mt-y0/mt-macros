# Rules & calculations

All in `app/src/logic.ts` (pure functions, no I/O), except where noted. Source of every rule: [`../blueprint.md`](../blueprint.md) §2–3.

## Food

| Rule | Code | Detail |
|---|---|---|
| Daily totals | `sumMacros(meals)` | Sum of kcal/protein/carbs/fat of the day's logs |
| Portion scaling | `scaleMacros(m, s)` | Multiplies and rounds to whole numbers |
| Minimum viable day | `MIN_VIABLE` | **2,200 kcal and 90 g protein**; Food tab warns when below (only once something is logged) |

## AI food estimates

The model never produces numbers ([ai.md](ai.md)). From its `{food, amount, unit}` items:

| Rule | Code | Detail |
|---|---|---|
| Units the model may use | `FOOD_UNITS` | g, ml, piece, cup, tbsp, tsp, slice, bowl, plate, handful, glass, scoop, serving |
| Grams | `gramsFor(amount, unit, food)` | 1) `g`/`ml` → as given (ml ≈ g). 2) cup/tbsp/tsp/slice/scoop → the food's own USDA portion; `piece` **and** an unspecified `serving` → the food's piece portion if it has one (`pieceGrams`: named after the food, medium/regular > large > other > small — e.g. 1 large egg 50 g, 1 banana 126 g, 1 large pita 85 g). 3) else `UNIT_GRAMS`: piece 100, cup 240, tbsp 15, tsp 5, slice 30, bowl 300, plate 350, handful 30, glass 250, scoop 30, serving 150. Amount ≤ 0 or missing → 1. |
| Macros | `macrosFor(food, g)` (`foodDb.ts`) | per-100 g × g/100; kcal whole, macros 1 decimal; card totals rounded to whole numbers |
| Confidence of the log | `Chat.tsx` | `medium` if every item matched the database and none used a generic `UNIT_GRAMS` portion; else `low`. Unmatched items are excluded from the total. |
| Food matching | `searchFoods()` | see [food-database.md](food-database.md#search-appsrcfooddbts) |

The same `searchFoods` / `macrosFor` power the **ingredient builder** on the Meals tab (sum of ingredient rows → "Use these numbers").

## Weight & calorie adjustment (feature F)

- `weightAvg7(weights, date)` — mean of weigh-ins in the 7 days ending on `date`; returns `null` if **fewer than 3** weigh-ins.
- `calorieAdvice(weights, today)` compares the 7-day averages at today, −7 d and −14 d:
  - this-week change **> 0.6 kg** → **−200 kcal**
  - this week **and** last week **< 0.15 kg** → **+250 kcal**
  - otherwise keep target; not enough data → explain what's needed
- "Apply" on the Weight tab (`pages/Weight.tsx`) changes `targets.kcal` by the delta and moves the difference into **carbs** (`delta / 4` g); protein and fat stay fixed.

## Sleep (feature E)

- `sleepMinutes({bedtime, wake})` — wraps past midnight.
- `sleepStreak(sleeps)` — consecutive days (ending at the latest log, no gaps) with **7–9 h**.
- Bedtime spread (in `pages/Sleep.tsx`) — standard deviation of bedtimes over the last 7 nights (≥ 3 nights), with times before noon shifted +24 h so 23:30 and 00:30 are 60 min apart. Target < 30–45 min.
- Caffeine warning when last caffeine is **< 8 h** before bedtime.

## Recovery advice (feature G)

`RECOVERY` maps `missed-meal | low-day | missed-gym | sick` to fixed text from blueprint §2. Rules-only; a future LLM may only re-word, never change the numbers.

## Day score & calendar (Days tab)

`dayScore({meals, sleep, check}, targets)` gives each day a score **out of 10** (one decimal; the calendar cell shows it rounded). Inputs are that day's meals, the sleep log whose wake date is that day, and that day's `dayChecks` row. Uses the **current** targets for every day (old targets aren't stored).

| Part (`SCORE_MAX`) | Points | Rule |
|---|---|---|
| Food | 4 | 2 × min(1, kcal / target) + 2 × min(1, protein / target). Eating over target is not penalised (bulk). |
| Water | 2 | 2 × min(1, litres / water target) |
| Sleep | 3 | Duration 2 points for 7–9 h, minus 1 per hour outside that range (floor 0) + quality (1–5) → 0–1 as (q − 1) / 4 |
| Creatine | 1 | Ticked → 1 |

- A part with nothing logged scores 0. A day with **nothing** logged (no meals, no water, no sleep, no creatine) has **no score** (`null`), shown as an empty dashed cell — not a 0.
- A part is **good** when it earns ≥ 75 % of its points (e.g. food ≥ 3/4). Calendar dots: filled = good, ring = logged but not good, faint = not logged.
- Cell colour tiers (`tier()` in `pages/Calendar.tsx`): < 4, 4–6.4, 6.5–8.4, ≥ 8.5.
- `weekStart(iso)` — the Monday of that week; weeks run **Mon–Sun**.
- Period report (week or month): average score and best day over scored days; days logged / days elapsed; good-day counts per part; average kcal and protein per day with food logged; average sleep over logged nights; weight change = last − first weigh-in in the period (needs 2); creatine days.

## Tested behaviour

Checked with a scratch script (bun): +0.1 kg/wk for 3 weeks → +250; +0.8 kg/wk → −200; +0.3 kg/wk → 0; no data → 0; perfect day (target food, 3 L, 8 h quality 5, creatine) → 10; half food/water, 6 h quality 3, no creatine → 4.5; empty day → `null`; `weekStart` of Sat 2026-10-03 → Mon 2026-09-28; 23:30→07:15 = 465 min; streak stops at a night outside 7–9 h. There is no test runner in the repo yet — adding Vitest for `logic.ts` is on the [roadmap](roadmap.md).
