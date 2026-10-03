import { useEffect, useState } from 'react'
import { sfx } from './sound'

// Intro: the logo screen holds for HOLD ms, then splits into 4 columns that fall away left → right:
// each starts after its left neighbour and falls a bit faster, but they still land in order.
const HOLD = 1600
const COLS = [
  { dur: 620, delay: 0 },
  { dur: 560, delay: 140 },
  { dur: 500, delay: 280 },
  { dur: 440, delay: 420 },
]
const END = HOLD + Math.max(...COLS.map((c) => c.dur + c.delay))

function SplashFace() {
  return (
    <div className="splash-face">
      <img className="splash-logo" src="/logo.svg" alt="" />
      <p className="splash-title">MT MACRO</p>
      <div className="splash-bar" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${150 + i * 110}ms` }} />
        ))}
      </div>
      <p className="splash-start">PRESS START</p>
    </div>
  )
}

export default function Splash({ onDone }: { onDone: () => void }) {
  const [drop, setDrop] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sfx.intro()
    const timers = [
      window.setTimeout(() => setDrop(true), HOLD),
      window.setTimeout(onDone, reduce ? HOLD + 300 : END),
    ]
    if (!reduce) COLS.forEach((c, i) => timers.push(window.setTimeout(() => sfx.thud(i), HOLD + c.delay)))
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  return (
    <div className={`splash ${drop ? 'drop' : ''}`} role="presentation">
      {COLS.map((c, i) => (
        <div
          key={i}
          className="splash-col"
          style={{ left: `${i * 25}%`, animationDuration: `${c.dur}ms`, animationDelay: `${c.delay}ms` }}
        >
          <div className="splash-inner" style={{ left: `${-i * 100}%` }}>
            <SplashFace />
          </div>
        </div>
      ))}
    </div>
  )
}
