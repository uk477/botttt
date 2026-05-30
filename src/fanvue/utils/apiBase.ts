import { CONFIG } from '../config'

/** API root: VITE_API_URL at build time, else current site origin (same VPS deploy). */
export function resolveApiBase(): string {
  const configured = (CONFIG.apiUrl ?? '').trim().replace(/\/+$/, '')
  if (configured) return configured
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

export function apiPath(path: string): string {
  const base = resolveApiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
