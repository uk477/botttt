import type { CryptoNetwork } from '../store/types'

/* ═══════════════════════════════════════════════════════════════
   Security utilities — defence-in-depth for Fanvue Market.
   Real production security REQUIRES a server that validates
   Telegram initData HMAC and authorises every mutation.
   These client-side layers raise the cost of exploitation.
   ═══════════════════════════════════════════════════════════════ */

// ── Admin hash verification ───────────────────────────────────
// Admin UIDs are never stored in plaintext in the client bundle.
// .env holds pre-computed SHA-256 hashes; at runtime we hash
// the current user's UID and compare.

const ADMIN_SALT = 'fanvue:admin:v1:'

export async function computeAdminHash(uid: number): Promise<string> {
  const data = new TextEncoder().encode(`${ADMIN_SALT}${uid}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyAdminHash(
  uid: number,
  allowedHashes: string[],
): Promise<boolean> {
  if (!uid || allowedHashes.length === 0) return false
  const hash = await computeAdminHash(uid)
  return allowedHashes.some((h) => h.toLowerCase() === hash.toLowerCase())
}

// ── Telegram initData helpers ─────────────────────────────────

export function getTelegramInitData(): string {
  try {
    return (
      (window as Window & { Telegram?: { WebApp?: { initData?: string } } })
        .Telegram?.WebApp?.initData ?? ''
    )
  } catch {
    return ''
  }
}

/**
 * True if running inside Telegram WebApp with a valid-looking
 * initData string (non-empty, has expected params).
 * NOTE: real validation (HMAC) must happen server-side.
 */
export function hasTelegramContext(): boolean {
  const d = getTelegramInitData()
  return d.length > 0 && d.includes('user=')
}

// ── XSS sanitisation ─────────────────────────────────────────

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

export function sanitizeHtml(input: string): string {
  return input.replace(/[&<>"'/]/g, (ch) => HTML_ESCAPE[ch] ?? ch)
}

/**
 * Strip null bytes and control chars that can break parsers.
 * Preserves newlines and tabs.
 */
export function sanitizeText(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

// ── Crypto address format validation ──────────────────────────

const ADDRESS_PATTERNS: Record<CryptoNetwork, RegExp> = {
  trc20:    /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  erc20:    /^0x[0-9a-fA-F]{40}$/,
  bep20:    /^0x[0-9a-fA-F]{40}$/,
  usdc_eth: /^0x[0-9a-fA-F]{40}$/,
  usdc_sol: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  eth:      /^0x[0-9a-fA-F]{40}$/,
  sol:      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  btc:      /^(bc1[a-zA-HJ-NP-Z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  ton:      /^(UQ|EQ|kQ)[A-Za-z0-9_-]{46}$/,
}

export function isValidCryptoAddress(
  address: string,
  network: CryptoNetwork,
): boolean {
  if (!address || address.length < 10) return false
  const pattern = ADDRESS_PATTERNS[network]
  if (!pattern) return false
  return pattern.test(address.trim())
}

// ── Rate limiter (in-memory, per-session) ─────────────────────

interface RateBucket {
  count: number
  resetAt: number
}

const _buckets = new Map<string, RateBucket>()

/**
 * Returns true if the operation is allowed, false if rate-limited.
 * @param key   unique operation key (e.g. 'deposit', 'purchase')
 * @param max   maximum operations in the window
 * @param windowMs  window duration in milliseconds
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now()
  const bucket = _buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    _buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= max) return false
  bucket.count++
  return true
}

// ── Financial operation nonces ────────────────────────────────
// Prevents replay of financial mutations. Each op consumes a nonce.

let _nonceCounter = 0
const _usedNonces = new Set<string>()

export function createFinancialNonce(): string {
  _nonceCounter++
  const nonce = `${Date.now()}-${_nonceCounter}-${Math.random().toString(36).slice(2, 8)}`
  return nonce
}

export function consumeNonce(nonce: string): boolean {
  if (!nonce || _usedNonces.has(nonce)) return false
  _usedNonces.add(nonce)
  if (_usedNonces.size > 500) {
    const arr = [..._usedNonces]
    arr.splice(0, 250)
    _usedNonces.clear()
    arr.forEach((n) => _usedNonces.add(n))
  }
  return true
}

// ── Amount validation ─────────────────────────────────────────

export function isValidAmount(
  amount: number,
  min: number = 0.01,
  max: number = 100_000,
): boolean {
  return (
    Number.isFinite(amount) &&
    amount >= min &&
    amount <= max &&
    Math.round(amount * 1000) === amount * 1000 // max 3 decimal places
  )
}

// ── Audit log (in-memory, for admin review) ───────────────────

interface AuditEntry {
  ts: number
  action: string
  uid?: number
  data?: Record<string, unknown>
}

const _auditLog: AuditEntry[] = []

export function audit(
  action: string,
  uid?: number,
  data?: Record<string, unknown>,
): void {
  _auditLog.push({ ts: Date.now(), action, uid, data })
  if (_auditLog.length > 1000) _auditLog.splice(0, 500)
  if (import.meta.env.DEV) {
    console.info(`[AUDIT] ${action}`, uid ?? '', data ?? '')
  }
}

export function getAuditLog(): readonly AuditEntry[] {
  return _auditLog
}
