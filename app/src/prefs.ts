// Per-device app preferences (look, sound, motion). Kept in localStorage, not in the Dexie DB,
// so they are not part of JSON backups and each phone/browser keeps its own.
import { useSyncExternalStore } from 'react'
import { family, paletteVars, variant, type AccentKey, type Corners, type Shadows } from './palettes'

export type ThemeMode = 'auto' | 'light' | 'dark'
export type Transition = 'slide' | 'pixel' | 'none'

export type Prefs = {
  sound: boolean
  volume: number // 0–100
  vibrate: boolean
  palette: string // palettes.ts family id
  theme: ThemeMode
  accent: AccentKey
  corners: Corners
  shadows: Shadows
  transition: Transition
  splash: boolean
  /** URL of the downloaded on-device model to use ('' = none) */
  aiModel: string
  /** let the AI use WebGPU when the WebView has it (off = CPU only) */
  aiGpu: boolean
}

export const DEFAULT_PREFS: Prefs = {
  sound: true,
  volume: 60,
  vibrate: true,
  palette: 'tigris',
  theme: 'auto',
  accent: 'accent',
  corners: 'pixel',
  shadows: 'hard',
  transition: 'slide',
  splash: true,
  aiModel: '',
  aiGpu: true,
}

const KEY = 'mt-prefs'
const listeners = new Set<() => void>()

function load(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    // Older builds stored only the sound switch.
    if (localStorage.getItem('mt-sound') === 'off' && saved.sound === undefined) saved.sound = false
    // 0.0.3 accents were 'teal' | 'orange' | 'lavender'.
    if ((saved.accent as string) === 'teal') saved.accent = 'accent'
    return { ...DEFAULT_PREFS, ...saved }
  } catch {
    return DEFAULT_PREFS
  }
}

let current = load()

export function getPrefs(): Prefs {
  return current
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  current = { ...current, [key]: value }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* storage blocked: keep for this session only */
  }
  applyPrefs()
  listeners.forEach((l) => l())
}

/** Back to default look & sound (keeps the AI model + GPU choice). */
export function resetPrefs() {
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]) if (k !== 'aiModel' && k !== 'aiGpu') setPref(k, DEFAULT_PREFS[k])
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getPrefs,
  )
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
darkQuery.addEventListener('change', () => applyPrefs())

/** Writes the palette as CSS variables on <html> (inline, so they beat index.css defaults) + data attributes. */
export function applyPrefs() {
  const el = document.documentElement
  const wantDark = current.theme === 'dark' || (current.theme === 'auto' && darkQuery.matches)
  const { core, dark } = variant(family(current.palette), wantDark)
  for (const [k, v] of Object.entries(paletteVars(core, dark, current.accent, current.corners, current.shadows))) el.style.setProperty(k, v)
  el.dataset.theme = dark ? 'dark' : 'light'
  el.dataset.transition = current.transition
}
