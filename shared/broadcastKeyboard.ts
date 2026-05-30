export type BroadcastButtonType = 'url' | 'web_app'

export interface BroadcastButtonInput {
  text: string
  type: BroadcastButtonType
  url?: string
}

export interface BroadcastKeyboardInput {
  enabled: boolean
  rows: BroadcastButtonInput[][]
}

const MAX_ROWS = 10
const MAX_BUTTONS_PER_ROW = 4
const MAX_TOTAL = 20
const TEXT_MAX = 64

export function defaultBroadcastKeyboard(): BroadcastKeyboardInput {
  return {
    enabled: true,
    rows: [[{ text: 'Открыть приложение', type: 'web_app', url: '' }]],
  }
}

function normalizeUrl(raw: string | undefined, allowEmpty: boolean): string | null {
  const u = (raw ?? '').trim()
  if (!u) return allowEmpty ? '' : null
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('t.me/')) return `https://${u}`
  return `https://${u.replace(/^\/+/, '')}`
}

export function buildBroadcastReplyMarkup(
  keyboard: BroadcastKeyboardInput | undefined,
  defaultWebAppUrl: string,
): { inline_keyboard: Record<string, unknown>[][] } | undefined {
  if (!keyboard?.enabled) return undefined

  const inline_keyboard: Record<string, unknown>[][] = []
  for (const row of keyboard.rows ?? []) {
    const built: Record<string, unknown>[] = []
    for (const b of row ?? []) {
      const text = (b.text ?? '').trim().slice(0, TEXT_MAX)
      if (!text) continue
      if (b.type === 'web_app') {
        const url = normalizeUrl(b.url, true) || defaultWebAppUrl
        if (!url) continue
        built.push({ text, web_app: { url } })
      } else {
        const url = normalizeUrl(b.url, false)
        if (!url) continue
        built.push({ text, url })
      }
    }
    if (built.length) inline_keyboard.push(built)
  }

  return inline_keyboard.length ? { inline_keyboard } : undefined
}

export function validateBroadcastKeyboard(
  keyboard: unknown,
): { ok: true; value: BroadcastKeyboardInput } | { ok: false; error: string } {
  if (!keyboard || typeof keyboard !== 'object') {
    return { ok: true, value: { enabled: false, rows: [] } }
  }
  const k = keyboard as BroadcastKeyboardInput
  if (typeof k.enabled !== 'boolean') {
    return { ok: false, error: 'keyboard.enabled must be boolean' }
  }
  if (!k.enabled) {
    return { ok: true, value: { enabled: false, rows: [] } }
  }
  if (!Array.isArray(k.rows)) {
    return { ok: false, error: 'keyboard.rows must be an array' }
  }
  if (k.rows.length > MAX_ROWS) {
    return { ok: false, error: `Max ${MAX_ROWS} rows` }
  }

  let total = 0
  const rows: BroadcastButtonInput[][] = []
  for (const row of k.rows) {
    if (!Array.isArray(row)) return { ok: false, error: 'Each row must be an array' }
    if (row.length > MAX_BUTTONS_PER_ROW) {
      return { ok: false, error: `Max ${MAX_BUTTONS_PER_ROW} buttons per row` }
    }
    const builtRow: BroadcastButtonInput[] = []
    for (const b of row) {
      if (!b || typeof b !== 'object') continue
      const text = String((b as BroadcastButtonInput).text ?? '').trim()
      const type = (b as BroadcastButtonInput).type
      if (!text) continue
      if (text.length > TEXT_MAX) {
        return { ok: false, error: `Button text max ${TEXT_MAX} chars` }
      }
      if (type !== 'url' && type !== 'web_app') {
        return { ok: false, error: 'Button type must be url or web_app' }
      }
      builtRow.push({
        text,
        type,
        url: typeof (b as BroadcastButtonInput).url === 'string' ? (b as BroadcastButtonInput).url : '',
      })
      total++
      if (total > MAX_TOTAL) return { ok: false, error: `Max ${MAX_TOTAL} buttons total` }
    }
    if (builtRow.length) rows.push(builtRow)
  }

  return { ok: true, value: { enabled: true, rows } }
}

export function keyboardSummary(keyboard: BroadcastKeyboardInput | undefined, lang: 'ru' | 'en'): string {
  if (!keyboard?.enabled) return lang === 'ru' ? 'без кнопок' : 'no buttons'
  const n = keyboard.rows.reduce((s, r) => s + r.length, 0)
  if (!n) return lang === 'ru' ? 'без кнопок' : 'no buttons'
  return lang === 'ru' ? `${n} кноп.` : `${n} btn.`
}

/** One full-width Telegram button (mini-app). */
export function buildSimpleButtonMarkup(
  buttonText: string,
  webAppUrl: string,
): { inline_keyboard: Record<string, unknown>[][] } | undefined {
  const text = buttonText.trim().slice(0, TEXT_MAX)
  if (!text) return undefined
  const url = (webAppUrl ?? '').trim()
  if (!url) return undefined
  return { inline_keyboard: [[{ text, web_app: { url } }]] }
}

export function simpleButtonSummary(buttonText: string | undefined, lang: 'ru' | 'en'): string {
  const t = (buttonText ?? '').trim()
  if (!t) return lang === 'ru' ? 'без кнопки' : 'no button'
  return lang === 'ru' ? `кнопка: ${t}` : `button: ${t}`
}
