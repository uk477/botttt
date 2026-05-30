/** Parse SQLite / ISO timestamps for display (avoids "Invalid Date"). */
export function parseMessageDate(raw?: string | null): Date {
  if (raw == null || raw === '') return new Date()
  const s = String(raw).trim()
  if (!s) return new Date()

  let d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d

  // SQLite: "2025-05-30 14:30:00" (UTC)
  const sqlite = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/)
  if (sqlite) {
    d = new Date(`${sqlite[1]}T${sqlite[2]}Z`)
    if (!Number.isNaN(d.getTime())) return d
  }

  d = new Date(s.replace(/-/g, '/'))
  if (!Number.isNaN(d.getTime())) return d

  return new Date()
}

export function toIsoString(raw?: string | null): string {
  return parseMessageDate(raw).toISOString()
}
