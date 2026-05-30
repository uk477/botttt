import { CONFIG } from '../config'

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function parseOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * API root for fetch calls.
 * - In Telegram / production: always the page origin (Express serves API + SPA together).
 * - Local dev: use VITE_API_URL when it points to another port (e.g. :3000).
 */
export function resolveApiBase(): string {
  const pageOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin.replace(/\/+$/, '')
      : ''

  const configured = (CONFIG.apiUrl ?? '').trim().replace(/\/+$/, '')
  const cfgOrigin = configured ? parseOrigin(configured) : null

  if (pageOrigin) {
    if (!cfgOrigin) return pageOrigin
    if (cfgOrigin === pageOrigin) return pageOrigin

    try {
      const page = new URL(pageOrigin)
      if (isLocalHost(page.hostname)) {
        return cfgOrigin
      }
    } catch {
      return pageOrigin
    }

    // Built with wrong VITE_API_URL — user opens app from real domain
    console.warn(
      `[api] VITE_API_URL (${cfgOrigin}) ≠ app origin (${pageOrigin}); using app origin`,
    )
    return pageOrigin
  }

  return cfgOrigin ?? configured ?? ''
}

export function apiPath(path: string): string {
  const base = resolveApiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
