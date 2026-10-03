// Byte — the AI buddy: a square with square eyes. Moods are drawn here; motion lives in index.css (.mascot.*).
export type Mood = 'idle' | 'thinking' | 'talking' | 'happy' | 'sad' | 'sleeping'

export default function Mascot({ mood = 'idle', size = 64 }: { mood?: Mood; size?: number }) {
  return (
    <svg className={`mascot ${mood}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <g className="m-body">
        {/* little feet + side nubs */}
        <rect x="26" y="84" width="10" height="8" fill="var(--orange-deep)" />
        <rect x="64" y="84" width="10" height="8" fill="var(--orange-deep)" />
        <rect x="6" y="46" width="8" height="14" fill="var(--orange-deep)" />
        <rect x="86" y="46" width="8" height="14" fill="var(--orange-deep)" />
        {/* the square */}
        <rect x="12" y="16" width="76" height="70" rx="6" fill="var(--orange)" />
        <rect x="12" y="74" width="76" height="12" rx="6" fill="var(--orange-deep)" opacity="0.35" />
        <rect x="18" y="20" width="22" height="5" rx="2" fill="#fff" opacity="0.25" />
        <g className="m-eyes">
          {mood === 'happy' ? (
            <>
              <path d="M28 46 l7-8 l7 8" />
              <path d="M58 46 l7-8 l7 8" />
            </>
          ) : mood === 'sleeping' ? (
            <>
              <rect x="27" y="44" width="16" height="4" />
              <rect x="57" y="44" width="16" height="4" />
            </>
          ) : (
            <>
              <rect className="m-eye" x="28" y={mood === 'sad' ? 42 : 34} width="14" height={mood === 'sad' ? 10 : 16} />
              <rect className="m-eye" x="58" y={mood === 'sad' ? 42 : 34} width="14" height={mood === 'sad' ? 10 : 16} />
              <rect x="34" y={mood === 'sad' ? 44 : 37} width="4" height="4" fill="#fff" />
              <rect x="64" y={mood === 'sad' ? 44 : 37} width="4" height="4" fill="#fff" />
            </>
          )}
        </g>
        <rect
          className="m-mouth"
          x={mood === 'happy' ? 40 : 44}
          y={mood === 'sad' ? 66 : 62}
          width={mood === 'happy' ? 20 : 12}
          height={mood === 'happy' ? 7 : 4}
          rx="1"
        />
      </g>
      {mood === 'thinking' && (
        <g className="m-dots">
          <rect x="62" y="2" width="6" height="6" />
          <rect x="72" y="2" width="6" height="6" />
          <rect x="82" y="2" width="6" height="6" />
        </g>
      )}
      {mood === 'sleeping' && (
        <text className="m-z" x="78" y="14">
          z
        </text>
      )}
    </svg>
  )
}
