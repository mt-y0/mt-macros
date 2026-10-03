// Colour palettes (Settings → Look). Each family has a light and/or dark variant of a few core colours;
// every other design token is derived from them in paletteVars(). Families follow the well-known
// editor/terminal themes (Catppuccin, Gruvbox, Tokyo Night, Nord, Rosé Pine…) — Omarchy style.

export type Core = {
  bg: string
  surface: string
  ink: string
  muted: string
  line: string
  /** primary accent (buttons, progress) */
  accent: string
  orange: string
  lavender: string
  sand: string
  red: string
}
export type Family = { id: string; name: string; light?: Core; dark?: Core }

const c = (bg: string, surface: string, ink: string, muted: string, line: string, accent: string, orange: string, lavender: string, sand: string, red: string): Core => ({
  bg, surface, ink, muted, line, accent, orange, lavender, sand, red,
})

// prettier-ignore
export const PALETTES: Family[] = [
  { id: 'tigris', name: 'Tigris (default)',
    light: c('#e6efed', '#f6faf9', '#17302e', '#5b7572', '#c9dbd8', '#2f7d74', '#e8772e', '#7d80c6', '#d4ad68', '#b54a4a'),
    dark: c('#0b1615', '#12201e', '#dbeae7', '#87a29e', '#24403c', '#6fc2b4', '#f39a4f', '#a3a6e8', '#ddb876', '#f08a8a') },
  { id: 'catppuccin', name: 'Catppuccin',
    light: c('#e6e9ef', '#eff1f5', '#4c4f69', '#6c6f85', '#ccd0da', '#8839ef', '#fe640b', '#7287fd', '#df8e1d', '#d20f39'),
    dark: c('#181825', '#1e1e2e', '#cdd6f4', '#a6adc8', '#313244', '#cba6f7', '#fab387', '#b4befe', '#f9e2af', '#f38ba8') },
  { id: 'gruvbox', name: 'Gruvbox',
    light: c('#f2e5bc', '#fbf1c7', '#3c3836', '#7c6f64', '#d5c4a1', '#427b58', '#af3a03', '#8f3f71', '#b57614', '#9d0006'),
    dark: c('#1d2021', '#282828', '#ebdbb2', '#a89984', '#3c3836', '#8ec07c', '#fe8019', '#d3869b', '#fabd2f', '#fb4934') },
  { id: 'tokyo', name: 'Tokyo Night',
    light: c('#d0d5e3', '#e1e2e7', '#3760bf', '#6172b0', '#c4c8da', '#2e7de9', '#b15c00', '#9854f1', '#8c6c3e', '#f52a65'),
    dark: c('#16161e', '#1a1b26', '#c0caf5', '#a9b1d6', '#292e42', '#7aa2f7', '#ff9e64', '#bb9af7', '#e0af68', '#f7768e') },
  { id: 'nord', name: 'Nord',
    light: c('#e5e9f0', '#eceff4', '#2e3440', '#4c566a', '#d8dee9', '#5e81ac', '#d08770', '#b48ead', '#c29a4b', '#bf616a'),
    dark: c('#2e3440', '#3b4252', '#eceff4', '#a3acbd', '#434c5e', '#88c0d0', '#d08770', '#b48ead', '#ebcb8b', '#bf616a') },
  { id: 'rosepine', name: 'Rosé Pine',
    light: c('#f2e9e1', '#fffaf3', '#575279', '#797593', '#dfdad9', '#286983', '#d7827e', '#907aa9', '#ea9d34', '#b4637a'),
    dark: c('#191724', '#1f1d2e', '#e0def4', '#908caa', '#26233a', '#9ccfd8', '#ebbcba', '#c4a7e7', '#f6c177', '#eb6f92') },
  { id: 'everforest', name: 'Everforest',
    light: c('#f4f0d9', '#fdf6e3', '#5c6a72', '#829181', '#e0dcc7', '#35a77c', '#f57d26', '#df69ba', '#dfa000', '#f85552'),
    dark: c('#232a2e', '#2d353b', '#d3c6aa', '#9da9a0', '#3d484d', '#a7c080', '#e69875', '#d699b6', '#dbbc7f', '#e67e80') },
  { id: 'kanagawa', name: 'Kanagawa',
    light: c('#e5ddb0', '#f2ecbc', '#545464', '#8a8980', '#d5cea3', '#4d699b', '#cc6d00', '#624c83', '#77713f', '#c84053'),
    dark: c('#16161d', '#1f1f28', '#dcd7ba', '#727169', '#2a2a37', '#7e9cd8', '#ffa066', '#957fb8', '#e6c384', '#e82424') },
  { id: 'matte', name: 'Matte Black',
    dark: c('#0d0d0d', '#161616', '#eaeaea', '#8a8a8d', '#262626', '#e68e0d', '#e68e0d', '#a39ec4', '#d4a24c', '#d35f5f') },
  { id: 'osaka', name: 'Osaka Jade',
    dark: c('#111c18', '#182620', '#c1c497', '#7f8c78', '#23372b', '#2dd5b7', '#db9f3c', '#a197c7', '#c1c497', '#ff5345') },
  { id: 'ristretto', name: 'Ristretto',
    dark: c('#1a1514', '#2c2525', '#e6d9db', '#a39a90', '#403e41', '#85dacc', '#f38d70', '#a8a9eb', '#f9cc6c', '#fd6883') },
]

