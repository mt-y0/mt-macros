import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, getTargets } from '../db'
import { addDays, ADJUST_COOLDOWN_DAYS, calorieAdvice, todayISO, WEIGHT_RANGE, weightAvg7 } from '../logic'
import { Scale } from '../art'
import { Card, NumField, Stat } from '../ui'

export default function Weight() {
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray()) ?? []
  const targets = useLiveQuery(getTargets)
  const [kg, setKg] = useState(NaN)
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')
  const lastChange = useLiveQuery(() => db.settings.get('calorieChange'))?.value as
    | { date: string; delta: number }
    | undefined
  const today = todayISO()
  const nextCheck = lastChange ? addDays(lastChange.date, ADJUST_COOLDOWN_DAYS) : null
  const coolingDown = nextCheck != null && today < nextCheck

  const avg = weightAvg7(weights, today)
  const advice = calorieAdvice(weights, today)

  async function save() {
    if (!(kg >= WEIGHT_RANGE[0] && kg <= WEIGHT_RANGE[1])) {
      setError(`Enter a weight between ${WEIGHT_RANGE[0]} and ${WEIGHT_RANGE[1]} kg.`)
      return
    }
    setError('')
    const existing = await db.weights.where('date').equals(date).first()
    if (existing) await db.weights.update(existing.id!, { kg })
    else await db.weights.add({ date, kg })
    setKg(NaN)
  }

  async function applyAdvice() {
    if (!targets || advice.delta === 0 || coolingDown) return
    // Shift the calorie change into carbs (4 kcal/g); protein and fat stay fixed.
    await db.transaction('rw', db.settings, async () => {
      await db.settings.put({
        key: 'targets',
        value: { ...targets, kcal: targets.kcal + advice.delta, carbs: Math.round(targets.carbs + advice.delta / 4) },
      })
      await db.settings.put({ key: 'calorieChange', value: { date: today, delta: advice.delta } })
    })
  }

  const recent = [...weights].reverse().slice(0, 30)

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Morning weigh-in</p>
          <h1>Weight</h1>
        </div>
        <Scale size={64} />
      </header>

      <Card title="Log weight">
        <div className="grid2">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </label>
          <NumField label="kg" step={0.1} value={kg} onChange={setKg} />
        </div>
        <button className="primary wide" onClick={save}>
          Save weight
        </button>
        {error && <p className="hint">{error}</p>}
        <p className="muted small">Weigh in the morning, after the toilet, before eating.</p>
      </Card>

      <Card title="Trend">
        <div className="stats">
          <Stat label="7-day average" value={avg != null ? `${avg.toFixed(1)} kg` : '—'} />
          <Stat
            label="This week"
            value={advice.weeklyRates[0] != null ? `${advice.weeklyRates[0] >= 0 ? '+' : ''}${advice.weeklyRates[0].toFixed(2)} kg` : '—'}
          />
          <Stat
            label="Last week"
            value={advice.weeklyRates[1] != null ? `${advice.weeklyRates[1] >= 0 ? '+' : ''}${advice.weeklyRates[1].toFixed(2)} kg` : '—'}
          />
        </div>
        <Sparkline values={weights.slice(-60).map((w) => w.kg)} />
        <p className="advice">{advice.text}</p>
        {coolingDown && lastChange && (
          <p className="muted small">
            Changed target by {lastChange.delta > 0 ? '+' : ''}
            {lastChange.delta} kcal on {lastChange.date}. Give it two weeks — the next suggestion can be applied from {nextCheck}.
          </p>
        )}
        {advice.delta !== 0 && targets && !coolingDown && (
          <button className="primary" onClick={applyAdvice}>
            Apply: {targets.kcal} → {targets.kcal + advice.delta} kcal
          </button>
        )}
      </Card>

      <Card title="History">
        {recent.length === 0 && <p className="muted">No weigh-ins yet. Your first entry starts the trend.</p>}
        <ul className="list">
          {recent.map((w) => (
            <li key={w.id}>
              <span>{w.date}</span>
              <div className="row">
                <span className="num">{w.kg.toFixed(1)} kg</span>
                <button className="ghost" onClick={() => db.weights.delete(w.id!)} aria-label="Delete">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 300},${58 - ((v - min) / span) * 52}`).join(' ')
  return (
    <svg className="spark" viewBox="0 0 300 62" preserveAspectRatio="none" role="img" aria-label="Weight trend">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
