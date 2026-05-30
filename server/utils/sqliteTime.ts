/** UTC timestamp string SQLite can compare with datetime('now'). */
export function toSqliteUtc(d: Date = new Date()): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
