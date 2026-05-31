/** Normalize SQLite / API order row for the mini-app store. */
export function mapServerOrder(o: Record<string, unknown>) {
  return {
    id: String(o.id),
    uid: o.uid != null ? Number(o.uid) : undefined,
    kind: (o.kind as string) || 'deposit',
    amount: Number(o.amount_usd ?? o.amount ?? 0),
    amount_crypto: o.amount_crypto != null ? Number(o.amount_crypto) : undefined,
    status: (o.status as string) || 'pending',
    provider: String(o.network ?? o.provider ?? ''),
    created: String(o.created_at ?? o.created ?? new Date().toISOString()),
    expires_at: o.expires_at ? String(o.expires_at) : undefined,
    paid_at: o.paid_at ? String(o.paid_at) : undefined,
    txid: o.tx_hash ? String(o.tx_hash) : o.txid ? String(o.txid) : undefined,
    product_title: o.product_title ? String(o.product_title) : undefined,
    product_id: o.product_id != null ? Number(o.product_id) : undefined,
    quantity: o.quantity != null ? Number(o.quantity) : undefined,
    orderNum: o.orderNum != null ? Number(o.orderNum) : undefined,
    deliveryData: o.delivery_data != null
      ? String(o.delivery_data)
      : o.deliveryData != null
        ? String(o.deliveryData)
        : undefined,
  }
}
