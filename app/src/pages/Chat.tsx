import { useEffect, useRef, useState } from 'react'
import { askByte } from '../ai/agent'
import { ensureLoaded, modelInfo, useEngine } from '../ai/engine'
import { estimate, rebuildItem, totalOf, type Estimate, type EstimateItem } from '../ai/estimate'
import { db, SLOT_LABEL, type MealSlot } from '../db'
import { todayISO } from '../logic'
import Mascot, { type Mood } from '../Mascot'
import { usePrefs } from '../prefs'
import { sfx } from '../sound'
import { FoodIcon } from '../ui'

type Msg = {
  id: string
  role: 'user' | 'byte'
  text: string
  estimate?: Estimate
  state?: 'open' | 'added' | 'skipped'
  slot?: MealSlot
  note?: string
}

const KEY = 'mt-chat'
const load = (): Msg[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Msg[]
  } catch {
    return []
  }
}
const save = (m: Msg[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(m.slice(-60)))
  } catch {
    /* full or blocked: chat just isn't kept */
  }
}
const uid = () => Math.random().toString(36).slice(2)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

const ADDED = ['Added! Your plate just levelled up. 📈', 'Logged. The gains goblins thank you.', 'In the books! Chew proud.', 'Done — another brick in the bulk.']
const SKIPPED = ['No worries, I forgot it already. Goldfish mode.', 'Skipped! It never happened. 🤫']
const GREETING = "Hi, I'm Byte! Tell me what you ate — like “2 eggs and a bowl of rice” or “صحن دولمة” — and I'll look it up in the food database."
const EXAMPLES = ['2 eggs and toast', 'a plate of dolma', 'صحن تمن ومرق', '200g chicken and a banana']

