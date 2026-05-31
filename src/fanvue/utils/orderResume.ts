import type { Order, Product } from '../store/types'
import { isPendingCryptoInvoice } from './pendingOrder'

const GENERIC_TITLES = new Set(['Покупка', 'Purchase'])

/** Resolve catalog product for a pending buy (server may omit product_id). */
export function resolveOrderProductId(order: Order, products: Product[]): number | undefined {
  if (order.product_id != null && order.product_id > 0) return order.product_id
  const title = order.product_title?.trim()
  if (!title || GENERIC_TITLES.has(title)) return undefined
  const p = products.find((x) => x.title === title || x.title_en === title)
  return p?.id
}

export function findResumablePendingOrder(orders: Order[], orderId?: string): Order | null {
  if (!orderId) return null
  const o = orders.find((x) => x.id === orderId && isPendingCryptoInvoice(x))
  return o ?? null
}

export type ResumePayState = {
  resumeCryptoPay?: boolean
  resumeOrderId?: string
  /** After payment screen — explicit return (e.g. /orders), not history -1 */
  returnTo?: string
}
