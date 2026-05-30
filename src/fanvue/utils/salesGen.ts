/* Deterministic fake sales / online counters.
   - Stats start from 2026-04-20 (no data before that day).
   - Online: 3..16 (with daytime curve).
   - Sales/day: 0..5, weighted (0,1,2 frequent; 3,4,5 rare).
   - Buyers are shown as fully anonymous handles (Клиент #A7K2 / Buyer #A7K2).
   - Each buyer also gets a deterministic generative avatar URL.
*/

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Date stats begin to be visible from this day (inclusive). */
export const STATS_START = new Date(2026, 3, 20) // April 20, 2026

export function dayKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function isBeforeStats(d: Date): boolean {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const b = new Date(STATS_START.getFullYear(), STATS_START.getMonth(), STATS_START.getDate()).getTime()
  return a < b
}

export interface FakeSale {
  /** Stable opaque id, used for avatar seed only. Never shown verbatim. */
  buyerId: string
  /** Short hash like "A7K2" — what users actually see in the UI. */
  handle: string
  /** Deterministic avatar URL (DiceBear). */
  avatar: string
  productIndex: 0 | 1
  ts: number
}

const HEX = '0123456789ABCDEF'.split('')
function shortHash(rng: () => number, len = 4) {
  let s = ''
  for (let i = 0; i < len; i++) s += HEX[Math.floor(rng() * HEX.length)]
  return s
}

/** Weighted distribution for daily sales count. */
function pickSalesCount(rng: () => number): number {
  const r = rng()
  // 0:25%, 1:30%, 2:25%, 3:12%, 4:6%, 5:2%
  if (r < 0.25) return 0
  if (r < 0.55) return 1
  if (r < 0.80) return 2
  if (r < 0.92) return 3
  if (r < 0.98) return 4
  return 5
}

const AVATAR_STYLES = ['avataaars', 'micah', 'lorelei', 'notionists', 'personas', 'adventurer']

function buildAvatar(seed: string, idx: number): string {
  const style = AVATAR_STYLES[idx % AVATAR_STYLES.length]
  // DiceBear v9 — works as <img src>
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundType=gradientLinear&backgroundColor=39ff63,0d8a3a,1a1a1a,232323`
}

/* All sales scheduled for a given date (0–5 / day, deterministic). */
export function generateSalesForDay(date: Date): FakeSale[] {
  if (isBeforeStats(date)) return []
  const key = dayKey(date)
  const rng = mulberry32(key)
  const count = pickSalesCount(rng)
  const sales: FakeSale[] = []
  for (let i = 0; i < count; i++) {
    // Random throughout the day, biased toward 09:00–23:00
    const hour = Math.floor(8 + rng() * 15) // 8..22
    const minute = Math.floor(rng() * 60)
    const second = Math.floor(rng() * 60)
    const handle = shortHash(rng, 4)
    const buyerId = `${key}-${i}-${handle}`
    const productIndex: 0 | 1 = rng() < 0.55 ? 0 : 1
    const ts = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, second).getTime()
    sales.push({
      buyerId,
      handle,
      avatar: buildAvatar(buyerId, i + key),
      productIndex,
      ts,
    })
  }
  return sales.sort((a, b) => a.ts - b.ts)
}

/* Sales that have already "happened" today (ts <= now). */
export function getSalesToday(now: Date = mskNow()): FakeSale[] {
  return generateSalesForDay(now).filter((s) => s.ts <= now.getTime())
}

/* Latest N sales — looks back across recent days until N collected.
   Sorted newest first. */
export function getRecentSales(limit = 3, now: Date = mskNow()): FakeSale[] {
  const out: FakeSale[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (let i = 0; i < 30 && out.length < limit; i++) {
    const day = new Date(cursor)
    day.setDate(cursor.getDate() - i)
    if (isBeforeStats(day)) break
    let daySales = generateSalesForDay(day)
    if (i === 0) daySales = daySales.filter((s) => s.ts <= now.getTime())
    for (let j = daySales.length - 1; j >= 0 && out.length < limit; j--) {
      out.push(daySales[j])
    }
  }
  return out
}

/* Total sales count since STATS_START up to `now`. */
export function getTotalSales(now: Date = mskNow()): number {
  let total = 0
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(STATS_START.getFullYear(), STATS_START.getMonth(), STATS_START.getDate())
  for (let day = new Date(start); day.getTime() <= cursor.getTime(); day.setDate(day.getDate() + 1)) {
    const sales = generateSalesForDay(day)
    if (sameDay(day, now)) {
      total += sales.filter((s) => s.ts <= now.getTime()).length
    } else {
      total += sales.length
    }
  }
  return total
}

/* Moscow time helpers — все часы по МСК (UTC+3, без перехода) */
export function mskNow(): Date {
  const d = new Date()
  return new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60 * 1000)
}
export function mskParts(d: Date = mskNow()): { h: number; m: number } {
  return { h: d.getHours(), m: d.getMinutes() }
}

/* Online users — small project realism. Часы по МСК. */
export function getOnline(now: Date = mskNow()): number {
  const slot = Math.floor(now.getTime() / (1000 * 60 * 4))
  const r1 = mulberry32(slot)()
  const r2 = mulberry32(slot - 1)()
  const r3 = mulberry32(slot - 2)()
  const avg = (r1 + r2 + r3) / 3

  const { h: hh, m: mm } = mskParts(now)
  const hour = hh + mm / 60
  const dayCurve = 0.5 + 0.5 * Math.cos(((hour - 20) / 24) * 2 * Math.PI)

  let lo = 2, hi = 4
  if (hour >= 7  && hour < 12) { lo = 3; hi = 6 }
  else if (hour >= 12 && hour < 19) { lo = 4; hi = 7 }
  else if (hour >= 19 && hour < 23) { lo = 4; hi = 7 }

  const base = lo + (hi - lo) * (0.35 + 0.65 * dayCurve)
  const jitter = (avg - 0.5) * 1.2
  return Math.max(lo, Math.min(hi, Math.round(base + jitter)))
}

/* Display helpers */
export function buyerLabel(handle: string, lang: 'ru' | 'en'): string {
  return lang === 'ru' ? `Клиент #${handle}` : `Buyer #${handle}`
}

export function lotLabel(i: 0 | 1, lang: 'ru' | 'en'): string {
  if (i === 0) {
    return lang === 'ru' ? 'Готовый верифицированный аккаунт' : 'Ready verified account'
  }
  return lang === 'ru' ? 'Верификация аккаунта' : 'Account verification'
}

export function formatTime(ts: number): string {
  const { h, m } = mskParts(new Date(ts))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatAgo(ts: number, lang: 'ru' | 'en', now: number = Date.now()): string {
  const diff = Math.max(0, now - ts)
  const m = Math.floor(diff / 60000)
  if (m < 1) return lang === 'ru' ? 'только что' : 'just now'
  if (m < 60) return lang === 'ru' ? `${m} мин` : `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return lang === 'ru' ? `${h} ч` : `${h} h`
  const d = Math.floor(h / 24)
  return lang === 'ru' ? `${d} дн` : `${d} d`
}
