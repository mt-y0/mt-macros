// Small free on-device models (GGUF, run by wllama = llama.cpp in WebAssembly) and a live lookup on Hugging Face.
// Nothing here is bundled: the user downloads a model from Settings → AI brain.

export type ModelInfo = {
  /** Download URL — also the model's id in the wllama cache. */
  url: string
  name: string
  repo: string
  file: string
  sizeMB: number
  license: string
  note?: string
  /** Extra chat template args (e.g. turn off Qwen3 "thinking", which only slows a phone down). */
  templateKwargs?: Record<string, unknown>
}

const hf = (repo: string, file: string) => `https://huggingface.co/${repo}/resolve/main/${file}`

const m = (name: string, repo: string, file: string, sizeMB: number, license: string, note?: string, templateKwargs?: Record<string, unknown>): ModelInfo => ({
  url: hf(repo, file),
  name,
  repo,
  file,
  sizeMB,
  license,
  note,
  templateKwargs,
})

/** Hand-picked: small enough for a phone, good at following the JSON format, free licences. Smallest first. */
export const CATALOG: ModelInfo[] = [
  m('Gemma 3 270M', 'ggml-org/gemma-3-270m-it-GGUF', 'gemma-3-270m-it-Q8_0.gguf', 292, 'Gemma', 'Tiniest and fastest; weakest at understanding mixed meals'),
  m('SmolLM2 360M', 'HuggingFaceTB/SmolLM2-360M-Instruct-GGUF', 'smollm2-360m-instruct-q8_0.gguf', 386, 'Apache-2.0', 'Very small; English only'),
  m('Qwen3 0.6B', 'unsloth/Qwen3-0.6B-GGUF', 'Qwen3-0.6B-Q4_K_M.gguf', 397, 'Apache-2.0', 'Newer Qwen, understands Arabic', { enable_thinking: false }),
  m('Qwen2.5 0.5B', 'Qwen/Qwen2.5-0.5B-Instruct-GGUF', 'qwen2.5-0.5b-instruct-q4_k_m.gguf', 491, 'Apache-2.0', 'Recommended — the lowest Qwen, reliable JSON, some Arabic'),
  m('Qwen2.5 1.5B', 'Qwen/Qwen2.5-1.5B-Instruct-GGUF', 'qwen2.5-1.5b-instruct-q4_k_m.gguf', 1117, 'Apache-2.0', 'Smarter but slow; needs a phone with 6 GB+ RAM'),
]

export const RECOMMENDED_URL = CATALOG[3].url

/** Rough download budget from the phone's RAM (navigator.deviceMemory is capped at 8 and rounded). */
export function deviceBudgetMB(): { ramGB: number | null; budgetMB: number } {
  const ram = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null
  const budgetMB = ram === null ? 700 : ram >= 8 ? 1300 : ram >= 6 ? 1000 : ram >= 4 ? 700 : 450
  return { ramGB: ram, budgetMB }
}

export type Fit = 'good' | 'tight' | 'heavy'
export function fitFor(sizeMB: number, budgetMB: number): Fit {
  return sizeMB <= budgetMB * 0.75 ? 'good' : sizeMB <= budgetMB ? 'tight' : 'heavy'
}

const FREE_LICENSES = ['apache-2.0', 'mit', 'gemma', 'llama3.2', 'llama3.1', 'llama3']
const SEARCHES = ['qwen2.5 0.5b instruct gguf', 'qwen3 0.6b gguf', 'smollm2 instruct gguf', 'gemma-3-270m-it gguf', 'llama-3.2-1b-instruct gguf']

type HfModel = { id: string; tags?: string[]; downloads?: number }
type HfFile = { type: string; path: string; size: number }

/**
 * "Find compatible models": asks Hugging Face (user-initiated, needs internet) for small instruct GGUF models
 * with a free licence, picks one Q4_K_M / Q4_0 / Q8_0 file per repo, checks live sizes of the catalogue too.
 * Returns models that fit the phone first, then by size.
 */
export async function findCompatibleModels(signal?: AbortSignal): Promise<(ModelInfo & { fit: Fit; downloads?: number })[]> {
  const { budgetMB } = deviceBudgetMB()
  const get = async <T,>(url: string) => {
    const r = await fetch(url, { signal })
    if (!r.ok) throw new Error(`Hugging Face: HTTP ${r.status}`)
    return (await r.json()) as T
  }
  const repos = new Map<string, HfModel>()
  for (const c of CATALOG) repos.set(c.repo, { id: c.repo })
  const found = await Promise.all(
    SEARCHES.map((q) => get<HfModel[]>(`https://huggingface.co/api/models?search=${encodeURIComponent(q)}&filter=gguf&sort=downloads&direction=-1&limit=6`).catch(() => [])),
  )
  for (const list of found)
    for (const r of list) {
      const lic = r.tags?.find((t) => t.startsWith('license:'))?.slice(8)
      if (lic && FREE_LICENSES.includes(lic) && /instruct|-it\b|chat|qwen3/i.test(r.id)) repos.set(r.id, repos.get(r.id) ?? r)
    }

  const out: (ModelInfo & { fit: Fit; downloads?: number })[] = []
  await Promise.all(
    [...repos.values()].slice(0, 16).map(async (r) => {
      const files = await get<HfFile[]>(`https://huggingface.co/api/models/${r.id}/tree/main`).catch(() => [])
      const ggufs = files.filter((f) => f.type === 'file' && f.path.endsWith('.gguf') && !/mmproj|-of-\d+/i.test(f.path))
      const known = CATALOG.find((c) => c.repo === r.id)
      const pick = known
        ? ggufs.find((f) => f.path === known.file)
        : (['q4_k_m', 'q4_0', 'q8_0'].map((q) => ggufs.find((f) => f.path.toLowerCase().includes(q))).find(Boolean) ?? undefined)
      if (!pick) return
      const sizeMB = Math.round(pick.size / 1e6)
      if (sizeMB > 2000) return // wllama/ArrayBuffer limit and far too big for a phone anyway
      const lic = r.tags?.find((t) => t.startsWith('license:'))?.slice(8)
      out.push({
        ...(known ?? m(r.id.split('/')[1].replace(/-GGUF$/i, ''), r.id, pick.path, sizeMB, lic ?? 'see model card')),
        sizeMB,
        fit: fitFor(sizeMB, budgetMB),
        downloads: r.downloads,
      })
    }),
  )
  const order: Record<Fit, number> = { good: 0, tight: 1, heavy: 2 }
  return out.sort((a, b) => order[a.fit] - order[b.fit] || a.sizeMB - b.sizeMB)
}
