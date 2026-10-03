// Drives the app in a VISIBLE Chromium window (the user watches tests — see docs/development.md#testing) via the
// Chrome DevTools protocol, phone-sized (412×915).
// Usage: node scripts/drive.mjs <url> <profileDir> <outPrefix> <step...>
//   steps: js:<expr>  wait:<ms>  until:<expr>:<timeoutMs>  shot:<name> (→ <outPrefix>-<name>.png)
//   profileDir persists the browser storage — reuse it to keep a downloaded AI model between runs.
//   HEADLESS=1 hides the window (only when nobody can watch, e.g. CI).
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const [, , url, profile, out, ...steps] = process.argv
const port = 9800 + Math.floor(Math.random() * 100)
const headless = process.env.HEADLESS === '1' ? ['--headless=new'] : ['--window-size=440,1000']
const chrome = spawn('chromium', [...headless, '--enable-unsafe-webgpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
for (let i = 0; i < 40; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = t.find((x) => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break } } catch {} await sleep(250) }
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id) } else if (m.method === 'Runtime.consoleAPICalled') { console.log('[console]', m.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a.preview?.properties?.map(p=>p.name+'='+p.value))).join(' ').slice(0, 300)) } else if (m.method === 'Runtime.exceptionThrown') console.log('[exception]', (m.params.exceptionDetails.exception?.description ?? JSON.stringify(m.params.exceptionDetails)).slice(0, 900)) })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true })
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url }); await sleep(2500)
for (const s of steps) {
  const [kind, ...rest] = s.split(':'); const arg = rest.join(':')
  if (kind === 'js') console.log('js →', JSON.stringify(await ev(arg))?.slice(0, 300))
  else if (kind === 'wait') await sleep(Number(arg))
  else if (kind === 'until') { const i = arg.lastIndexOf(':'); const expr = arg.slice(0, i), to = Number(arg.slice(i + 1)); const t0 = Date.now(); let v; while (Date.now() - t0 < to) { v = await ev(expr); if (v) break; await sleep(1000) } console.log(`until (${Math.round((Date.now() - t0) / 1000)}s) →`, JSON.stringify(v)?.slice(0, 300)) }
  else if (kind === 'shot') { const { result } = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true }); await send('Emulation.setDeviceMetricsOverride', { width: 412, height: Math.min(result.value, 3000), deviceScaleFactor: 2, mobile: true }); await sleep(400); writeFileSync(`${out}-${arg}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true }); console.log('shot', arg) }
}
ws.close(); chrome.kill(); process.exit(0)
