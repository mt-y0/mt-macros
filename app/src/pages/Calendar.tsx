import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, getTargets, type DayCheck, type MealLog, type SleepLog, type Targets, type WeightLog } from '../db'
import { addDays, dayScore, fmtHM, SCORE_LABEL, sleepMinutes, sumMacros, todayISO, weekStart, type DayScore, type ScoreKey } from '../logic'
import { Card, Stat } from '../ui'

type View = 'month' | 'week'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** The three parts shown as dots on each day (creatine only in the details). */
const DOTS: ScoreKey[] = ['food', 'drink', 'sleep']

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', o)

/** First and last day of the period containing `anchor`, plus the grid days (whole weeks, Mon–Sun). */
function period(view: View, anchor: string) {
  if (view === 'week') {
    const from = weekStart(anchor)
    const to = addDays(from, 6)
    return { from, to, grid: Array.from({ length: 7 }, (_, i) => addDays(from, i)) }
  }
  const from = anchor.slice(0, 8) + '01'
  const to = addDays(addDays(from, 32).slice(0, 8) + '01', -1)
  const grid: string[] = []
  for (let d = weekStart(from); d <= to || grid.length % 7; d = addDays(d, 1)) grid.push(d)
  return { from, to, grid }
}

/** Score tier → cell colour class (index.css .cal-day.t0–t3). */
const tier = (s: number) => (s >= 8.5 ? 3 : s >= 6.5 ? 2 : s >= 4 ? 1 : 0)

