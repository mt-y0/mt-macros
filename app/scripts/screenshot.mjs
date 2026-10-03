// Phone-sized screenshot of the running dev server via the Chrome DevTools protocol (needs `chromium`).
// Opens a VISIBLE Chromium window so the user can see what's tested (HEADLESS=1 hides it).
// Usage: node scripts/screenshot.mjs <url> <out.png> [light|dark] [TabLabel|LOG|SPLASH|DROP]
//   TabLabel = text of a bottom tab to click (Food, Byte, Days, Weight, Sleep, Meals, Settings)
//   LOG      = tap the first 3 usual meals first (fills the plate; writes to that browser profile only)
//   prefs    = optional JSON merged into the device prefs (prefs.ts), e.g. '{"theme":"dark","accent":"orange"}'
//   SPLASH / DROP = capture the intro splash while it holds / while its columns are falling
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const [, , url, out, scheme = 'light', tab = '', prefs = ''] = process.argv
const port = 9300 + Math.floor(Math.random() * 500)
const headless = process.env.HEADLESS === '1' ? ['--headless=new'] : ['--window-size=440,1000'] // visible by default: the user watches
const chrome = spawn('chromium', [...headless, '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mt-shot-'))}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
for (let i = 0; i < 40; i++) {
  try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = t.find((x) => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break } } catch {}
  await sleep(250)
}
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url })
if (prefs) {
  await sleep(800)
  await send('Runtime.evaluate', { expression: `localStorage.setItem('mt-prefs', ${JSON.stringify(prefs)}); location.reload()` })
}
if (tab === 'SPLASH' || tab === 'DROP') {
  await sleep(tab === 'SPLASH' ? 1200 : 2350)
  writeFileSync(out, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  ws.close(); chrome.kill(); process.exit(0)
}
await sleep(3300) // past the intro splash
if (tab === 'LOG') { await send('Runtime.evaluate', { expression: "document.querySelectorAll('.quick-main').forEach((b,i)=>i<3&&b.click())" }); await sleep(1200) } else if (tab) { await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('.tabs button')].find(b=>b.textContent.includes('${tab}'))?.click()` }); await sleep(1200) }
const { result } = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true })
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: Math.min(result.value, 2400), deviceScaleFactor: 2, mobile: true })
await sleep(500)
const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(out, Buffer.from(shot.data, 'base64'))
ws.close(); chrome.kill()
process.exit(0)
