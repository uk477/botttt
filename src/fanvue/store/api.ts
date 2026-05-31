import { getTelegramInitData } from '../utils/security'
import { resolveApiBase } from '../utils/apiBase'

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
  const base = resolveApiBase()
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

export type BroadcastApiResult = {
  ok: boolean
  sent_to?: number
  failed?: number
  total?: number
  status?: string
  id?: number
  error?: string
}

async function postBroadcast(
  body: {
    text: string
    buttonText?: string
    keyboard?: import('../../../shared/broadcastKeyboard').BroadcastKeyboardInput
  },
): Promise<BroadcastApiResult> {
  const base = resolveApiBase()
  if (!base) return { ok: false, error: 'API disabled' }
  try {
    const r = await fetch(`${base}/api/admin/broadcast`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    })
    const data = (await r.json().catch(() => ({}))) as BroadcastApiResult & { error?: string }
    if (!r.ok) {
      return { ok: false, error: data.error || `HTTP ${r.status}` }
    }
    return { ...data, ok: data.ok !== false }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' }
  }
}

const get  = <T>(path: string)              => req<T>('GET',    path)
const post = <T>(path: string, b: object)   => req<T>('POST',   path, b)
const patch = <T>(path: string, b: object)  => req<T>('PATCH',  path, b)
const del  = <T>(path: string)              => req<T>('DELETE', path)

export const api = {
  isEnabled: () => !!resolveApiBase(),
  getBase: () => resolveApiBase(),

  getAppConfig:   ()                 => get<import('./storeConfigSync').PublicStoreConfig>('/api/config/app'),
  setUserLang:    (lang: 'ru' | 'en') => post('/api/user/lang', { lang }),
  auth:           (b: object)        => post('/api/auth', b),
  getUser:        (uid: number)      => get(`/api/user/${uid}`),
  getProducts:    ()                 => get<{ products: unknown[]; categories: unknown[]; pinned: number[] }>('/api/products'),
  getMyOrders:    ()                 => get('/api/orders'),
  getOrder:       (id: string)       => get(`/api/order/${id}`),
  createOrder:    (b: object)        => post('/api/order', b),
  cancelOrder:    (id: string)       => post(`/api/order/${encodeURIComponent(id)}/cancel`, {}),
  purchaseBalance: (b: object)      => post<{
    ok: boolean
    order?: Record<string, unknown>
    balance?: number
    spent?: number
    purchases?: number
  }>('/api/purchase/balance', b),

  getMessages:    ()                 => get<{ messages: unknown[]; tickets?: unknown[] }>('/api/support/messages'),
  openSupportTicket: (b: { id: string; category: string; summary?: string }) =>
    post<{ ok: boolean; ticket: Record<string, unknown> }>('/api/support/ticket', b),
  closeSupportTicket: (id: string, reason?: string) =>
    post<{ ok: boolean }>(`/api/support/ticket/${encodeURIComponent(id)}/close`, { reason }),
  sendMessage:    (text: string)     => post('/api/support/message', { text }),

  refWithdraw:    (b: object)        => post('/api/ref/withdraw', b),
  refWithdrawals: ()                 => get('/api/ref/withdrawals'),
  refReward:      (b: object)        => post('/api/ref/reward', b),
  getReferrals:   ()                 => get<{
    referrals: import('./types').Referral[]
    refDailyLog: Record<string, number>
    refReward: { month: string; count: number; claimed: boolean }
    recentSales: import('./types').RealSale[]
  }>('/api/referrals'),
  adminCreditRef: (uid: number, amount: number) =>
    post(`/api/admin/user/${uid}/ref-balance`, { amount }),

  adminOrders:           ()                        => get('/api/admin/orders?all=1'),
  adminPatchOrder:       (id: string, b: object)   => patch(`/api/admin/order/${id}`, b),
  adminDeleteOrder:      (id: string)              => del(`/api/admin/order/${id}`),
  adminUsers:            ()                        => get('/api/admin/users'),
  adminStats:            ()                        => get('/api/admin/stats'),
  adminIssueBalance:     (uid: number, amt: number) => post(`/api/admin/user/${uid}/balance`, { amount: amt }),
  adminSupport:          ()                        => get('/api/admin/support'),
  adminReply:            (uid: number, text: string, lang?: 'ru' | 'en') =>
    post(`/api/admin/support/${uid}`, { text, lang }),
  adminCloseTicket:      (id: string, reason?: string) =>
    post<{ ok: boolean }>(`/api/admin/support/ticket/${encodeURIComponent(id)}/close`, { reason }),
  adminGetSettings:      ()                        => get('/api/admin/settings'),
  adminSetSettings:      (b: object)               => post<{ ok: boolean }>('/api/admin/settings', b),
  adminGetProducts:      ()                        => get<{ products: unknown[]; categories: unknown[]; pinned: number[] }>('/api/admin/products'),
  adminUpsertProduct:    (b: object)               => post('/api/admin/product', b),
  adminUpsertCategory:   (b: object)               => post('/api/admin/category', b),
  adminDeleteCategory:   (id: number)              => del(`/api/admin/category/${id}`),
  adminDeleteProduct:    (id: number)              => del(`/api/admin/product/${id}`),
  adminPinProduct:       (id: number)              => post(`/api/admin/product/${id}/pin`, {}),
  adminUnpinProduct:     (id: number)              => del(`/api/admin/product/${id}/pin`),
  adminBroadcast:        (body: { text: string; keyboard?: import('../../../shared/broadcastKeyboard').BroadcastKeyboardInput }) =>
    postBroadcast(body),
  adminBroadcasts:       ()                        => get('/api/admin/broadcasts'),
  adminRefWithdrawals:   ()                        => get('/api/admin/ref-withdrawals'),
  adminSetRefStatus:     (id: string, b: object)   => patch(`/api/admin/ref-withdrawal/${id}`, b),
  adminLogs:             ()                        => get('/api/admin/logs'),
  adminAddLog:           (log: object)             => post('/api/admin/log', log),
}