export default function Calendar() {
  const today = todayISO()
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(today)
  const [picked, setPicked] = useState<string | null>(today)
  const targets = useLiveQuery(getTargets)
  const { from, to, grid } = period(view, anchor)
  const lo = grid[0]
  const hi = grid.at(-1)!

  const meals = useLiveQuery(() => db.meals.where('date').between(lo, hi, true, true).toArray(), [lo, hi]) ?? []
  const sleeps = useLiveQuery(() => db.sleeps.where('date').between(lo, hi, true, true).toArray(), [lo, hi]) ?? []
  const checks = useLiveQuery(() => db.dayChecks.where('date').between(lo, hi, true, true).toArray(), [lo, hi]) ?? []
  const weights = useLiveQuery(() => db.weights.where('date').between(from, to, true, true).sortBy('date'), [from, to]) ?? []

  const dayData = (d: string) => ({
    meals: meals.filter((m) => m.date === d),
    sleep: sleeps.find((s) => s.date === d),
    check: checks.find((c) => c.date === d),
  })
  const scores = new Map<string, DayScore | null>()
  if (targets) for (const d of grid) scores.set(d, d > today ? null : dayScore(dayData(d), targets))

  function move(n: number) {
    const next = view === 'week' ? addDays(anchor, 7 * n) : addDays(anchor.slice(0, 8) + '15', 30 * n)
    setAnchor(next > today ? today : next)
    setPicked(null)
  }

  const title =
    view === 'month' ? fmt(from, { month: 'long', year: 'numeric' }) : `${fmt(from, { day: 'numeric', month: 'short' })} – ${fmt(to, { day: 'numeric', month: 'short' })}`

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{view === 'month' ? 'Monthly report' : 'Weekly report'}</p>
          <h1>{title}</h1>
        </div>
        <div className="date-nav">
          <button className="round" onClick={() => move(-1)} aria-label={`Previous ${view}`}>
            ‹
          </button>
          <button className="round" onClick={() => move(1)} disabled={to >= today} aria-label={`Next ${view}`}>
            ›
          </button>
        </div>
      </header>

      <div className="chips segmented">
        {(['week', 'month'] as const).map((v) => (
          <button key={v} className={`chip ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
            {v === 'week' ? 'Week' : 'Month'}
          </button>
        ))}
      </div>

      <section className="card cal">
        <div className="cal-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-wd">
              {view === 'month' ? w[0] : w}
            </div>
          ))}
          {grid.map((d) => {
            const s = scores.get(d)
            const outside = d < from || d > to
            return (
              <button
                key={d}
                className={`cal-day ${s ? `t${tier(s.total)}` : 'empty'} ${outside ? 'outside' : ''} ${d === today ? 'today' : ''} ${d === picked ? 'picked' : ''}`}
                disabled={d > today}
                onClick={() => setPicked(d === picked ? null : d)}
                aria-label={`${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${s ? `${s.total} out of 10` : 'nothing logged'}`}
              >
                <span className="cal-num">{Number(d.slice(8))}</span>
                <span className="cal-score num">{s ? Math.round(s.total) : ''}</span>
                <span className="cal-dots">
                  {s &&
                    DOTS.map((k) => {
                      const p = s.parts.find((x) => x.key === k)!
                      return <i key={k} className={`dot ${k} ${p.good ? 'good' : p.logged ? 'some' : ''}`} />
                    })}
                </span>
              </button>
            )
          })}
        </div>
        <div className="cal-legend small muted">
          <span>
            <i className="dot food good" /> Food
          </span>
          <span>
            <i className="dot drink good" /> Water
          </span>
          <span>
            <i className="dot sleep good" /> Sleep
          </span>
          <span>filled = good · ring = logged</span>
        </div>
      </section>

      {picked && targets && <DayDetail date={picked} score={scores.get(picked) ?? null} data={dayData(picked)} targets={targets} inRange={scores.has(picked)} />}

      {targets && <Summary from={from} to={to} today={today} scores={scores} weights={weights} meals={meals} sleeps={sleeps} checks={checks} />}
    </>
  )
}

function Summary({
  from,
  to,
  today,
  scores,
  weights,
  meals,
  sleeps,
  checks,
}: {
  from: string
  to: string
  today: string
  scores: Map<string, DayScore | null>
  weights: WeightLog[]
  meals: MealLog[]
  sleeps: SleepLog[]
  checks: DayCheck[]
}) {
  const inPeriod = (d: string) => d >= from && d <= to
  const days = [...scores].filter(([d, s]) => inPeriod(d) && s) as [string, DayScore][]
  const elapsed = [...scores.keys()].filter((d) => inPeriod(d) && d <= today).length
  const avg = days.length ? days.reduce((a, [, s]) => a + s.total, 0) / days.length : null
  const best = days.reduce<[string, DayScore] | null>((b, x) => (!b || x[1].total > b[1].total ? x : b), null)
  const good = (k: ScoreKey) => days.filter(([, s]) => s.parts.find((p) => p.key === k)!.good).length

  const foodDays = [...new Set(meals.filter((m) => inPeriod(m.date)).map((m) => m.date))]
  const foodTotal = sumMacros(meals.filter((m) => inPeriod(m.date)))
  const nights = sleeps.filter((s) => inPeriod(s.date))
  const avgSleep = nights.length ? nights.reduce((a, s) => a + sleepMinutes(s), 0) / nights.length : null
  const weightChange = weights.length >= 2 ? weights.at(-1)!.kg - weights[0].kg : null

  return (
    <Card title="Report">
      <div className="stats">
        <Stat label="Avg score" value={avg != null ? avg.toFixed(1) : '—'} sub="out of 10" />
        <Stat label="Days logged" value={`${days.length}/${elapsed}`} sub={to >= today ? 'so far' : 'days'} />
        <Stat label="Best day" value={best ? best[1].total.toFixed(1) : '—'} sub={best ? fmt(best[0], { weekday: 'short', day: 'numeric' }) : ' '} />
      </div>
      <p className="cal-sub">Good days</p>
      <div className="cal-goods">
        {(['food', 'drink', 'sleep', 'creatine'] as const).map((k) => (
          <div key={k} className="cal-good">
            <i className={`dot ${k} good`} />
            <span>{SCORE_LABEL[k]}</span>
            <b className="num">
              {good(k)}/{days.length}
            </b>
          </div>
        ))}
      </div>
      <p className="cal-sub">Averages</p>
      <div className="stats">
        <Stat label="Calories" value={foodDays.length ? Math.round(foodTotal.kcal / foodDays.length).toLocaleString() : '—'} sub="kcal / logged day" />
        <Stat label="Protein" value={foodDays.length ? `${Math.round(foodTotal.protein / foodDays.length)} g` : '—'} sub="per logged day" />
        <Stat label="Sleep" value={avgSleep != null ? fmtHM(avgSleep) : '—'} sub={`${nights.length} nights`} />
        <Stat
          label="Weight"
          value={weightChange != null ? `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : '—'}
          sub={weightChange != null ? `${weights.length} weigh-ins` : 'need 2 weigh-ins'}
        />
        <Stat label="Creatine" value={`${checks.filter((c) => inPeriod(c.date) && c.creatine).length} days`} sub={`of ${elapsed}`} />
      </div>
    </Card>
  )
}

function DayDetail({
  date,
  score,
  data,
  targets,
  inRange,
}: {
  date: string
  score: DayScore | null
  data: { meals: MealLog[]; sleep?: SleepLog; check?: DayCheck }
  targets: Targets
  inRange: boolean
}) {
  if (!inRange) return null
  const food = sumMacros(data.meals)
  const detail: Record<ScoreKey, string> = {
    food: data.meals.length
      ? `${Math.round(food.kcal).toLocaleString()} / ${targets.kcal.toLocaleString()} kcal · ${Math.round(food.protein)} / ${targets.protein} g protein`
      : 'Nothing logged',
    drink: data.check?.waterL ? `${data.check.waterL} / ${targets.waterL} L` : 'Not logged',
    sleep: data.sleep ? `${fmtHM(sleepMinutes(data.sleep))} · quality ${data.sleep.quality}/5 · ${data.sleep.bedtime} → ${data.sleep.wake}` : 'Not logged',
    creatine: data.check?.creatine ? `Taken (${targets.creatineG} g)` : 'Not taken',
  }
  return (
    <Card title={fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })} right={score && <span className={`cal-badge t${tier(score.total)}`}>{score.total.toFixed(1)} / 10</span>}>
      {!score && <p className="muted">Nothing logged this day.</p>}
      {score && (
        <ul className="list">
          {score.parts.map((p) => (
            <li key={p.key} className="cal-part">
              <div className="cal-part-main">
                <div className="row">
                  <i className={`dot ${p.key} ${p.good ? 'good' : p.logged ? 'some' : ''}`} />
                  <span>{SCORE_LABEL[p.key]}</span>
                  {p.good && <span className="badge">good</span>}
                </div>
                <small className="muted">{detail[p.key]}</small>
                <div className="bar-track">
                  <div className={`bar-fill ${p.points >= p.max ? 'done' : ''}`} style={{ width: `${(p.points / p.max) * 100}%` }} />
                </div>
              </div>
              <span className="num">
                {p.points} / {p.max}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
