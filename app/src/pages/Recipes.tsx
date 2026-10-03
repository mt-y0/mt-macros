import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, saveRecipeVersion, SLOT_LABEL, type Macros, type MealSlot, type Recipe, type RecipeVersion } from '../db'
import { loadFoods, macrosFor, pieceGrams, searchFoods, type Food } from '../foodDb'
import { macroError, sumMacros } from '../logic'
import { Card, FoodIcon, NumField } from '../ui'

// Static meals ("usual meals"): fully editable templates. Every edit is saved as a new version so past logs keep their numbers.
// Dynamic meals (mom's cooking) are not templates — they're logged through Byte (AI tab) or manual entry on the Food tab.

export default function Recipes() {
  const allRecipes = useLiveQuery(() => db.recipes.toArray()) ?? []
  const recipes = allRecipes.filter((r) => !r.archived)
  const archived = allRecipes.filter((r) => r.archived)
  const versions = useLiveQuery(() => db.recipeVersions.toArray()) ?? []
  const used = new Set(useLiveQuery(() => db.meals.toArray().then((ms) => ms.map((m) => m.recipeVersionId))) ?? [])
  const [newName, setNewName] = useState('')
  const [newSlot, setNewSlot] = useState<MealSlot>('snack')
  const [justAdded, setJustAdded] = useState<number | null>(null)

  async function addRecipe() {
    if (!newName.trim()) return
    const id = (await db.recipes.add({ name: newName.trim(), slot: newSlot }))!
    await saveRecipeVersion(id, { label: 'v1', ingredients: '', kcal: 0, protein: 0, carbs: 0, fat: 0 })
    setNewName('')
    setJustAdded(id)
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Your usual meals</p>
          <h1>Meals</h1>
        </div>
      </header>
      <p className="muted small">
        These are your static meals — one tap on the Food tab logs them. Mom's cooking and one-off meals go through Byte instead.
      </p>
      {recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} versions={versions.filter((v) => v.recipeId === r.id)} used={used} startEditing={justAdded === r.id} />
      ))}
      <Card title="New meal">
        <div className="form">
          <input dir="auto" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name, e.g. Tuna sandwich" />
          <div className="row">
            <select value={newSlot} onChange={(e) => setNewSlot(e.target.value as MealSlot)}>
              {Object.entries(SLOT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="primary" onClick={addRecipe} disabled={!newName.trim()}>
              Add meal
            </button>
          </div>
        </div>
      </Card>
      {archived.length > 0 && (
        <Card title="Archived">
          <ul className="list">
            {archived.map((r) => (
              <li key={r.id}>
                <span dir="auto">{r.name}</span>
                <div className="row">
                  <button className="chip" onClick={() => db.recipes.update(r.id!, { archived: false })}>
                    Restore
                  </button>
                  <button
                    className="ghost"
                    onClick={async () => {
                      if (!confirm(`Delete “${r.name}” for good? Days you already logged keep their numbers.`)) return
                      await db.transaction('rw', db.recipes, db.recipeVersions, async () => {
                        await db.recipeVersions.where('recipeId').equals(r.id!).delete()
                        await db.recipes.delete(r.id!)
                      })
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function RecipeCard({ recipe, versions, used, startEditing }: { recipe: Recipe; versions: RecipeVersion[]; used: Set<number | undefined>; startEditing: boolean }) {
  const current = versions.find((v) => v.id === recipe.currentVersionId) ?? versions.at(-1)
  const [edit, setEdit] = useState<RecipeVersion | null>(startEditing && current ? { ...current } : null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(recipe.name)

  const error = edit ? macroError(edit) : null

  async function saveNew() {
    if (!edit || error) return
    const { kcal, protein, carbs, fat, ingredients } = edit
    // An untouched label means "next version"; a fresh v1 with zeros is overwritten in place of a pointless v2.
    const label = edit.label === current?.label ? `v${(versions.at(-1)?.version ?? 0) + 1}` : edit.label
    const blankFirst = versions.length === 1 && current && current.kcal === 0 && !current.ingredients && !used.has(current.id)
    if (blankFirst) await db.recipeVersions.update(current.id!, { ingredients, kcal, protein, carbs, fat })
    else await saveRecipeVersion(recipe.id!, { label, ingredients, kcal, protein, carbs, fat })
    setEdit(null)
  }

  async function rename() {
    if (name.trim()) await db.recipes.update(recipe.id!, { name: name.trim() })
    setRenaming(false)
  }

  return (
    <Card
      title={renaming ? undefined : recipe.name}
      art={<FoodIcon name={recipe.name} slot={recipe.slot} />}
      right={
        renaming ? (
          <div className="row grow">
            <input dir="auto" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && rename()} />
            <button className="primary" onClick={rename}>
              Save
            </button>
          </div>
        ) : (
          <button className="ghost" onClick={() => setRenaming(true)} aria-label="Rename">
            ✎
          </button>
        )
      }
    >
      <label className="field">
        <span>Shows up as</span>
        <select value={recipe.slot} onChange={(e) => db.recipes.update(recipe.id!, { slot: e.target.value as MealSlot })}>
          {Object.entries(SLOT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <ul className="list">
        {versions.map((v) => (
          <li key={v.id}>
            <div>
              <div>
                {v.label} {v.id === current?.id && <span className="badge">default</span>}
              </div>
              <small className="muted">
                {v.kcal} kcal · P {v.protein} · C {v.carbs} · F {v.fat}
                {v.ingredients && <> — {v.ingredients}</>}
              </small>
            </div>
            <div className="row">
              {v.id !== current?.id && (
                <button className="chip" onClick={() => db.recipes.update(recipe.id!, { currentVersionId: v.id })}>
                  Use
                </button>
              )}
              {v.id !== current?.id && !used.has(v.id) && (
                <button className="ghost" aria-label={`Delete ${v.label}`} onClick={() => db.recipeVersions.delete(v.id!)}>
                  ×
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="form">
          <label className="field">
            <span>Version name</span>
            <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
          </label>
          <IngredientBuilder onUse={(m, text) => setEdit({ ...edit, ...m, ingredients: text })} />
          <label className="field">
            <span>Ingredients (notes)</span>
            <textarea dir="auto" rows={2} value={edit.ingredients} onChange={(e) => setEdit({ ...edit, ingredients: e.target.value })} />
          </label>
          <div className="grid4">
            <NumField label="kcal" value={edit.kcal} onChange={(kcal) => setEdit({ ...edit, kcal })} />
            <NumField label="Protein g" value={edit.protein} onChange={(protein) => setEdit({ ...edit, protein })} />
            <NumField label="Carbs g" value={edit.carbs} onChange={(carbs) => setEdit({ ...edit, carbs })} />
            <NumField label="Fat g" value={edit.fat} onChange={(fat) => setEdit({ ...edit, fat })} />
          </div>
          {error && <p className="hint">{error}</p>}
          <div className="row">
            <button className="primary" onClick={saveNew} disabled={!!error}>
              Save
            </button>
            <button className="ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="row">
          {current && <button onClick={() => setEdit({ ...current })}>Edit (new version)</button>}
          <button className="ghost" onClick={() => db.recipes.update(recipe.id!, { archived: true })}>
            Archive
          </button>
        </div>
      )}
    </Card>
  )
}

type Row = { food: Food; grams: number }

/** Build a meal from the food database: search, add ingredients with grams, then copy the summed macros. */
function IngredientBuilder({ onUse }: { onUse: (m: Macros, text: string) => void }) {
  const [foods, setFoods] = useState<Food[]>([])
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (open) void loadFoods().then(setFoods)
  }, [open])

  const results = q.trim().length >= 2 ? searchFoods(foods, q, 6) : []
  const raw = sumMacros(rows.map((r) => macrosFor(r.food, r.grams)))
  const total: Macros = { kcal: Math.round(raw.kcal), protein: Math.round(raw.protein), carbs: Math.round(raw.carbs), fat: Math.round(raw.fat) }

  if (!open)
    return (
      <button className="wide" onClick={() => setOpen(true)}>
        Build from food database
      </button>
    )
  return (
    <div className="builder">
      <input dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods (e.g. oats, دجاج, peanut butter)" />
      {results.length > 0 && (
        <ul className="list results">
          {results.map((f) => (
            <li key={f.id}>
              <button
                className="result"
                onClick={() => {
                  setRows([...rows, { food: f, grams: Math.round(pieceGrams(f) ?? 100) }])
                  setQ('')
                }}
              >
                <span>{f.name}</span>
                <small className="muted">{f.per100.kcal} kcal/100 g</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <ul className="list">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="estimate-main">
                <div>{r.food.name}</div>
                <small className="muted">{macrosFor(r.food, r.grams).kcal} kcal</small>
              </div>
              <label className="estimate-grams">
                <input
                  inputMode="decimal"
                  value={r.grams}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, grams: Math.max(0, Number(e.target.value) || 0) } : x)))}
                />
                <span>g</span>
              </label>
              <button className="ghost" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row wrap">
        <span className="num small">
          Total {total.kcal} kcal · P {total.protein} · C {total.carbs} · F {total.fat}
        </span>
        <button className="primary" disabled={!rows.length} onClick={() => onUse(total, rows.map((r) => `${r.grams} g ${r.food.name}`).join(', '))}>
          Use these numbers
        </button>
      </div>
    </div>
  )
}
