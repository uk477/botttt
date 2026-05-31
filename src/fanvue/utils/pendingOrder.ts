import { CONFIG } from '../config'
import type { Order } from '../store/types'
import { paymentSecondsRemaining } from './paymentTimer'

const WINDOW_SEC = CONFIG.paymentTimeoutMinutes * 60

/** Pending crypto invoice: deposit or buy (not balance). */
export function isCryptoInvoiceOrder(o: Order): boolean {
  if (o.status !== 'pending') return false
  if (o.kind === 'deposit') return true
  if (o.kind === 'buy') return !!(o.provider && o.provider !== 'balance')
  return false
}

/** Still inside payment window (server expires_at or local timer). */
export function isActiveCryptoInvoice(o: Order): boolean {
  if (!isCryptoInvoiceOrder(o)) return false
  return (
    paymentSecondsRemaining(WINDOW_SEC, {
      expiresAt: o.expires_at,
      createdAt: o.created,
    }) > 0
  )
}

export function pickLatestActiveCryptoPending(orders: Order[]): Order | null {
  return (
    orders
      .filter(isActiveCryptoInvoice)
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())[0] ?? null
  )
}

export function pickLatestActiveDeposit(orders: Order[]): Order | null {
  return (
    orders
      .filter((o) => o.kind === 'deposit' && isActiveCryptoInvoice(o))
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())[0] ?? null
  )
}
