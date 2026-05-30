import { CONFIG } from '../config'
import { getTelegramInitData } from '../utils/security'

const base = CONFIG.apiUrl
const TIMEOUT_MS = 12_000
const MAX_RETRIES = 2

let _requestSeq = 0

function headers(): Record<string, string> {
  _requestSeq++
  return {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': getTelegramInitData(),
    'X-Request-Id': `${Date.now()}-${_requestSeq}`,
    'X-Request-Ts': String(Date.now()),
  }
}

async function req<T>(
  method: string,
  path: string,
  body?: object,
  retries = MAX_RETRIES,
): Promise<T | null> {
  if (!base) return null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
      const r = await fetch(`${base}${path}`, {
        method,
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      if (r.status === 429) {
        const retryAfter = Number(r.headers.get('Retry-After') || 2)
        await new Promise((res) => setTimeout(res, retryAfter * 1000))
        continue
      }

      if (!r.ok) {
        if (r.status >= 500 && attempt < retries) {
          await new Promise((res) => setTimeout(res, 500 * (attempt + 1)))
          continue
        }
        return null
      }

      return r.json() as Promise<T>
    } catch {
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)))
        continue
      }
      return null
    }
  }
  return null
}

const get  = <T>(path: string)              => req<T>('GET',    path)
const post = <T>(path: string, b: object)   => req<T>('POST',   path, b)
const patch = <T>(path: string, b: object)  => req<T>('PATCH',  path, b)
const del  = <T>(path: string)              => req<T>('DELETE', path)

export const api = {
  isEnabled: () => !!base,

  auth:           (b: object)        => post('/api/auth', b),
  getUser:        (uid: number)      => get(`/api/user/${uid}`),
  getProducts:    ()                 => get<{ products: unknown[]; categories: unknown[]; pinned: number[] }>('/api/products'),
  getMyOrders:    ()                 => get('/api/orders'),
  getOrder:       (id: string)       => get(`/api/order/${id}`),
  createOrder:    (b: object)        => post('/api/order', b),

  getMessages:    ()                 => get('/api/support/messages'),
  sendMessage:    (text: string)     => post('/api/support/message', { text }),

  refWithdraw:    (b: object)        => post('/api/ref/withdraw', b),

  adminOrders:           ()                        => get('/api/admin/orders'),
  adminPatchOrder:       (id: string, b: object)   => patch(`/api/admin/order/${id}`, b),
  adminDeleteOrder:      (id: string)              => del(`/api/admin/order/${id}`),
  adminUsers:            ()                        => get('/api/admin/users'),
  adminIssueBalance:     (uid: number, amt: number) => post(`/api/admin/user/${uid}/balance`, { amount: amt }),
  adminSupport:          ()                        => get('/api/admin/support'),
  adminReply:            (uid: number, text: string) => post(`/api/admin/support/${uid}`, { text }),
  adminGetSettings:      ()                        => get('/api/admin/settings'),
  adminSetSettings:      (b: object)               => post('/api/admin/settings', b),
  adminUpsertProduct:    (b: object)               => post('/api/admin/product', b),
  adminPinProduct:       (id: number)              => post(`/api/admin/product/${id}/pin`, {}),
  adminUnpinProduct:     (id: number)              => del(`/api/admin/product/${id}/pin`),
  adminRefWithdrawals:   ()                        => get('/api/admin/ref-withdrawals'),
  adminSetRefStatus:     (id: string, b: object)   => patch(`/api/admin/ref-withdrawal/${id}`, b),
  adminLogs:             ()                        => get('/api/admin/logs'),
}
