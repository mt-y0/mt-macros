// On-device LLM runtime: wllama (llama.cpp → WebAssembly, WebGPU when available, else CPU in a worker).
// The library is lazy-loaded so the app starts fast and works fully without any model.
// Models are downloaded by the user (Settings → AI brain) into the browser's private storage (OPFS / Cache).
import { useSyncExternalStore } from 'react'
import type { ChatCompletionMessage, Model, Wllama } from '@wllama/wllama'
import wasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url'
import { getPrefs, setPref } from '../prefs'
import { CATALOG, type ModelInfo } from './models'

export type EngineState =
  | { kind: 'idle' } // no model loaded (maybe none downloaded)
  | { kind: 'downloading'; url: string; loaded: number; total: number }
  | { kind: 'loading'; url: string }
  | { kind: 'ready'; url: string; gpu: boolean }
  | { kind: 'thinking'; url: string }
  | { kind: 'error'; message: string }

let state: EngineState = { kind: 'idle' }
const listeners = new Set<() => void>()
function set(s: EngineState) {
  state = s
  listeners.forEach((l) => l())
}
/** State change from load/unload/chat — never hides a running download's progress (it owns the state until done). */
function settle(s: EngineState) {
  if (!downloadAbort) set(s)
}

export function useEngine(): EngineState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

const lib = () => import('@wllama/wllama')
let wllama: Wllama | null = null
let loadedUrl: string | null = null
let loadedGpu = true
let downloadAbort: AbortController | null = null

async function manager() {
  const { ModelManager } = await lib()
  return new ModelManager()
}

/** Models already downloaded on this device. */
export async function downloadedModels(): Promise<{ url: string; sizeMB: number }[]> {
  const models = await (await manager()).getModels()
  return models.map((m) => ({ url: m.url, sizeMB: Math.round(m.size / 1e6) }))
}

export function modelInfo(url: string): ModelInfo {
  const known = CATALOG.find((c) => c.url === url)
  if (known) return known
  const file = url.split('/').pop() ?? url
  const repo = url.match(/huggingface\.co\/([^/]+\/[^/]+)/)?.[1] ?? ''
  return { url, name: file.replace(/\.gguf$/i, ''), repo, file, sizeMB: 0, license: '' }
}

/** Download (user-initiated — the only runtime network use in the app). Selects the model when done. */
export async function downloadModel(url: string) {
  downloadAbort?.abort()
  downloadAbort = new AbortController()
  set({ kind: 'downloading', url, loaded: 0, total: 0 })
  try {
    // Ask the browser not to evict a multi-hundred-MB download under storage pressure.
    await navigator.storage?.persist?.().catch(() => false)
    await (await manager()).downloadModel(url, {
      signal: downloadAbort.signal,
      progressCallback: ({ loaded, total }) => set({ kind: 'downloading', url, loaded, total }),
    })
    setPref('aiModel', url)
    set({ kind: 'idle' })
  } catch (e) {
    set(downloadAbort.signal.aborted ? { kind: 'idle' } : { kind: 'error', message: `Download failed: ${(e as Error).message}` })
  } finally {
    downloadAbort = null
  }
}

export function cancelDownload() {
  downloadAbort?.abort()
}

export async function deleteModel(url: string) {
  if (loadedUrl === url) await unload()
  const m = (await (await manager()).getModels()).find((x) => x.url === url)
  await m?.remove()
  if (getPrefs().aiModel === url) setPref('aiModel', '')
  settle({ kind: 'idle' })
}

export async function unload() {
  await wllama?.exit().catch(() => {})
  wllama = null
  loadedUrl = null
  settle({ kind: 'idle' })
}

let loading: Promise<boolean> | null = null

/**
 * Load the selected model into memory (a few seconds; first time compiles the WASM). Concurrent calls share one load.
 * During a download only an already-loaded model is used — loading one would compete with the download for RAM.
 */
export function ensureLoaded(): Promise<boolean> {
  if (downloadAbort) return Promise.resolve(!!wllama && loadedUrl === getPrefs().aiModel)
  loading ??= load().finally(() => (loading = null))
  return loading
}

async function load(): Promise<boolean> {
  const url = getPrefs().aiModel
  if (!url) return false
  if (wllama && loadedUrl === url && loadedGpu === getPrefs().aiGpu) return true
  if (wllama) await unload()
  set({ kind: 'loading', url })
  try {
    const { Wllama } = await lib()
    const model: Model | undefined = (await (await manager()).getModels()).find((m) => m.url === url)
    if (!model) {
      setPref('aiModel', '')
      settle({ kind: 'idle' })
      return false
    }
    const w = new Wllama({ default: wasmUrl }, { allowOffline: true, suppressNativeLog: true })
    // n_gpu_layers 0 = CPU only (Settings → AI brain → Use GPU off); default lets wllama use WebGPU when present.
    await w.loadModel(model, { n_ctx: 2048, n_batch: 512, ...(getPrefs().aiGpu ? {} : { n_gpu_layers: 0 }) })
    wllama = w
    loadedUrl = url
    loadedGpu = getPrefs().aiGpu
    settle({ kind: 'ready', url, gpu: getPrefs().aiGpu && w.isSupportWebGPU() })
    return true
  } catch (e) {
    wllama = null
    settle({ kind: 'error', message: `Couldn't start the model: ${(e as Error).message}` })
    return false
  }
}

/**
 * One chat completion constrained to a JSON schema, **streamed**: `onText` gets the text so far after every
 * token (for word-by-word display). Resolves with the full raw text.
 */
export async function completeJSON(
  messages: ChatCompletionMessage[],
  schema: object,
  opts: { maxTokens?: number; signal?: AbortSignal; onText?: (soFar: string) => void } = {},
): Promise<string> {
  if (!(await ensureLoaded()) || !wllama || !loadedUrl)
    throw new Error(downloadAbort ? 'Still downloading the model — try again when it finishes' : 'No AI model loaded')
  const url = loadedUrl
  const kwargs = modelInfo(url).templateKwargs
  settle({ kind: 'thinking', url })
  let text = ''
  try {
    await wllama.createChatCompletion({
      messages,
      max_tokens: opts.maxTokens ?? 220,
      temperature: 0.4,
      top_p: 0.9,
      abortSignal: opts.signal,
      response_format: { type: 'json_schema', json_schema: { name: 'meal', schema, strict: true } },
      ...(kwargs ? { chat_template_kwargs: kwargs } : {}),
      stream: true,
      onData: (chunk) => {
        const piece = chunk.choices[0]?.delta?.content
        if (!piece) return
        text += piece
        opts.onText?.(text)
      },
    })
    return text
  } finally {
    settle({ kind: 'ready', url, gpu: getPrefs().aiGpu && (wllama?.isSupportWebGPU() ?? false) })
  }
}
