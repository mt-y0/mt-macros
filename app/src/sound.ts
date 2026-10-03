// 8-bit sound effects, synthesized with WebAudio square/triangle/noise voices — no audio files, works offline.
// On/off, volume and tap vibration come from the device prefs (prefs.ts).
import { getPrefs } from './prefs'

let ctx: AudioContext | null = null
let master: GainNode | null = null

function audio(): AudioContext | null {
  const { sound, volume } = getPrefs()
  if (!sound || volume <= 0) return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.connect(ctx.destination)
  }
  // 100 % volume = 0.3 gain; squared so the slider feels even to the ear.
  master!.gain.value = 0.3 * (volume / 100) ** 2
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

type Wave = 'square' | 'triangle' | 'sawtooth'

/** One chiptune note: `freq` Hz (or a slide [from, to]), starting `at` seconds from now. */
function tone(freq: number | [number, number], at: number, dur: number, wave: Wave = 'square', vol = 1) {
  const a = audio()
  if (!a || !master) return
  const t = a.currentTime + at
  const osc = a.createOscillator()
  const env = a.createGain()
  osc.type = wave
  const [f0, f1] = Array.isArray(freq) ? freq : [freq, freq]
  osc.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur)
  // Stepped envelope: instant attack, hold, quick release — the NES feel.
  env.gain.setValueAtTime(vol, t)
  env.gain.setValueAtTime(vol, t + dur * 0.7)
  env.gain.linearRampToValueAtTime(0, t + dur)
  osc.connect(env).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise(at: number, dur: number, vol = 0.6) {
  const a = audio()
  if (!a || !master) return
  const t = a.currentTime + at
  const len = Math.ceil(a.sampleRate * dur)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const data = buf.getChannelData(0)
  // Sample-and-hold noise (every 8th sample) sounds crunchier, like a hardware noise channel.
  let v = 0
  for (let i = 0; i < len; i++) {
    if (i % 8 === 0) v = Math.random() * 2 - 1
    data[i] = v * (1 - i / len)
  }
  const src = a.createBufferSource()
  const env = a.createGain()
  env.gain.value = vol
  src.buffer = buf
  src.connect(env).connect(master)
  src.start(t)
}

export const sfx = {
  /** Generic button tap. */
  blip: () => tone(880, 0, 0.05, 'square', 0.5),
  /** Switching tabs. */
  select: () => {
    tone(660, 0, 0.04)
    tone(990, 0.04, 0.06)
  },
  /** Logging / saving something — the coin. */
  coin: () => {
    tone(988, 0, 0.07)
    tone(1319, 0.07, 0.22)
  },
  /** Back / cancel / delete. */
  down: () => tone([520, 180], 0, 0.14, 'square', 0.5),
  /** A splash column landing. */
  thud: (i = 0) => {
    tone([220 - i * 25, 55], 0, 0.12, 'triangle', 1)
    noise(0, 0.07, 0.35)
  },
  /** Splash intro jingle. */
  intro: () => {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319]
    notes.forEach((f, i) => tone(f, i * 0.085, i === notes.length - 1 ? 0.3 : 0.08, 'square', 0.7))
    // bass line on the triangle channel
    ;[131, 196, 262].forEach((f, i) => tone(f, i * 0.2, 0.18, 'triangle', 0.9))
  },
}

/** Short buzz on tap (Android; ignored where unsupported). */
export function buzz(ms = 12) {
  if (getPrefs().vibrate) navigator.vibrate?.(ms)
}

/** Resume audio on the first touch (browsers block sound until a gesture; the Android app doesn't). */
export function unlockAudio() {
  const go = () => {
    audio()
    window.removeEventListener('pointerdown', go)
  }
  window.addEventListener('pointerdown', go)
}
