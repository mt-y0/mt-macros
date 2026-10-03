import Dexie, { type EntityTable } from 'dexie'

export type Macros = { kcal: number; protein: number; carbs: number; fat: number }

export type MealSlot = 'breakfast' | 'lunch' | 'shake' | 'dynamic1' | 'dynamic2' | 'snack'

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  shake: 'Shake',
  dynamic1: "Mom's meal 1",
  dynamic2: "Mom's meal 2",
  snack: 'Snack',
}

export interface Recipe {
  id?: number
  name: string
  slot: MealSlot
  currentVersionId?: number
  archived?: boolean
}

/** Immutable snapshot: editing a recipe creates a new version instead of mutating old logs. */
export interface RecipeVersion extends Macros {
  id?: number
  recipeId: number
  version: number
  label: string
  ingredients: string
  createdAt: string
}

export type Confidence = 'high' | 'medium' | 'low'

export interface MealLog extends Macros {
  id?: number
  date: string // YYYY-MM-DD (local)
  slot: MealSlot
  name: string
  recipeVersionId?: number
  scale: number
  confidence: Confidence
  note?: string
  createdAt: string
}

export interface WeightLog {
  id?: number
  date: string
  kg: number
}

export interface SleepLog {
  id?: number
  date: string // the date you woke up
  bedtime: string // HH:MM
  wake: string // HH:MM
  quality: number // 1-5
  lastCaffeine?: string // HH:MM
  napMin?: number
}

export interface DayCheck {
  date: string
  creatine: boolean
  waterL: number
  note?: string
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('mt-macro') as Dexie & {
  recipes: EntityTable<Recipe, 'id'>
  recipeVersions: EntityTable<RecipeVersion, 'id'>
  meals: EntityTable<MealLog, 'id'>
  weights: EntityTable<WeightLog, 'id'>
  sleeps: EntityTable<SleepLog, 'id'>
  dayChecks: EntityTable<DayCheck, 'date'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  recipes: '++id, slot, name',
  recipeVersions: '++id, recipeId, [recipeId+version]',
  meals: '++id, date, slot',
  weights: '++id, &date',
  sleeps: '++id, &date',
  dayChecks: 'date',
  settings: 'key',
})

export type Targets = Macros & { waterL: number; creatineG: number }

export const TARGET_PRESETS: Record<'standard' | 'aggressive', Targets> = {
  standard: { kcal: 3000, protein: 112, carbs: 430, fat: 90, waterL: 3, creatineG: 5 },
  aggressive: { kcal: 3300, protein: 120, carbs: 490, fat: 95, waterL: 3, creatineG: 5 },
}

export async function getTargets(): Promise<Targets> {
  const s = await db.settings.get('targets')
  return (s?.value as Targets) ?? TARGET_PRESETS.standard
}

export async function saveRecipeVersion(
  recipeId: number,
  data: Omit<RecipeVersion, 'id' | 'recipeId' | 'version' | 'createdAt'>,
) {
  return db.transaction('rw', db.recipes, db.recipeVersions, async () => {
    const last = await db.recipeVersions.where('recipeId').equals(recipeId).sortBy('version')
    const version = (last.at(-1)?.version ?? 0) + 1
    const id = await db.recipeVersions.add({
      ...data,
      recipeId,
      version,
      createdAt: new Date().toISOString(),
    })
    await db.recipes.update(recipeId, { currentVersionId: id })
    return id
  })
}

const BACKUP_TABLES = ['recipes', 'recipeVersions', 'meals', 'weights', 'sleeps', 'dayChecks', 'settings'] as const

export async function exportBackup() {
  const data: Record<string, unknown[]> = {}
  for (const t of BACKUP_TABLES) data[t] = await db.table(t).toArray()
  return { app: 'mt-macro', schema: 1, exportedAt: new Date().toISOString(), data }
}

export async function importBackup(json: { app?: string; data?: Record<string, unknown[]> }) {
  if (json.app !== 'mt-macro' || !json.data) throw new Error('Not an mt-macro backup file')
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      await db.table(t).clear()
      await db.table(t).bulkAdd(json.data![t] ?? [])
    }
  })
}
