// Generates the pixel-art app logo: a burger (orange bun, lettuce, tomato, cheese, patty) on a teal tile.
// Usage: node scripts/logo.mjs   → public/ icons + Android launcher icons and native splash
// (needs `rsvg-convert` and ImageMagick `magick`)
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// 16×16 pixel map. '.' = transparent.
const MAP = `
.TTTTTTTTTTTTTT.
TTTTTTTTTTTTTTTT
TTTTKKKKKKKKTTTT
TTKKbbBBsBBBKKTT
TKbbBsBBBBBsBOKT
TKbBBBBBsBBBOOKT
TKKKKKKKKKKKKKKT
KLLlLLlLLlLLlLLK
TKRRRRRRRRRRRRKT
TKCCCCCCCCCCCCKT
TKMCCMMMMMMCMMKT
TKMMmMMMmMMMMmKT
TKKKKKKKKKKKKKKT
TKBBBBBBBBBBBOKT
TTKKBBBBBBBOKKTD
TTTTKKKKKKKKTTDD`

const COLORS = {
  T: '#2f7d74', // tile — --accent
  D: '#24635c', // tile shadow
  K: '#17302e', // outline — --ink
  B: '#e8772e', b: '#f6a65a', O: '#b9561a', // bun — --orange, highlight, shade
  s: '#fbfaf4', // sesame — --rice
  L: '#7cc04b', l: '#4f9a2f', // lettuce
  R: '#d9483b', // tomato
  C: '#f2c94c', // cheese — --banana
  M: '#6b3a22', m: '#8f5332', // patty
}

function svg(map) {
  const rows = map.trim().split('\n')
  if (rows.length !== 16 || rows.some((r) => r.length !== 16)) throw new Error('MAP must be 16×16')
  let rects = ''
  rows.forEach((row, y) => {
    // merge horizontal runs of the same colour into one rect
    for (let x = 0; x < row.length; ) {
      const ch = row[x]
      let w = 1
      while (row[x + w] === ch) w++
      if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${COLORS[ch]}"/>`
      x += w
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects}</svg>\n`
}

const out = new URL('../public/', import.meta.url).pathname
writeFileSync(out + 'logo.svg', svg(MAP))
// Maskable: full-bleed square so launchers can crop it to any shape.
writeFileSync(out + 'logo-maskable.svg', svg(MAP.replaceAll('.', 'T')))

const png = (src, size, name) => execFileSync('rsvg-convert', ['-w', size, '-h', size, '-o', out + name, out + src])
png('logo.svg', '192', 'logo-192.png')
png('logo.svg', '512', 'logo-512.png')
png('logo-maskable.svg', '512', 'logo-maskable-512.png')
png('logo-maskable.svg', '180', 'apple-touch-icon.png')
console.log('logo written to public/')

// Android launcher icons + native splash (only if the Capacitor project exists).
const res = new URL('../android/app/src/main/res/', import.meta.url).pathname
const magick = (...args) => execFileSync('magick', args)
const SPLASH_BG = '#10201e' // --splash
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
try {
  for (const [d, k] of Object.entries(densities)) {
    if (!k) continue
    const dir = `${res}mipmap-${d}/`
    const icon = Math.round(48 * k), fg = Math.round(108 * k)
    // Legacy square/round icons: the maskable tile, pixel-scaled.
    magick(out + 'logo-maskable-512.png', '-filter', 'point', '-resize', `${icon}x${icon}`, dir + 'ic_launcher.png')
    magick(out + 'logo-maskable-512.png', '-filter', 'point', '-resize', `${icon}x${icon}`,
      '(', '-size', `${icon}x${icon}`, 'xc:none', '-fill', 'white', '-draw', `circle ${icon / 2},${icon / 2} ${icon / 2},0`, ')',
      '-compose', 'DstIn', '-composite', dir + 'ic_launcher_round.png')
    // Adaptive foreground: tile shrunk to 64dp inside the 108dp canvas so launcher masks never clip the burger.
    magick(out + 'logo-maskable-512.png', '-filter', 'point', '-resize', `${Math.round(64 * k)}x${Math.round(64 * k)}`,
      '-background', COLORS.T, '-gravity', 'center', '-extent', `${fg}x${fg}`, dir + 'ic_launcher_foreground.png')
  }
  // Pre-Android-12 splash images: logo centred on the splash colour.
  const splash = (file, w, h) => {
    const s = Math.round(Math.min(w, h) * 0.28)
    magick('-size', `${w}x${h}`, `xc:${SPLASH_BG}`, '(', out + 'logo-512.png', '-filter', 'point', '-resize', `${s}x${s}`, ')',
      '-gravity', 'center', '-composite', file)
  }
  splash(res + 'drawable/splash.png', 480, 320)
  const sizes = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] }
  for (const [d, [w, h]] of Object.entries(sizes)) {
    splash(`${res}drawable-port-${d}/splash.png`, w, h)
    splash(`${res}drawable-land-${d}/splash.png`, h, w)
  }
  console.log('android icons + splash written')
} catch (e) {
  console.warn('skipped android assets:', e.message)
}
