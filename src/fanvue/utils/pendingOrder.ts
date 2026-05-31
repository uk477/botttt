import { CONFIG } from '../config'
import type { Order } from '../store/types'
import { paymentSecondsRemaining } from './paymentTimer'

const WINDOW_SEC = CONFIG.paymentTimeoutMinutes * 60
/** Grace so clock skew / parse edge does not flash «истёк» on fresh invoices. */
const EXPIRE_GRACE_SEC = 90

/** Pending crypto invoice: deposit or buy (not balance). Trust server `status`. */
export function isPendingCryptoInvoice(o: Order): boolean {
  if (o.status !== 'pending') return false
  if (o.kind === 'deposit') return true
  if (o.kind === 'buy') return !!(o.provider && o.provider !== 'balance')
  return false
}

/** @deprecated alias */
export function isCryptoInvoiceOrder(o: Order): boolean {
  return isPendingCryptoInvoice(o)
}

/** Timer says window open (for UI countdown only — not for hiding pending). */
export function isPaymentWindowOpen(o: Order): boolean {
  if (!isPendingCryptoInvoice(o)) return false
  const left = paymentSecondsRemaining(WINDOW_SEC, {
    expiresAt: o.expires_at,
    createdAt: o.created,
  })
  return left > EXPIRE_GRACE_SEC
}

/** @deprecated Use isPendingCryptoInvoice for lists/gates; isPaymentWindowOpen for timer. */
export function isActiveCryptoInvoice(o: Order): boolean {
  return isPendingCryptoInvoice(o) && isPaymentWindowOpen(o)
}

function sortNewest(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
}

export function pickLatestPendingCrypto(orders: Order[]): Order | null {
  return sortNewest(orders.filter(isPendingCryptoInvoice))[0] ?? null
}

export function pickLatestPendingDeposit(orders: Order[]): Order | null {
  return sortNewest(orders.filter((o) => o.kind === 'deposit' && isPendingCryptoInvoice(o)))[0] ?? null
}

/** @deprecated */
export function pickLatestActiveCryptoPending(orders: Order[]): Order | null {
  return pickLatestPendingCrypto(orders)
}

/** @deprecated */
export function pickLatestActiveDeposit(orders: Order[]): Order | null {
  return pickLatestPendingDeposit(orders)
}
