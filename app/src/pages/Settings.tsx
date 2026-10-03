import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { cancelDownload, deleteModel, downloadedModels, downloadModel, modelInfo, unload, useEngine } from '../ai/engine'
import { CATALOG, deviceBudgetMB, findCompatibleModels, fitFor, RECOMMENDED_URL, type Fit, type ModelInfo } from '../ai/models'
import { db, exportBackup, getTargets, importBackup, TARGET_PRESETS, type Targets } from '../db'
import { targetsError, todayISO } from '../logic'
import Mascot from '../Mascot'
import { ACCENT_KEYS, PALETTES, variant, type Corners, type Shadows } from '../palettes'
import { resetPrefs, setPref, usePrefs, type ThemeMode, type Transition } from '../prefs'
import { sfx } from '../sound'
import { Card, NumField } from '../ui'

export default function Settings() {
  const saved = useLiveQuery(getTargets)
  const [msg, setMsg] = useState('')
  // Remount the form whenever stored targets change (preset, weight-advice "Apply", import).
  return saved ? <SettingsForm key={JSON.stringify(saved)} saved={saved} msg={msg} setMsg={setMsg} /> : null
}

function SettingsForm({ saved, msg, setMsg }: { saved: Targets; msg: string; setMsg: (m: string) => void }) {
  const [t, setT] = useState<Targets>(saved)
  const error = targetsError(t)

  async function save(next: Targets) {
    if (targetsError(next)) return
    await db.settings.put({ key: 'targets', value: next })
    setMsg('Targets saved.')
  }

  async function doExport() {
    const blob = new Blob([JSON.stringify(await exportBackup(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mt-macro-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function doImport(file: File) {
    if (!confirm('Replace ALL current data with this backup?')) return
    try {
      await importBackup(JSON.parse(await file.text()))
      setMsg('Backup restored.')
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Targets & backup</p>
          <h1>Settings</h1>
        </div>
      </header>
      <Card title="Daily targets">
        <div className="chips">
          <button className="chip" onClick={() => save(TARGET_PRESETS.standard)}>
            Standard bulk (3,000)
          </button>
          <button className="chip" onClick={() => save(TARGET_PRESETS.aggressive)}>
            Aggressive bulk (3,300)
          </button>
        </div>
        <div className="grid2">
          <NumField label="kcal" value={t.kcal} onChange={(kcal) => setT({ ...t, kcal })} />
          <NumField label="Protein g" value={t.protein} onChange={(protein) => setT({ ...t, protein })} />
          <NumField label="Carbs g" value={t.carbs} onChange={(carbs) => setT({ ...t, carbs })} />
          <NumField label="Fat g" value={t.fat} onChange={(fat) => setT({ ...t, fat })} />
          <NumField label="Water L" step={0.5} value={t.waterL} onChange={(waterL) => setT({ ...t, waterL })} />
          <NumField label="Creatine g" value={t.creatineG} onChange={(creatineG) => setT({ ...t, creatineG })} />
        </div>
        {error && <p className="hint">{error}</p>}
        <button className="primary" onClick={() => save(t)} disabled={!!error}>
          Save targets
        </button>
      </Card>

      <Card title="Backup">
        <div className="row wrap">
          <button onClick={doExport}>Export JSON</button>
          <label className="button">
            Import JSON
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
            />
          </label>
        </div>
        <p className="muted small">All data stays on this device. Export regularly.</p>
      </Card>

      <AiCard />
      <LookCard />
      <SoundCard />

      {msg && <p className="toast">{msg}</p>}
      <p className="muted small center">Informational guidance only — not medical advice.</p>
      <p className="muted small center">Food data: USDA FoodData Central (public domain). Food icons: Microsoft Fluent Emoji (MIT).</p>
    </>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="chips segmented">
      {options.map(([v, label]) => (
        <button key={v} className={`chip ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function SoundCard() {
  const p = usePrefs()
  return (
    <Card title="Sound & feel">
      <div className="form">
        <label className="check">
          <input type="checkbox" checked={p.sound} onChange={(e) => setPref('sound', e.target.checked)} />
          8-bit sound effects
        </label>
        <label className="field">
          <span>Volume · {p.volume}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={p.volume}
            disabled={!p.sound}
            onChange={(e) => setPref('volume', Number(e.target.value))}
            onPointerUp={() => sfx.coin()}
            onKeyUp={() => sfx.blip()}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={p.vibrate} onChange={(e) => setPref('vibrate', e.target.checked)} />
          Vibrate on tap
        </label>
      </div>
    </Card>
  )
}

function LookCard() {
  const p = usePrefs()
  const dark = document.documentElement.dataset.theme === 'dark'
  const fam = PALETTES.find((f) => f.id === p.palette) ?? PALETTES[0]
  const cur = variant(fam, dark).core
  return (
    <Card title="Look">
      <div className="form">
        <div className="field">
          <span>Palette</span>
          <div className="palettes">
            {PALETTES.map((f) => {
              const v = variant(f, dark).core
              return (
                <button key={f.id} className={`palette ${p.palette === f.id ? 'on' : ''}`} onClick={() => setPref('palette', f.id)} style={{ background: v.bg, color: v.ink, borderColor: p.palette === f.id ? v.accent : v.line }}>
                  <span className="palette-swatches">
                    {[v.surface, v.accent, v.orange, v.lavender, v.sand, v.red].map((x, i) => (
                      <i key={i} style={{ background: x }} />
                    ))}
                  </span>
                  <span className="palette-name">{f.name}</span>
                  <small style={{ color: v.muted }}>{f.light && f.dark ? 'light + dark' : f.dark ? 'dark only' : 'light only'}</small>
                </button>
              )
            })}
          </div>
        </div>
        <div className="field">
          <span>Mode{!(fam.light && fam.dark) && ' — this palette has one mode only'}</span>
          <Segmented<ThemeMode>
            value={p.theme}
            options={[
              ['auto', 'Auto'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ]}
            onChange={(v) => setPref('theme', v)}
          />
        </div>
        <div className="field">
          <span>Accent colour</span>
          <div className="chips segmented">
            {ACCENT_KEYS.map(([k, label]) => (
              <button key={k} className={`chip swatch ${p.accent === k ? 'on' : ''}`} onClick={() => setPref('accent', k)}>
                <i aria-hidden style={{ background: cur[k] }} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Corners</span>
          <Segmented<Corners>
            value={p.corners}
            options={[
              ['square', 'Square'],
              ['pixel', 'Soft'],
              ['round', 'Round'],
            ]}
            onChange={(v) => setPref('corners', v)}
          />
        </div>
        <div className="field">
          <span>Shadows</span>
          <Segmented<Shadows>
            value={p.shadows}
            options={[
              ['hard', 'Pixel'],
              ['soft', 'Soft'],
              ['none', 'Flat'],
            ]}
            onChange={(v) => setPref('shadows', v)}
          />
        </div>
        <div className="field">
          <span>Page transition</span>
          <Segmented<Transition>
            value={p.transition}
            options={[
              ['slide', 'Slide'],
              ['pixel', 'Pixel'],
              ['none', 'None'],
            ]}
            onChange={(v) => setPref('transition', v)}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={p.splash} onChange={(e) => setPref('splash', e.target.checked)} />
          Intro splash on launch
        </label>
        <button className="ghost" onClick={resetPrefs}>
          Reset look &amp; sound
        </button>
      </div>
    </Card>
  )
}

const FIT_LABEL: Record<Fit, string> = { good: 'fits your phone', tight: 'tight fit', heavy: 'too big for this phone' }

function AiCard() {
  const p = usePrefs()
  const engine = useEngine()
  const [have, setHave] = useState<{ url: string; sizeMB: number }[]>([])
  const [found, setFound] = useState<(ModelInfo & { fit: Fit })[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState('')
  const { ramGB, budgetMB } = deviceBudgetMB()

  const refresh = () => downloadedModels().then(setHave).catch(() => setHave([]))
  useEffect(() => {
    void refresh()
  }, [engine.kind])

  async function find() {
    setSearching(true)
    setErr('')
    try {
      setFound(await findCompatibleModels())
    } catch (e) {
      setErr(`Couldn't reach Hugging Face — are you online? (${(e as Error).message})`)
    } finally {
      setSearching(false)
    }
  }

  const list = found ?? CATALOG.map((m) => ({ ...m, fit: fitFor(m.sizeMB, budgetMB) }))
  const dl = engine.kind === 'downloading' ? engine : null

  return (
    <Card title="AI brain" art={<Mascot mood={p.aiModel ? 'happy' : 'sleeping'} size={40} />}>
      <p className="muted small">
        Byte runs a small AI model <b>on your phone</b> (no account, no cloud). It isn't in the app — download one here once (Wi-Fi
        recommended), then it works offline. Calories always come from the bundled USDA food database, never from the AI.
      </p>
      <p className="small">
        This phone: {ramGB ? `~${ramGB} GB RAM` : 'RAM unknown'} → models up to ~{budgetMB} MB should run.
      </p>

      {have.length > 0 && (
        <ul className="list">
          {have.map((h) => {
            const info = modelInfo(h.url)
            const active = p.aiModel === h.url
            return (
              <li key={h.url}>
                <div>
                  <div>
                    {info.name} {active && <span className="badge">in use</span>}
                  </div>
                  <small className="muted">{h.sizeMB} MB downloaded</small>
                </div>
                <div className="row">
                  {!active && (
                    <button className="chip" onClick={() => void unload().then(() => setPref('aiModel', h.url))}>
                      Use
                    </button>
                  )}
                  <button className="ghost" onClick={() => confirm(`Delete ${info.name} (${h.sizeMB} MB)?`) && void deleteModel(h.url).then(refresh)}>
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {dl && (
        <div className="download">
          <div className="bar-label">
            <span>Downloading {modelInfo(dl.url).name}…</span>
            <span className="num">{dl.total ? `${Math.round((dl.loaded / dl.total) * 100)}%` : `${Math.round(dl.loaded / 1e6)} MB`}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${dl.total ? (dl.loaded / dl.total) * 100 : 3}%` }} />
          </div>
          <button className="ghost" onClick={cancelDownload}>
            Cancel
          </button>
        </div>
      )}
      {engine.kind === 'error' && <p className="hint">{engine.message}</p>}
      <label className="check">
        <input type="checkbox" checked={p.aiGpu} onChange={(e) => void unload().then(() => setPref('aiGpu', e.target.checked))} />
        Use the GPU when the phone supports it (turn off if answers are slow or broken)
      </label>

      <h3 className="ai-sub">{found ? 'Compatible models found' : 'Suggested models'}</h3>
      <ul className="list">
        {list.map((m) => {
          const downloaded = have.some((h) => h.url === m.url)
          return (
            <li key={m.url}>
              <div>
                <div>
                  {m.name} {m.url === RECOMMENDED_URL && <span className="badge">recommended</span>}
                </div>
                <small className="muted">
                  {m.sizeMB} MB · {m.license} · <span className={`fit ${m.fit}`}>{FIT_LABEL[m.fit]}</span>
                  {m.note && <> — {m.note}</>}
                </small>
              </div>
              {downloaded ? (
                <span className="muted small">✓ have it</span>
              ) : (
                <button className={m.url === RECOMMENDED_URL ? 'primary' : ''} disabled={!!dl} onClick={() => void downloadModel(m.url).then(refresh)}>
                  Download
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <button className="wide" onClick={find} disabled={searching}>
        {searching ? 'Searching Hugging Face…' : 'Find compatible free models online'}
      </button>
      {err && <p className="hint">{err}</p>}
    </Card>
  )
}
