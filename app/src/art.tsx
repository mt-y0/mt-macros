// Hand-drawn flat illustrations for page headers + tab icons. Colors come from CSS variables so they follow light/dark mode.
// Food icons are not drawn here — see foodIcons.ts / FoodIcon (generated pixel sprites).

type P = { size?: number; className?: string }

export function Scale({ size = 56, className }: P) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <rect x="8" y="12" width="48" height="44" rx="12" fill="var(--plate)" stroke="var(--line)" strokeWidth="2" />
      <path d="M20 30a12 12 0 0 1 24 0z" fill="var(--accent)" opacity="0.18" />
      <path d="M32 30l6-8" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="30" r="2.5" fill="var(--ink)" />
      <rect x="18" y="42" width="10" height="6" rx="3" fill="var(--line)" />
      <rect x="36" y="42" width="10" height="6" rx="3" fill="var(--line)" />
    </svg>
  )
}

/** Night over the river: crescent moon, stars and date palms. Used as the Sleep header. */
export function NightPalms({ className }: P) {
  const palm = (x: number, h: number, s = 1) => (
    <g transform={`translate(${x} ${192 - h}) scale(${s})`} fill="var(--night-ink)">
      <path d={`M-1.5 0 q3 ${h / 2} 0 ${h} h3 q-2 -${h / 2} 1.5 -${h} z`} />
      <path d="M0 0c-8-6-18-6-26 0 9-2 17-1 26 2z" />
      <path d="M0 0c8-6 18-6 26 0-9-2-17-1-26 2z" />
      <path d="M0 0c-5-9-14-12-20-10 7 2 14 5 20 11z" />
      <path d="M0 0c5-9 14-12 20-10-7 2-14 5-20 11z" />
      <path d="M0 0c-1-8-4-14-9-17 3 5 6 11 9 17z" />
      <circle cx="-3" cy="4" r="2" />
      <circle cx="2" cy="5" r="2" />
    </g>
  )
  return (
    <svg viewBox="0 0 360 200" preserveAspectRatio="xMaxYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--night-top)" />
          <stop offset="1" stopColor="var(--night-bottom)" />
        </linearGradient>
      </defs>
      <rect width="360" height="200" fill="url(#dusk)" />
      <g fill="var(--star)">
        {[
          [210, 20], [236, 70], [262, 12], [330, 92], [190, 104], [348, 24], [222, 130], [168, 54], [276, 112],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={x % 3 === 0 ? 1.4 : 0.9} />
        ))}
      </g>
      <path d="M300 34a18 18 0 1 0 14 30 15 15 0 1 1-14-30z" fill="var(--star)" />
      <path d="M0 184c60-8 120-6 180 0s120 6 180-2v18H0z" fill="var(--night-ink)" opacity="0.5" />
      {palm(206, 82, 1)}
      {palm(246, 60, 0.8)}
      {palm(330, 72, 0.9)}
    </svg>
  )
}

// Tab bar icons (stroke style, inherit currentColor).
const I = (d: string) =>
  function Icon() {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    )
  }

export const TabIcons = {
  today: I('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z'),
  byte: I('M5 5h14v14H5zM9 10v2M15 10v2M10 15h4'),
  calendar: I('M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2'),
  weight: I('M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 11a4 4 0 0 1 8 0M12 11l2-2'),
  sleep: I('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'),
  recipes: I('M4 11h16M5 11c0 5 3 8 7 8s7-3 7-8M9 7c0-2 1-3 1-3M13 7c0-2 1-3 1-3'),
  settings: I('M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4'),
}
