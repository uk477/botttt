import type { Order } from '../store/types'

/** Buy order with confirmed payment (not pending / not just opened checkout). */
export function isRealPaidBuy(o: Order): boolean {
  if (o.kind !== 'buy') return false
  if (o.status === 'completed') return true
  if (o.status === 'paid') return true
  return false
}

export function isPendingPayment(o: Order): boolean {
  return o.status === 'pending'
}
