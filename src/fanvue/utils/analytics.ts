type Entry = { event: string; data?: Record<string, unknown>; ts: number }
const log: Entry[] = []

export function track(event: string, data?: Record<string, unknown>): void {
  const entry: Entry = { event, data, ts: Date.now() }
  log.push(entry)
  if (log.length > 50) log.shift()
  if (import.meta.env.DEV) console.log('[track]', event, data)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    ;(window as any).gtag('event', event, data)
  }
}

export function getEventLog(): Entry[] {
  return [...log]
}
