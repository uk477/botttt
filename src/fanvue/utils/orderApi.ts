import { getTelegramInitData, waitForTelegramContext } from './security'
import { apiPath } from './apiBase'
import type { CryptoNetwork, OrderStatus } from '../store/types'

export type CreateOrderResult =
  | { ok: true; id: string; address: string; amount_usd: number; amount_crypto: number; expires_at: string }
  | { ok: false; code: string; message: string }

function authHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': getTelegramInitData(),
    'X-Request-Id': `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    'X-Request-Ts': String(Date.now()),
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string }
    return data.message || data.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export function formatOrderError(code: string, message: string, lang: 'ru' | 'en'): string {
  if (code === 'no_init_data') {
    return lang === 'ru'
      ? 'Откройте магазин через кнопку в боте Telegram (не из закладки браузера).'
      : 'Open the shop from the Telegram bot button (not a browser bookmark).'
  }
  if (code === 'no_api') {
    return lang === 'ru'
      ? 'API не настроен. Запустите сервер (pm2) на том же домене.'
      : 'API not configured. Run the server on the same domain.'
  }
  if (code === 'maintenance') {
    return lang === 'ru' ? 'Технические работы. Попробуйте позже.' : 'Maintenance. Try again later.'
  }
  if (code === 'unauthorized') {
    return lang === 'ru'
      ? 'Сессия Telegram не подтверждена. Закройте и откройте мини-апп из бота.'
      : 'Telegram session invalid. Close and reopen the mini-app from the bot.'
  }
  if (code === 'rate_limit') {
    return lang === 'ru'
      ? 'Слишком много запросов. Подождите 1 минуту и попробуйте снова.'
      : 'Too many requests. Wait 1 minute and try again.'
  }
  if (code === 'network') {
    return lang === 'ru'
      ? `Нет связи с сервером. ${message}`
      : `Cannot reach server. ${message}`
  }
  return message
}

export async function createOrder(payload: {
  uid: number
  kind: 'buy' | 'deposit'
  product_id?: number
  quantity?: number
  amount_usd: number
  network: CryptoNetwork
}): Promise<CreateOrderResult> {
  const base = apiPath('/api/order')
  if (!base.startsWith('http')) {
    return { ok: false, code: 'no_api', message: 'resolveApiBase empty' }
  }

  await waitForTelegramContext(5000)
  if (!getTelegramInitData()) {
    return { ok: false, code: 'no_init_data', message: 'initData empty' }
  }

  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })

    if (res.status === 401) {
      return { ok: false, code: 'unauthorized', message: await readErrorMessage(res) }
    }
    if (res.status === 429) {
      return {
        ok: false,
        code: 'rate_limit',
        message: await readErrorMessage(res),
      }
    }
    if (res.status === 503) {
      return { ok: false, code: 'maintenance', message: await readErrorMessage(res) }
    }
    if (!res.ok) {
      const msg = await readErrorMessage(res)
      return { ok: false, code: `http_${res.status}`, message: msg }
    }

    const data = (await res.json()) as {
      id: string
      address: string
      amount_usd: number
      amount_crypto: number
      expires_at: string
    }
    return { ok: true, ...data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed'
    return { ok: false, code: 'network', message: msg }
  }
}

/** null = network/auth error — caller should not treat as still pending */
export async function fetchOrderStatus(orderId: string): Promise<OrderStatus | null> {
  try {
    const res = await fetch(apiPath(`/api/order/${encodeURIComponent(orderId)}`), {
      headers: authHeaders(),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { status?: OrderStatus }
    return data.status ?? null
  } catch {
    return null
  }
}
