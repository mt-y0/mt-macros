import type { ReactNode } from 'react'
import type { MealSlot } from './db'
import { foodIconUrl } from './foodIcons'

export function Card({
  title,
  children,
  right,
  art,
}: {
  title?: string
  children: ReactNode
  right?: ReactNode
  art?: ReactNode
}) {
  return (
    <section className="card">
      {(title || right) && (
        <header className="card-head">
          {art}
          {title && <h2>{title}</h2>}
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

export function Bar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="bar">
      <div className="bar-label">
        <span>{label}</span>
        <span className="num">
          {Math.round(value)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="bar-track">
        <div className={`bar-fill ${value >= target ? 'done' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  )
}

/** Calorie progress drawn as a dinner plate seen from above: the rim fills as the day is eaten. */
export function Plate({ value, target, children }: { value: number; target: number; children?: ReactNode }) {
  const r = 88
  const c = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const over = value > target
  return (
    <div className="plate">
      <svg viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="98" fill="var(--plate)" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--line)" strokeWidth="12" opacity="0.55" />
        {pct > 0 && (
        <circle
          className="plate-arc"
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={over ? 'var(--sand)' : 'var(--accent)'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          transform="rotate(-90 100 100)"
        />
        )}
        <circle cx="100" cy="100" r="70" fill="var(--plate-well)" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="var(--line)" strokeWidth="1" opacity="0.7" />
      </svg>
      <div className="plate-center">{children}</div>
    </div>
  )
}

/** Food icon (flat SVG from the bundled emoji set) picked from the meal name. */
export function FoodIcon({ name, slot, size = 48, className }: { name: string; slot: MealSlot; size?: number; className?: string }) {
  return <img className={`food-icon ${className ?? ''}`} src={foodIconUrl(name, slot)} width={size} height={size} alt="" draggable={false} />
}
