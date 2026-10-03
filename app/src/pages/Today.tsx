import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, getTargets, SLOT_LABEL, type Confidence, type MealLog, type MealSlot } from '../db'
import { addDays, macroError, MIN_VIABLE, RECOVERY, scaleMacros, sumMacros, todayISO, type FailureKind } from '../logic'
import Mascot from '../Mascot'
import { Bar, Card, FoodIcon, NumField, Plate } from '../ui'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function prettyDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function Today() {
  const [date, setDate] = useState(todayISO())
  const targets = useLiveQuery(getTargets)
  const meals = useLiveQuery(() => db.meals.where('date').equals(date).toArray(), [date]) ?? []
  const recipes = useLiveQuery(() => db.recipes.filter((r) => !r.archived).toArray()) ?? []
  const versions = useLiveQuery(() => db.recipeVersions.toArray()) ?? []
  const check = useLiveQuery(() => db.dayChecks.get(date), [date])
  const [recovery, setRecovery] = useState<FailureKind | null>(null)

  const total = sumMacros(meals)
  const isToday = date === todayISO()

  async function logRecipe(recipeId: number, versionId: number, scale = 1) {
    const r = recipes.find((x) => x.id === recipeId)!
    const v = versions.find((x) => x.id === versionId)!
    await db.meals.add({
      date,
      slot: r.slot,
      name: `${r.name} (${v.label})`,
      recipeVersionId: v.id,
      scale,
      confidence: 'high',
      createdAt: new Date().toISOString(),
      ...scaleMacros(v, scale),
    })
  }

  async function rescale(m: MealLog, scale: number) {
    if (!m.recipeVersionId || !(scale > 0)) return
    const v = versions.find((x) => x.id === m.recipeVersionId)
    if (v) await db.meals.update(m.id!, { scale, ...scaleMacros(v, scale) })
  }

  async function updateCheck(patch: Partial<{ creatine: boolean; waterL: number }>) {
    const cur = check ?? { date, creatine: false, waterL: 0 }
    await db.dayChecks.put({ ...cur, ...patch })
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{isToday ? greeting() : 'Looking back'}</p>
          <h1>{isToday ? 'Today' : prettyDate(date)}</h1>
        </div>
        <div className="date-nav">
          <button className="round" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            ‹
          </button>
          <button className="round" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Next day">
            ›
          </button>
        </div>
      </header>

      {targets && (
        <section className="hero">
          <Plate value={total.kcal} target={targets.kcal}>
            <div className="plate-num">{Math.round(total.kcal).toLocaleString()}</div>
            <div className="plate-sub">of {targets.kcal.toLocaleString()} kcal</div>
            <div className="plate-left">
              {total.kcal < targets.kcal
                ? `${Math.round(targets.kcal - total.kcal).toLocaleString()} to go`
                : 'Plate full'}
            </div>
          </Plate>
          <div className="macros">
            <Bar label="Protein" value={total.protein} target={targets.protein} unit="g" />
            <Bar label="Carbs" value={total.carbs} target={targets.carbs} unit="g" />
            <Bar label="Fat" value={total.fat} target={targets.fat} unit="g" />
          </div>
          {meals.length > 0 && (total.kcal < MIN_VIABLE.kcal || total.protein < MIN_VIABLE.protein) && (
            <p className="hint">
              Minimum viable day is {MIN_VIABLE.kcal.toLocaleString()} kcal and {MIN_VIABLE.protein} g protein.
            </p>
          )}
        </section>
      )}

      <h2 className="section-title">Your usual meals</h2>
      <div className="quick-grid">
        {recipes.map((r) => {
          const rv = versions.filter((v) => v.recipeId === r.id)
          const cur = rv.find((v) => v.id === r.currentVersionId) ?? rv.at(-1)
          if (!cur) return null
          return (
            <div key={r.id} className="quick">
              <button className="quick-main" onClick={() => logRecipe(r.id!, cur.id!)}>
                <FoodIcon name={r.name} slot={r.slot} />
                <span className="quick-text">
                  <span className="quick-name">{r.name}</span>
                  <small>
                    {cur.kcal} kcal · {cur.protein} g protein
                  </small>
                </span>
                <span className="quick-add" aria-hidden>
                  +
                </span>
              </button>
              {rv.length > 1 && (
                <div className="chips">
                  {rv.map((v) => (
                    <button
                      key={v.id}
                      className={`chip ${v.id === cur.id ? 'on' : ''}`}
                      onClick={() => logRecipe(r.id!, v.id!)}
                    >
                      Log {v.label} · {v.kcal}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ManualEntry date={date} />

      <Card title="Eaten today">
        {meals.length === 0 && <p className="muted">Nothing logged yet. Tap one of your usual meals above to log it.</p>}
        <ul className="list">
          {meals.map((m) => (
            <li key={m.id}>
              <div className="row">
                <FoodIcon name={m.name} slot={m.slot} className="thumb" />
                <div>
                <div>{m.name}</div>
                <small className="muted">
                  {m.kcal} kcal · P {m.protein} · C {m.carbs} · F {m.fat}
                  {m.confidence !== 'high' && <span className={`conf ${m.confidence}`}> {m.confidence} confidence</span>}
                </small>
                </div>
              </div>
              <div className="row">
                {m.recipeVersionId && (
                  <select value={m.scale} onChange={(e) => rescale(m, parseFloat(e.target.value))} title="Portion">
                    {[0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2].map((s) => (
                      <option key={s} value={s}>
                        ×{s}
                      </option>
                    ))}
                  </select>
                )}
                <button className="ghost" onClick={() => db.meals.delete(m.id!)} aria-label="Delete">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Habits">
        <div className="row wrap">
          <label className="check">
            <input type="checkbox" checked={check?.creatine ?? false} onChange={(e) => updateCheck({ creatine: e.target.checked })} />
            Creatine ({targets?.creatineG ?? 5} g)
          </label>
          <div className="row">
            <span>
              Water {check?.waterL ?? 0} / {targets?.waterL ?? 3} L
            </span>
            <button onClick={() => updateCheck({ waterL: Math.max(0, (check?.waterL ?? 0) - 0.5) })}>−</button>
            <button onClick={() => updateCheck({ waterL: (check?.waterL ?? 0) + 0.5 })}>+0.5</button>
          </div>
        </div>
      </Card>

      <Card title="Something went wrong?">
        <div className="chips">
          {(Object.keys(RECOVERY) as FailureKind[]).map((k) => (
            <button key={k} className={`chip ${recovery === k ? 'on' : ''}`} onClick={() => setRecovery(recovery === k ? null : k)}>
              {RECOVERY[k].title}
            </button>
          ))}
        </div>
        {recovery && <p className="advice">{RECOVERY[recovery].advice}</p>}
      </Card>
    </>
  )
}

function ManualEntry({ date }: { date: string }) {
  const empty = { name: '', slot: 'dynamic1' as MealSlot, kcal: NaN, protein: NaN, carbs: NaN, fat: NaN, confidence: 'medium' as Confidence }
  const [f, setF] = useState(empty)
  const [open, setOpen] = useState(false)
  const n = (x: number) => (Number.isFinite(x) ? Math.round(x) : 0)
  // Only calories are required; blank protein/carbs/fat count as 0.
  const error = macroError({ kcal: f.kcal, protein: f.protein || 0, carbs: f.carbs || 0, fat: f.fat || 0 })

  async function save() {
    if (!f.name.trim() || error) return
    await db.meals.add({
      date,
      slot: f.slot,
      name: f.name.trim(),
      kcal: n(f.kcal),
      protein: n(f.protein),
      carbs: n(f.carbs),
      fat: n(f.fat),
      scale: 1,
      confidence: f.confidence,
      createdAt: new Date().toISOString(),
    })
    setF(empty)
    setOpen(false)
  }

  return (
    <Card
      title="Mom's cooking & other meals"
      right={
        <button className="ghost" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Manual'}
        </button>
      }
    >
      {!open && (
        <button className="primary wide ask-byte" onClick={() => window.dispatchEvent(new CustomEvent('mt-nav', { detail: 'byte' }))}>
          <Mascot mood="idle" size={26} /> Ask Byte what it was
        </button>
      )}
      {open && (
        <div className="form">
          <label className="field">
            <span>Name (Arabic or English)</span>
            <input dir="auto" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. باميا مع تمن" />
          </label>
          <label className="field">
            <span>Slot</span>
            <select value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value as MealSlot })}>
              {Object.entries(SLOT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="grid4">
            <NumField label="kcal" value={f.kcal} onChange={(kcal) => setF({ ...f, kcal })} />
            <NumField label="Protein g" value={f.protein} onChange={(protein) => setF({ ...f, protein })} />
            <NumField label="Carbs g" value={f.carbs} onChange={(carbs) => setF({ ...f, carbs })} />
            <NumField label="Fat g" value={f.fat} onChange={(fat) => setF({ ...f, fat })} />
          </div>
          <label className="field">
            <span>How sure are you?</span>
            <select value={f.confidence} onChange={(e) => setF({ ...f, confidence: e.target.value as Confidence })}>
              <option value="high">High (weighed / label)</option>
              <option value="medium">Medium (estimated)</option>
              <option value="low">Low (rough guess)</option>
            </select>
          </label>
          {f.name.trim() && error && <p className="hint">{error}</p>}
          <button className="primary" onClick={save} disabled={!f.name.trim() || !!error}>
            Log meal
          </button>
        </div>
      )}
    </Card>
  )
}
