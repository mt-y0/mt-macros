# Data model

Defined in `app/src/db.ts`. Database name: **`mt-macro`**, Dexie schema **version 1**.

## Tables

| Table | Primary key | Indexes | Purpose |
|---|---|---|---|
| `recipes` | `++id` | `slot`, `name` | A reusable meal template ("Night shake"). Points to its default version via `currentVersionId`. `archived` hides it. |
| `recipeVersions` | `++id` | `recipeId`, `[recipeId+version]` | **Immutable** snapshot of a recipe's macros + ingredient text. |
| `meals` | `++id` | `date`, `slot` | One logged meal on a day. Stores **already-scaled** macros + `scale` + `confidence`. |
| `weights` | `++id` | `&date` (unique) | One weigh-in per day (saving the same date updates it). |
| `sleeps` | `++id` | `&date` (unique) | One night, keyed by the **wake-up date**. |
| `dayChecks` | `date` | — | Per-day habits: `creatine`, `waterL`. |
| `settings` | `key` | — | Key/value. Currently only `targets` (see `Targets` type). |

Dates are local `YYYY-MM-DD` strings (`todayISO()` in `logic.ts`); times are `HH:MM`.

## Meal slots

`breakfast | lunch | shake | dynamic1 | dynamic2 | snack` — `dynamic1/2` are "mom's meals". Each slot has a fallback pixel food icon (`slots` in `src/food-icons.json`, see [design.md](design.md#food-icons-foodiconsts-foodicon-in-uitsx)); the icon is normally picked from the meal name.

## Static vs dynamic meals

- **Static** = `recipes` + `recipeVersions` ("usual meals"): fully editable on the Meals tab — rename, slot, new version (by hand or built from the food database), delete unused versions, archive, delete archived meals. One tap on the Food tab logs them.
- **Dynamic** = mom's cooking / one-offs: no template; logged as plain `meals` rows via **Byte** ([ai.md](ai.md)) or manual entry. Byte's logs carry `confidence` `medium`/`low` and a `note` (`Byte: 100 g Egg, whole…`). No schema change was needed.
- Deleting a recipe or version never touches logged meals (they store their own name + macros). A version referenced by a logged meal can't be deleted (it's used to re-scale that log).

## Recipe versioning (blueprint §2, feature A)

- Editing a recipe **never mutates** a version — `saveRecipeVersion()` adds a new one (`version = last + 1`) and makes it the default.
- A meal log keeps `recipeVersionId` + `scale`, so old days stay correct after an edit, and portion changes (×0.5…×2) recompute from that exact version.
- Any version can be set back as default ("Use") or logged directly from the Food tab chips.

## Confidence

`meals.confidence`: `high` (weighed / template), `medium` (estimated), `low` (rough guess). Templates log as `high`. Shown in the UI for medium/low. The future AI estimator must fill this honestly.

## Seeding

`seed.ts` → `seedIfEmpty()` runs on every app start inside **one Dexie transaction** (React StrictMode runs effects twice; without the transaction both runs seeded). It also removes duplicate recipes left by that old bug — only same-name copies whose versions were **never logged**.

Seed values: breakfast/lunch computed from USDA SR Legacy per-100 g values (no cooking oil); shake v1/v2 copied from the blueprint. They are starting points the user edits.

## Targets

`Targets = { kcal, protein, carbs, fat, waterL, creatineG }`, presets `TARGET_PRESETS.standard` (3,000 kcal) and `.aggressive` (3,300) from blueprint §2. Default when unset: standard.

## Backup format

> Device UI prefs (palette, sound, volume, AI model choice…), Byte's chat history (`localStorage` key `mt-chat`) and downloaded AI models (browser storage) are **not** in backups — they live in `localStorage` key `mt-prefs` (see [design.md](design.md#settings-prefs-prefsts)).

```json
{ "app": "mt-macro", "schema": 1, "exportedAt": "ISO-8601",
  "data": { "recipes": [], "recipeVersions": [], "meals": [], "weights": [], "sleeps": [], "dayChecks": [], "settings": [] } }
```

Import **replaces all data** (clear + bulkAdd in one transaction) after a confirm dialog; rejects files where `app !== "mt-macro"`.

## Changing the schema

1. Add a new `db.version(N).stores({...})` (keep old versions; add `.upgrade()` if data must be transformed).
2. Bump `schema` in `exportBackup()` and make `importBackup()` accept older schemas.
3. Add new tables to `BACKUP_TABLES`.
4. Update this file and [changelog.md](changelog.md).