export type AccentKey = 'accent' | 'orange' | 'lavender' | 'sand' | 'red'
export const ACCENT_KEYS: [AccentKey, string][] = [
  ['accent', 'Palette'],
  ['orange', 'Orange'],
  ['lavender', 'Lavender'],
  ['sand', 'Gold'],
  ['red', 'Rose'],
]

export function family(id: string): Family {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

/** The variant to use: the requested mode if the family has it, else whichever it has. */
export function variant(f: Family, dark: boolean): { core: Core; dark: boolean } {
  if (dark && f.dark) return { core: f.dark, dark: true }
  if (!dark && f.light) return { core: f.light, dark: false }
  return f.dark ? { core: f.dark, dark: true } : { core: f.light!, dark: false }
}

/** Black or white text, whichever reads better on `hex`. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#14110f' : '#ffffff'
}

const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`

export type Corners = 'square' | 'pixel' | 'round'
export type Shadows = 'hard' | 'soft' | 'none'

/** All CSS custom properties for a palette variant + accent + shape choices. */
export function paletteVars(core: Core, dark: boolean, accent: AccentKey, corners: Corners, shadows: Shadows): Record<string, string> {
  const a = core[accent]
  const soft = (x: string) => mix(x, dark ? 22 : 18, core.surface)
  const deep = (x: string) => mix(x, 70, '#000')
  const inkOn = (x: string) => (dark ? mix(x, 75, '#fff') : deep(x))
  const radius = { square: ['2px', '2px'], pixel: ['8px', '6px'], round: ['20px', '12px'] }[corners]
  const shadowInk = dark ? 'rgb(0 0 0 / 0.45)' : mix(core.ink, 16, 'transparent')
  const shadow = {
    hard: `4px 4px 0 ${shadowInk}`,
    soft: dark ? '0 1px 2px rgb(0 0 0 / 0.3), 0 10px 30px -14px rgb(0 0 0 / 0.6)' : `0 1px 2px ${mix(core.ink, 5, 'transparent')}, 0 8px 24px -12px ${mix(core.ink, 18, 'transparent')}`,
    none: 'none',
  }[shadows]
  return {
    '--bg': core.bg,
    '--surface': core.surface,
    '--ink': core.ink,
    '--muted': core.muted,
    '--line': core.line,
    '--accent': a,
    '--accent-soft': soft(a),
    '--accent-text': textOn(a),
    '--orange': core.orange,
    '--orange-deep': deep(core.orange),
    '--orange-soft': soft(core.orange),
    '--orange-ink': inkOn(core.orange),
    '--orange-text': textOn(core.orange),
    '--lavender': core.lavender,
    '--lavender-soft': soft(core.lavender),
    '--lavender-text': textOn(core.lavender),
    '--sand': core.sand,
    '--banana': mix(core.sand, 75, '#fff6c8'),
    '--rice': dark ? mix(core.ink, 85, core.surface) : '#fbfaf4',
    '--plate': core.surface,
    '--plate-well': mix(core.ink, dark ? 6 : 5, core.surface),
    '--warn': dark ? core.sand : deep(core.sand),
    '--low': core.red,
    '--night-top': mix(core.lavender, dark ? 25 : 40, '#0b0d25'),
    '--night-bottom': mix(core.accent, 30, '#1a2a4a'),
    '--night-ink': '#070a1e',
    '--shadow': shadow,
    '--radius': radius[0],
    '--radius-sm': radius[1],
    'color-scheme': dark ? 'dark' : 'light',
  }
}
