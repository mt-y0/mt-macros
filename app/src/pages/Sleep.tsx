import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type SleepLog } from '../db'
import { addDays, fmtHM, sleepMinutes, sleepStreak, todayISO } from '../logic'
import { NightPalms } from '../art'
import { Card, NumField, Stat } from '../ui'

/** Bedtime as minutes, with after-midnight times pushed past 24h so 23:30 and 00:30 are 60 min apart. */
function bedMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return (h < 12 ? h + 24 : h) * 60 + m
}

function stdDev(xs: number[]) {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
}

export default function Sleep() {
  const sleeps = useLiveQuery(() => db.sleeps.orderBy('date').reverse().toArray()) ?? []
  const today = todayISO()
  const last = sleeps[0]
  const [f, setF] = useState<SleepLog>({
    date: today,
    bedtime: last?.bedtime ?? '23:30',
    wake: last?.wake ?? '07:30',
    quality: 3,
    lastCaffeine: '',
    napMin: 0,
  })

  const week = sleeps.filter((s) => s.date > addDays(today, -7))
  const avgMin = week.length ? week.reduce((a, s) => a + sleepMinutes(s), 0) / week.length : null
  const avgQ = week.length ? week.reduce((a, s) => a + s.quality, 0) / week.length : null
  const bedVar = week.length >= 3 ? stdDev(week.map((s) => bedMinutes(s.bedtime))) : null

  async function save() {
    if (sameTime) return
    const existing = await db.sleeps.where('date').equals(f.date).first()
    const rec = { ...f, napMin: Number.isFinite(f.napMin) ? f.napMin : 0 }
    delete rec.id
    if (existing) await db.sleeps.update(existing.id!, rec)
    else await db.sleeps.add(rec)
  }

  const dur = sleepMinutes(f)
  const sameTime = f.bedtime === f.wake
  const caffeineGap =
    f.lastCaffeine && f.bedtime ? (bedMinutes(f.bedtime) - bedMinutes(f.lastCaffeine) + 1440) % 1440 : null

  return (
    <>
      <section className="night">
        <NightPalms className="night-art" />
        <div className="night-text">
          <p className="eyebrow">Last 7 nights</p>
          <h1>{avgMin != null ? fmtHM(avgMin) : 'Sleep'}</h1>
          <p className="night-sub">{avgMin != null ? 'average a night · aim for 7–9 h' : 'Log your first night below'}</p>
        </div>
      </section>

      <Card>
        <div className="stats">
          <Stat label="Avg quality" value={avgQ != null ? avgQ.toFixed(1) : '—'} sub="1–5" />
          <Stat label="Bedtime spread" value={bedVar != null ? `±${Math.round(bedVar)} min` : '—'} sub="aim < 30–45" />
          <Stat label="Streak" value={`${sleepStreak(sleeps)} nights`} sub="in 7–9 h" />
        </div>
      </Card>

      <Card title="Log a night">
        <div className="form">
          <label className="field">
            <span>Woke up on</span>
            <input type="date" value={f.date} max={today} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </label>
          <div className="grid2">
            <label className="field">
              <span>Bedtime</span>
              <input type="time" value={f.bedtime} onChange={(e) => setF({ ...f, bedtime: e.target.value })} />
            </label>
            <label className="field">
              <span>Wake</span>
              <input type="time" value={f.wake} onChange={(e) => setF({ ...f, wake: e.target.value })} />
            </label>
            <label className="field">
              <span>Last caffeine</span>
              <input type="time" value={f.lastCaffeine ?? ''} onChange={(e) => setF({ ...f, lastCaffeine: e.target.value })} />
            </label>
            <NumField label="Nap (min)" value={f.napMin ?? 0} onChange={(napMin) => setF({ ...f, napMin })} />
          </div>
          <div className="field">
            <span>Quality</span>
            <div className="chips">
              {[1, 2, 3, 4, 5].map((q) => (
                <button key={q} className={`chip ${f.quality === q ? 'on' : ''}`} onClick={() => setF({ ...f, quality: q })}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          <p className="muted small">
            {sameTime ? 'Bedtime and wake time are the same — check the times.' : <>Duration {fmtHM(dur)}</>}
            {caffeineGap != null && caffeineGap < 8 * 60 && ' · caffeine was less than 8 h before bed'}
          </p>
          <button className="primary" onClick={save} disabled={sameTime}>
            Save night
          </button>
        </div>
      </Card>

      <Card title="History">
        {sleeps.length === 0 && <p className="muted">No nights logged yet.</p>}
        <ul className="list">
          {sleeps.slice(0, 30).map((s) => (
            <li key={s.id}>
              <div>
                <div>{s.date}</div>
                <small className="muted">
                  {s.bedtime} → {s.wake} · quality {s.quality}
                  {s.napMin ? ` · nap ${s.napMin}m` : ''}
                </small>
              </div>
              <div className="row">
                <span className="num">{fmtHM(sleepMinutes(s))}</span>
                <button className="ghost" onClick={() => db.sleeps.delete(s.id!)} aria-label="Delete">
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
