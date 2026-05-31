/** Server/SQLite timestamps are UTC (see server/utils/sqliteTime.ts). */
export function parseServerUtc(s: string): number {
  const t = s.trim()
  if (!t) return NaN
  if (t.includes('T')) {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}Z`
    return Date.parse(iso)
  }
  return Date.parse(t.replace(' ', 'T') + 'Z')
}

/** Seconds left until payment window ends (server expires_at preferred). */
export function paymentSecondsRemaining(
  totalSeconds: number,
  opts: { expiresAt?: string; createdAt?: string },
): number {
  if (opts.expiresAt) {
    const end = parseServerUtc(opts.expiresAt)
    if (Number.isFinite(end)) {
      return Math.max(0, Math.floor((end - Date.now()) / 1000))
    }
  }
  if (opts.createdAt) {
    const start = parseServerUtc(opts.createdAt)
    if (Number.isFinite(start)) {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      return Math.max(0, totalSeconds - elapsed)
    }
  }
  return totalSeconds
}
