import { motion } from 'framer-motion'
import { useT } from '../i18n'
import type { Order } from '../store/types'

function DepositSvg() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function OrderSvg() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function OrderCard({ order, index = 0 }: { order: Order; index?: number }) {
  const t = useT()
  const isDeposit = order.kind === 'deposit'
  const statusKey = `status_${order.status}` as Parameters<typeof t>[0]

  return (
    <motion.div
      className="card order-card"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="order-icon" style={{ color: isDeposit ? 'var(--green)' : 'var(--brand)' }}>
        {isDeposit ? <DepositSvg /> : <OrderSvg />}
      </div>
      <div className="order-meta">
        <div className="order-title">
          {isDeposit ? t('order_deposit') : (order.product_title ?? t('order_buy'))}
        </div>
        <div className="row gap-2 mt-1">
          <span className={`badge badge-${order.status}`}>{t(statusKey)}</span>
          <span className="t-xs t-muted">{formatDate(order.created)}</span>
        </div>
        {order.quantity && order.quantity > 1 && (
          <div className="t-xs t-muted mt-1">× {order.quantity}</div>
        )}
      </div>
      <div className="col gap-1" style={{ alignItems: 'flex-end' }}>
        <div className="order-amount" style={{ color: isDeposit ? 'var(--green)' : 'var(--t-primary)' }}>
          {isDeposit ? '+' : ''}${order.amount.toFixed(2)}
        </div>
        {order.provider && (
          <div className="t-xs t-muted" style={{ textTransform: 'uppercase' }}>{order.provider}</div>
        )}
      </div>
    </motion.div>
  )
}
