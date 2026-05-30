export function ProductCardSkeleton() {
  return (
    <div className="card product-card" style={{ pointerEvents: 'none' }}>
      <div className="row-between">
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 9999 }} />
      </div>
      <div className="skeleton" style={{ width: '90%', height: 14, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 6 }} />
      <div className="row-between mt-3">
        <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 50, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  )
}

export function OrderSkeleton() {
  return (
    <div className="card order-card" style={{ pointerEvents: 'none' }}>
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
      <div className="order-meta col gap-2">
        <div className="skeleton" style={{ width: '70%', height: 14, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: '40%', height: 11, borderRadius: 6 }} />
      </div>
      <div className="skeleton" style={{ width: 60, height: 18, borderRadius: 6 }} />
    </div>
  )
}
