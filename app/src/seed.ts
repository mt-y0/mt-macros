import { db, saveRecipeVersion, type MealSlot, type RecipeVersion } from './db'

type SeedVersion = Omit<RecipeVersion, 'id' | 'recipeId' | 'version' | 'createdAt'>

// Starting values only — the user edits these (each edit becomes a new version).
// Breakfast/lunch computed from USDA SR Legacy per-100 g values (egg 143 kcal, butter 717,
// raw chicken breast 120, cooked white rice 130); cooking oil not included.
// Shake values are taken directly from blueprint.md §2.
const SEED: { name: string; slot: MealSlot; versions: SeedVersion[] }[] = [
  {
    name: 'Omelet (2 eggs + butter) & tea',
    slot: 'breakfast',
    versions: [
      {
        label: 'v1',
        ingredients: '2 large eggs (100 g), 14 g butter, tea (no sugar)',
        kcal: 243, protein: 13, carbs: 1, fat: 21,
      },
    ],
  },
  {
    name: 'Chicken breast & rice',
    slot: 'lunch',
    versions: [
      {
        label: 'v1',
        ingredients: '175 g raw chicken breast, 250 g cooked white rice (no oil counted)',
        kcal: 535, protein: 46, carbs: 71, fat: 5,
      },
    ],
  },
  {
    name: 'Night shake',
    slot: 'shake',
    versions: [
      {
        label: 'v1',
        ingredients: '200 g banana, 100 g oats, 30 g powdered milk, 30 g peanut butter, 10 g sugar, 550 ml water',
        kcal: 940, protein: 31, carbs: 139, fat: 30,
      },
      {
        label: 'v2',
        ingredients: '220 g banana, 80 g oats, 30 g powdered milk, 50 g peanut butter, 1 date, 550 ml water',
        kcal: 1020, protein: 34, carbs: 142, fat: 38,
      },
    ],
  },
]

export async function seedIfEmpty() {
  // One transaction so two concurrent calls (React StrictMode runs effects twice) can't both seed.
  await db.transaction('rw', db.recipes, db.recipeVersions, db.meals, async () => {
    await removeDuplicateRecipes()
    if ((await db.recipes.count()) > 0) return
    for (const r of SEED) {
      const recipeId = (await db.recipes.add({ name: r.name, slot: r.slot }))!
      for (const v of r.versions) await saveRecipeVersion(recipeId, v)
    }
  })
}

/** Clean up copies left by an earlier double-seed bug: same name, never logged, keep the first. */
async function removeDuplicateRecipes() {
  const recipes = await db.recipes.orderBy('id').toArray()
  const usedVersionIds = new Set((await db.meals.toArray()).map((m) => m.recipeVersionId))
  const seen = new Set<string>()
  for (const r of recipes) {
    if (!seen.has(r.name)) {
      seen.add(r.name)
      continue
    }
    const versions = await db.recipeVersions.where('recipeId').equals(r.id!).toArray()
    if (versions.some((v) => usedVersionIds.has(v.id))) continue
    await db.recipeVersions.bulkDelete(versions.map((v) => v.id!))
    await db.recipes.delete(r.id!)
  }
}