export default function Chat() {
  const engine = useEngine()
  const { aiModel } = usePrefs()
  const [msgs, setMsgs] = useState<Msg[]>(load)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  /** Byte's reply as it streams in, word by word (null = not streaming yet). */
  const [live, setLive] = useState<string | null>(null)
  const [flash, setFlash] = useState<Mood | null>(null)
  const end = useRef<HTMLDivElement>(null)

  const update = (fn: (m: Msg[]) => Msg[]) =>
    setMsgs((prev) => {
      const next = fn(prev)
      save(next)
      return next
    })

  useEffect(() => {
    // Block body on purpose: newer Chromium's scrollIntoView returns a Promise, which React would treat as a cleanup.
    void end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [msgs.length, busy, live])
  // Warm the model up as soon as the page opens, so the first answer is quicker.
  useEffect(() => {
    if (aiModel) void ensureLoaded()
  }, [aiModel])

  function mood(): Mood {
    if (!aiModel) return 'sleeping'
    if (engine.kind === 'error') return 'sad'
    if (live) return 'talking'
    if (busy || engine.kind === 'loading' || engine.kind === 'thinking') return 'thinking'
    return flash ?? 'idle'
  }
  const flashMood = (m: Mood, ms = 1800) => {
    setFlash(m)
    window.setTimeout(() => setFlash(null), ms)
  }

  async function send(message = text) {
    const msg = message.trim()
    if (!msg || busy || !aiModel) return
    setText('')
    const history = msgs.map((m) => ({ role: m.role, text: m.text }))
    update((m) => [...m, { id: uid(), role: 'user', text: msg }])
    setBusy(true)
    try {
      const { reply, items, fallback } = await askByte(msg, history, { onReply: (t) => t && setLive(t) })
      const est = items.length ? await estimate(items) : undefined
      update((m) => [
        ...m,
        {
          id: uid(),
          role: 'byte',
          text: reply,
          estimate: est,
          state: est ? 'open' : undefined,
          slot: 'dynamic1',
          note: fallback ? "(My brain fumbled the format, so I split your message with simple rules — double-check the items.)" : undefined,
        },
      ])
      sfx.blip()
      flashMood('talking', 1600)
    } catch (e) {
      update((m) => [...m, { id: uid(), role: 'byte', text: `Bzzt — something broke: ${(e as Error).message}` }])
      sfx.down()
    } finally {
      setLive(null)
      setBusy(false)
    }
  }

  async function add(m: Msg) {
    const e = m.estimate
    if (!e) return
    const matched = e.items.filter((i) => i.foodId !== null)
    if (!matched.length) return
    const allExact = matched.length === e.items.length && e.items.every((i) => i.how !== 'generic')
    await db.meals.add({
      date: todayISO(),
      slot: m.slot ?? 'dynamic1',
      name: matched.map((i) => `${i.amount} ${i.unit === 'piece' ? '×' : i.unit} ${i.food}`).join(' + '),
      ...e.total,
      scale: 1,
      // Database numbers, but amounts are estimated: medium at best.
      confidence: allExact ? 'medium' : 'low',
      note: `Byte: ${matched.map((i) => `${i.grams} g ${i.dbName}`).join('; ')}`,
      createdAt: new Date().toISOString(),
    })
    update((all) => [...all.map((x) => (x.id === m.id ? { ...x, state: 'added' as const } : x)), { id: uid(), role: 'byte', text: pick(ADDED) }])
    sfx.coin()
    flashMood('happy', 2200)
  }

  function skip(m: Msg) {
    update((all) => [...all.map((x) => (x.id === m.id ? { ...x, state: 'skipped' as const } : x)), { id: uid(), role: 'byte', text: pick(SKIPPED) }])
  }

  async function changeItem(m: Msg, idx: number, change: { grams?: number; foodId?: number }) {
    if (!m.estimate) return
    const items = [...m.estimate.items]
    items[idx] = await rebuildItem(items[idx], change)
    update((all) => all.map((x) => (x.id === m.id ? { ...x, estimate: { items, total: totalOf(items) } } : x)))
  }

  const dl = engine.kind === 'downloading' ? engine : null
  const dlPct = dl ? (dl.total ? `${Math.round((dl.loaded / dl.total) * 100)}%` : `${Math.round(dl.loaded / 1e6)} MB`) : ''
  const status = dl
    ? `Downloading ${modelInfo(dl.url).name}… ${dlPct}`
    : !aiModel
      ? 'Asleep — no brain downloaded'
      : engine.kind === 'loading'
        ? 'Waking up… (loading the model)'
        : engine.kind === 'thinking' || busy
          ? 'Thinking…'
          : engine.kind === 'error'
            ? engine.message
            : `${modelInfo(aiModel).name} · on this phone${engine.kind === 'ready' && engine.gpu ? ' · GPU' : ''}`

  return (
    <>
      <header className="byte-head">
        <Mascot mood={mood()} size={84} />
        <div>
          <p className="eyebrow">Your food buddy</p>
          <h1>Byte</h1>
          <p className="muted small">{status}</p>
        </div>
      </header>

      {!aiModel ? (
        <section className="card byte-sleep">
          {dl ? (
            <div className="download">
              <div className="bar-label">
                <span>Getting a brain: {modelInfo(dl.url).name}…</span>
                <span className="num">{dlPct}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${dl.total ? (dl.loaded / dl.total) * 100 : 3}%` }} />
              </div>
              <p className="muted small">Keep the app open — you can use other tabs meanwhile. Byte wakes up when it finishes.</p>
            </div>
          ) : (
            <>
              <p>
                Byte needs a brain first. It's a small AI model (about 300–500 MB) that runs <b>on your phone</b> — download it once, then
                it works offline.
              </p>
              <button className="primary wide" onClick={() => window.dispatchEvent(new CustomEvent('mt-nav', { detail: 'settings' }))}>
                Get a brain in Settings
              </button>
            </>
          )}
        </section>
      ) : (
        <>
          <div className="chat">
            <Bubble role="byte" text={GREETING} />
            {msgs.map((m) => (
              <div key={m.id}>
                <Bubble role={m.role} text={m.text} />
                {m.note && <p className="muted small chat-note">{m.note}</p>}
                {m.estimate && <EstimateCard m={m} onAdd={() => add(m)} onSkip={() => skip(m)} onChange={(i, c) => changeItem(m, i, c)} onSlot={(slot) => update((all) => all.map((x) => (x.id === m.id ? { ...x, slot } : x)))} />}
              </div>
            ))}
            {busy && live && (
              <div className="bubble-row byte">
                <Mascot mood="talking" size={28} />
                <div className="bubble byte streaming" dir="auto">
                  {live}
                </div>
              </div>
            )}
            {busy && !live && (
              <div className="bubble byte typing" aria-label="Byte is thinking">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={end} />
          </div>
          {msgs.length === 0 && (
            <div className="chips">
              {EXAMPLES.map((x) => (
                <button key={x} className="chip" dir="auto" onClick={() => send(x)}>
                  {x}
                </button>
              ))}
            </div>
          )}
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <input dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you eat?" disabled={busy} />
            <button className="primary" disabled={busy || !text.trim()} aria-label="Send">
              ➤
            </button>
          </form>
          {msgs.length > 0 && (
            <button className="ghost small" onClick={() => update(() => [])}>
              Clear chat
            </button>
          )}
        </>
      )}
    </>
  )
}

function Bubble({ role, text }: { role: 'user' | 'byte'; text: string }) {
  return (
    <div className={`bubble-row ${role}`}>
      {role === 'byte' && <Mascot mood="idle" size={28} />}
      <div className={`bubble ${role}`} dir="auto">
        {text}
      </div>
    </div>
  )
}

function EstimateCard({
  m,
  onAdd,
  onSkip,
  onChange,
  onSlot,
}: {
  m: Msg
  onAdd: () => void
  onSkip: () => void
  onChange: (idx: number, c: { grams?: number; foodId?: number }) => void
  onSlot: (s: MealSlot) => void
}) {
  const e = m.estimate!
  const open = m.state === 'open'
  const missing = e.items.filter((i) => i.foodId === null)
  return (
    <section className={`card estimate ${m.state}`}>
      <ul className="list">
        {e.items.map((it, i) => (
          // key includes grams/food so the row's draft input resets when the item is rebuilt
          <EstimateRow key={`${i}-${it.foodId}-${it.grams}`} it={it} open={open} onChange={(c) => onChange(i, c)} />
        ))}
      </ul>
      <div className="estimate-total">
        <b>{e.total.kcal} kcal</b>
        <span className="muted">
          P {e.total.protein} · C {e.total.carbs} · F {e.total.fat}
        </span>
      </div>
      {missing.length > 0 && <p className="hint">Not in the database: {missing.map((i) => i.food).join(', ')} — left out of the total.</p>}
      {open ? (
        <>
          <p className="small">Want me to add this to today's total?</p>
          <div className="row">
            <select value={m.slot} onChange={(ev) => onSlot(ev.target.value as MealSlot)}>
              {Object.entries(SLOT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="primary" onClick={onAdd} disabled={missing.length === e.items.length}>
              Add to today
            </button>
            <button className="ghost" onClick={onSkip}>
              Skip
            </button>
          </div>
        </>
      ) : (
        <p className="muted small">{m.state === 'added' ? '✓ Added to today' : 'Skipped'}</p>
      )}
    </section>
  )
}

const HOW = { given: 'as you said', portion: 'USDA portion', generic: 'typical portion' }

function EstimateRow({ it, open, onChange }: { it: EstimateItem; open: boolean; onChange: (c: { grams?: number; foodId?: number }) => void }) {
  const [grams, setGrams] = useState(String(it.grams))
  return (
    <li className="estimate-row">
      <FoodIcon name={it.dbName ?? it.food} slot="dynamic1" size={36} />
      <div className="estimate-main">
        <div dir="auto">
          {it.amount} {it.unit === 'piece' ? '×' : it.unit} {it.food}
        </div>
        {it.foodId !== null ? (
          open && it.alternatives.length > 1 ? (
            <select className="estimate-food" value={it.foodId} onChange={(e) => onChange({ foodId: Number(e.target.value) })}>
              {it.alternatives.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <small className="muted">{it.dbName}</small>
          )
        ) : (
          <small className="conf low">no database match</small>
        )}
        <small className="muted">
          {it.macros.kcal} kcal · P {it.macros.protein} · {HOW[it.how]}
        </small>
      </div>
      {open && it.foodId !== null ? (
        <label className="estimate-grams">
          <input
            inputMode="decimal"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            onBlur={() => {
              const g = Number(grams)
              if (g > 0 && g < 5000 && g !== it.grams) onChange({ grams: Math.round(g) })
              else setGrams(String(it.grams))
            }}
          />
          <span>g</span>
        </label>
      ) : (
        <span className="num muted">{it.grams} g</span>
      )}
    </li>
  )
}
