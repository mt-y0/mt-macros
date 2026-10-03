// Byte, the food-logging agent. Division of labour (project rule: numbers never come from the LLM):
//   1. the on-device model (this file) reads the message and returns JSON: a short funny reply + foods with amount & unit;
//   2. estimate.ts looks each food up in the bundled USDA database and computes grams + macros deterministically.
// If the model's JSON is unusable, estimate.ts's rule-based parser takes over so the user still gets an estimate.
import type { ChatCompletionMessage } from '@wllama/wllama'
import { FOOD_UNITS, type FoodUnit } from '../logic'
import { completeJSON } from './engine'
import { looksLikeFood, reconcile, ruleParse, type ParsedItem } from './estimate'

const SYSTEM = `You are Byte, a tiny square robot buddy inside a food-tracking app for someone bulking (eating more to gain weight).
Personality: cheerful, cheeky, dramatic about food, loves puns, hypes the user up for eating enough. Keep "reply" to 1-2 short, funny sentences.
Never write calorie or macro numbers yourself: the app's food database calculates them. No medical advice.
Task: read what the user ate and list each food separately in "items":
- "food": a short, simple English food name (translate Arabic, e.g. تمن -> rice, دولمة -> dolma).
- "amount": a number (2 eggs -> 2; "a bowl" -> 1; "half" -> 0.5). Default 1.
- "unit": one of ${FOOD_UNITS.join(', ')}. Use "piece" for countable things (eggs, bananas, dates, sandwiches).
If the message is not about food, reply in character and return "items": [].`

// Two short examples: tiny models follow examples far better than rules.
const EXAMPLES: ChatCompletionMessage[] = [
  { role: 'user', content: '2 eggs and a bowl of rice' },
  { role: 'assistant', content: '{"reply":"Eggs-cellent! Those gains are officially hatching. 🐣","items":[{"food":"egg","amount":2,"unit":"piece"},{"food":"rice","amount":1,"unit":"bowl"}]}' },
  { role: 'user', content: 'hi byte' },
  { role: 'assistant', content: '{"reply":"Beep boop! Feed me your meals, human. I promise not to judge the midnight snacks.","items":[]}' },
  { role: 'user', content: 'اكلت ثلاث تمرات وكوب حليب' },
  { role: 'assistant', content: '{"reply":"Dates and milk? Old-school power combo. Grandma approves.","items":[{"food":"dates","amount":3,"unit":"piece"},{"food":"milk","amount":1,"unit":"cup"}]}' },
]

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    items: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          food: { type: 'string' },
          amount: { type: 'number' },
          unit: { type: 'string', enum: [...FOOD_UNITS] },
        },
        required: ['food', 'amount', 'unit'],
      },
    },
  },
  required: ['reply', 'items'],
}

export type Turn = { role: 'user' | 'byte'; text: string }

/** Ask the model; returns its reply + parsed items (falls back to the rule parser for items). */
/**
 * The "reply" string from a partly streamed JSON answer (`{"reply":"Eggs-cel` → `Eggs-cel`). The schema puts
 * "reply" first, so it streams before the items.
 */
export function partialReply(raw: string): string {
  const m = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (!m) return ''
  const body = m[1].replace(/\\$/, '') // drop a half-received escape
  try {
    return JSON.parse(`"${body}"`) as string
  } catch {
    return body
  }
}

export async function askByte(
  message: string,
  history: Turn[],
  opts: { signal?: AbortSignal; onReply?: (soFar: string) => void } = {},
): Promise<{ reply: string; items: ParsedItem[]; fallback: boolean }> {
  // Only the last exchange as context: phones are slow and the task is per-message.
  const recent: ChatCompletionMessage[] = history.slice(-2).map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text }))
  const raw = await completeJSON([{ role: 'system', content: SYSTEM }, ...EXAMPLES, ...recent, { role: 'user', content: message }], SCHEMA, {
    signal: opts.signal,
    onText: opts.onReply && ((t) => opts.onReply!(partialReply(t))),
  })
  try {
    const j = JSON.parse(raw) as { reply?: unknown; items?: unknown }
    const items = Array.isArray(j.items) ? j.items.map(cleanItem).filter((x): x is ParsedItem => !!x) : []
    const reply = spice(typeof j.reply === 'string' ? j.reply.trim() : '')
    if (items.length === 0 && looksLikeFood(message)) return { reply, items: ruleParse(message), fallback: true }
    // Tiny models shuffle units ("3 plate egg") and copy their examples; ground the items in the user's own words.
    const grounded = reconcile(items, ruleParse(message), message)
    if (grounded.length === 0 && looksLikeFood(message)) return { reply, items: ruleParse(message), fallback: true }
    return { reply, items: grounded, fallback: false }
  } catch {
    return { reply: "My circuits got saucy — here's my best guess.", items: ruleParse(message), fallback: true }
  }
}

// Tiny models often answer politely and flatly; Byte adds one of its own lines so the personality survives.
const QUIPS = ['Nom-nom protocol engaged. 🤖', 'My circuits are drooling.', 'Bulk mode: ON. 💪', 'Chef’s kiss from a square face. 😘', 'That’s some premium fuel.', 'Gains detected. Beep!']
function spice(raw: string): string {
  const reply = raw.replace(/[\s,;:–-]+$/u, '') // small models trail off with "…🍀,"
  const quip = QUIPS[Math.floor(Math.random() * QUIPS.length)]
  if (!reply) return quip
  return /[!?😀-🙏🤖💪🐣]/u.test(reply) ? reply : `${reply} ${quip}`
}

function cleanItem(x: unknown): ParsedItem | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const food = typeof o.food === 'string' ? o.food.trim().slice(0, 60) : ''
  if (!food) return null
  const amount = typeof o.amount === 'number' && o.amount > 0 && o.amount < 5000 ? o.amount : 1
  const unit = FOOD_UNITS.includes(o.unit as FoodUnit) ? (o.unit as FoodUnit) : 'serving'
  return { food, amount, unit }
}

