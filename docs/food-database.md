# Food database

The app ships an offline food database: **`app/public/foods.json`** (≈1.4 MB, ≈360 KB gzipped, precached by the service worker). It powers Byte's estimates ([ai.md](ai.md)) and the ingredient builder on the Meals tab.

## Source

**USDA FoodData Central** — public domain (CC0), free, no key needed:

| Dataset | Foods kept | What it's good for |
|---|---|---|
| SR Legacy (2018-04) | ≈7,450 | Raw/basic ingredients with household portions ("1 large egg = 50 g") |
| FNDDS survey foods (2024-10-31) | ≈5,280 | Foods **as eaten**, incl. mixed dishes: hummus, falafel, biryani, stuffed grape leaves, kabobs, soups |

Dropped: baby food, infant formula, human milk, rows without kcal or protein.

Other free databases considered: Open Food Facts (huge, mostly branded packaged products, ODbL — poor fit for home cooking) and the Foundation Foods subset (too few foods).

## Build (`app/scripts/food-db.mjs`)

```sh
cd app && node scripts/food-db.mjs   # downloads the CSV zips once into app/.cache/usda/ (git-ignored), needs curl + unzip
```

- Nutrients: energy kcal (`1008`, FNDDS uses old number `208`), protein (`1003`/`203`), fat (`1004`/`204`), carbs by difference (`1005`/`205`) — **per 100 g**.
- Portions: up to 4 per food from `food_portion.csv` (SR: amount + modifier; FNDDS: description), grams each; "Quantity not specified" dropped.
- Sorted by name length so generic names come first.

## Format

```json
{ "source": "...", "fields": [...],
  "foods": [["Egg, whole, raw, fresh", 0, 143, 12.6, 0.7, 9.5, "1 large=50;1 extra large=56;..."], ...] }
```

Row = `[name, set (0 SR Legacy / 1 FNDDS), kcal, protein g, carbs g, fat g, "portion=grams;…"]`, all per 100 g. The row index is the food's `id` in the app (stable only for one build — logs store names and numbers, never ids).

## Search (`app/src/foodDb.ts`)

1. `expandQuery()` replaces words from `SYNONYMS` — Arabic (تمن, دجاج, بيض, لبن, دولمة…) and Iraqi dish names in English letters (dolma, timman, kubba, tashreeb…) → USDA wording.
2. `tokens()` lower-cases, drops stop words (a, of, with, NFS…), singularises.
3. Every query word must be in the name. Score: word in the name's head (before the first comma) +10, elsewhere +4; earlier is better; −0.8 per extra word (generic beats specific); +6 if the head is exactly the query ("Hummus, plain"); −6 for processing words the user didn't say (raw, dry, powder, frozen, canned, flour…); +1.5 for FNDDS (as eaten).
4. `DEFAULTS` pins the everyday meaning of bare words to one exact row (rice → *Rice, white, cooked, NS as to fat*; egg → *Egg, whole, boiled or poached*; chicken → *Chicken breast, NS as to cooking method, skin not eaten*; bread → *Bread, pita*; tea → *Tea, hot, leaf, black*…). Still database numbers — just a chosen row.

Portion helpers: `portionGrams(food, unit)` (grams of one "cup"/"tbsp"/"slice"… from the food's portions) and `pieceGrams(food)` (one piece: a portion named after the food — "1 banana" — else medium/large/regular/piece, never cup/spoon/weight).

## Adding foods or words

- Missing dish that USDA has under another name → add to `SYNONYMS`.
- Bare word picks a silly row → add to `DEFAULTS` (exact USDA name; the build of `foods.json` must contain it).
- Updating USDA data → change the zip names in `SETS`, rerun the script, commit `public/foods.json`.
