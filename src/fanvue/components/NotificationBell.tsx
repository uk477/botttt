import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { useTelegram } from '../hooks/useTelegram'
import OrderTrackingSheet from './OrderTrackingSheet'
import CryptoLogo from './CryptoLogo'
import { BellIcon } from './NavIcons'
import { isPendingCryptoInvoice } from '../utils/pendingOrder'
import { resolveOrderProductId } from '../utils/orderResume'
import type { PaymentNotification, Order } from '../store/types'

function timeAgo(iso: string, lang: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return lang === 'ru' ? 'только что' : 'just now'
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    return lang === 'ru' ? `${m} мин. назад` : `${m}m ago`
  }
  const h = Math.floor(diff / 3600)
  return lang === 'ru' ? `${h} ч. назад` : `${h}h ago`
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const prevUnreadRef = useRef(0)
  const controls = useAnimationControls()

  const lang = useStore((s) => s.lang)
  const notifications = useStore((s) => s.notifications)
  const orders = useStore((s) => s.orders)
  const products = useStore((s) => s.products)
  const markRead = useStore((s) => s.markNotificationsRead)
  const removeNotification = useStore((s) => s.removeNotification)
  const { haptic } = useTelegram()

  const unread = notifications.filter((n) => !n.read).length
  const hasPending = notifications.some((n) => {
    const o = orders.find((x) => x.id === n.orderId)
    return o != null && isPendingCryptoInvoice(o)
  })

  // Ring animation when new unread arrives
  useEffect(() => {
    if (unread > prevUnreadRef.current) {
      controls.start({
        rotate: [0, -12, 12, -10, 10, -6, 6, 0],
        transition: { duration: 0.6, ease: 'easeInOut' },
      })
    }
    prevUnreadRef.current = unread
  }, [unread, controls])

  // Periodic ring when pending deposits exist
  useEffect(() => {
    if (!hasPending || open) return
    const id = setInterval(() => {
      controls.start({
        rotate: [0, -10, 10, -8, 8, 0],
        transition: { duration: 0.5 },
      })
    }, 4000)
    return () => clearInterval(id)
  }, [hasPending, open, controls])

  const handleOpen = () => {
    haptic('light')
    setOpen((v) => !v)
    if (!open) markRead()
  }

  const handleNotifTap = (n: PaymentNotification) => {
    const order = orders.find((o) => o.id === n.orderId)
    const status = order?.status ?? 'pending'
    if (status === 'pending' && order && isPendingCryptoInvoice(order)) {
      haptic('medium')
      setOpen(false)
      if (n.kind === 'deposit') {
        navigate('/deposit', { state: { resumeOrderId: order.id } })
      } else {
        const productId = resolveOrderProductId(order, products)
        if (productId) {
          navigate(`/product/${productId}`, {
            state: { resumeCryptoPay: true, resumeOrderId: order.id },
          })
        } else {
          navigate('/orders')
        }
      }
      return
    }
    if ((status === 'paid' || status === 'completed') && n.kind === 'buy' && order) {
      haptic('light')
      setOpen(false)
      setActiveOrder(order)
    }
  }

  const getOrderStatus = (orderId: string) =>
    orders.find((o) => o.id === orderId)?.status ?? 'pending'

  if (notifications.length === 0 && !hasPending) {
    return (
      <motion.button
        className="card"
        style={{ padding: 10, color: 'var(--t-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
        onClick={handleOpen}
        whileTap={{ scale: 0.9 }}
      >
        <motion.div animate={controls}>
          <BellIcon size={20} />
        </motion.div>
      </motion.button>
    )
  }

  return (
    <>
      {/* Bell button */}
      <motion.button
        className="card"
        style={{
          padding: 10,
          color: unread > 0 ? 'var(--brand)' : 'var(--t-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
        onClick={handleOpen}
        whileTap={{ scale: 0.9 }}
      >
        <motion.div animate={controls}>
          <BellIcon size={20} />
        </motion.div>
        <AnimatePresence>
          {unread > 0 && (
            <motion.div
              key="badge"
              initial={false}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              style={{
                position: 'absolute', top: 3, right: 3,
                minWidth: 14, height: 14, borderRadius: 7,
                background: 'var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 900, color: 'white',
                border: '1.5px solid var(--bg)',
                padding: '0 2px',
              }}
            >
              {unread > 9 ? '9+' : unread}
            </motion.div>
          )}
        </AnimatePresence>
        {hasPending && unread === 0 && (
          <span style={{
            position: 'absolute', top: 5, right: 5,
            width: 6, height: 6, borderRadius: 3,
            background: 'var(--orange)',
          }} className="pulse-dot" />
        )}
      </motion.button>

      {/* Dropdown backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 45 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              position: 'fixed', top: 72, right: 16, left: 16,
              background: 'var(--surface)',
              borderRadius: 20,
              border: '1px solid var(--b-default)',
              zIndex: 50,
              padding: '4px 4px 8px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px' }}>
              <div className="t-sm fw-black">
                {lang === 'ru' ? 'Уведомления' : 'Notifications'}
              </div>
              {notifications.length > 0 && (
                <span className="t-xs t-muted">{notifications.length}</span>
              )}
            </div>

            {notifications.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--t-muted)', fontSize: 13 }}>
                {lang === 'ru' ? 'Нет уведомлений' : 'No notifications'}
              </div>
            )}

            {notifications.map((n, i) => {
              const status = getOrderStatus(n.orderId)
              const crypto = CRYPTO_OPTIONS.find((c) => c.id === n.network)
              const isPending = status === 'pending'
              const isDone = status === 'paid' || status === 'completed'
              const isFailed = status === 'failed' || status === 'expired'
              return (
                <motion.div
                  key={n.orderId}
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    borderRadius: 14,
                    cursor: (isPending || (isDone && n.kind === 'buy')) ? 'pointer' : 'default',
                    background: (isPending || (isDone && n.kind === 'buy')) ? 'rgba(255,255,255,0.04)' : 'transparent',
                    marginBottom: 2,
                  }}
                  onClick={() => handleNotifTap(n)}
                  whileTap={(isPending || (isDone && n.kind === 'buy')) ? { scale: 0.97 } : undefined}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <CryptoLogo network={n.network} size={34} />
                    {isPending && (
                      <span className="pulse-dot" style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: 8, height: 8,
                        border: '1.5px solid var(--bg)',
                        borderRadius: 4,
                      }} />
                    )}
                    {isDone && (
                      <div style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 14, height: 14, borderRadius: 7,
                        background: 'var(--green)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, color: 'white', fontWeight: 900,
                        border: '1.5px solid var(--bg)',
                      }}>✓</div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-sm fw-bold" style={{ lineHeight: 1.2 }}>
                      {n.kind === 'deposit'
                        ? (lang === 'ru' ? 'Пополнение' : 'Deposit')
                        : isDone
                          ? (lang === 'ru' ? '📦 Заказ оплачен' : '📦 Order paid')
                          : isPending
                            ? (lang === 'ru' ? '⏳ Ожидает оплаты' : '⏳ Awaiting payment')
                            : (lang === 'ru' ? 'Оплата' : 'Payment')}
                      {' '}<span style={{ color: 'var(--brand)' }}>${n.amountUsd.toFixed(2)}</span>
                    </div>
                    <div className="t-xs t-muted" style={{ marginTop: 2 }}>
                      {n.kind === 'buy' && isDone
                        ? `#${n.orderId.slice(-8)} · ${timeAgo(n.createdAt, lang)}`
                        : `${crypto?.name} · ${timeAgo(n.createdAt, lang)}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    {isPending && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="t-xs" style={{ color: 'var(--orange)' }}>
                          {lang === 'ru' ? 'Ожидание' : 'Pending'}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    )}
                    {isDone && n.kind === 'buy' && (
                      <span style={{
                        background: 'rgba(var(--brand-rgb),0.12)', color: 'var(--brand)',
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        cursor: 'pointer',
                      }}>
                        {lang === 'ru' ? '💬 Поддержка →' : '💬 Support →'}
                      </span>
                    )}
                    {isDone && n.kind === 'deposit' && (
                      <span style={{
                        background: 'rgba(34,197,94,0.12)', color: 'var(--green)',
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      }}>
                        {lang === 'ru' ? 'Зачислено' : 'Credited'}
                      </span>
                    )}
                    {isFailed && (
                      <>
                        <span style={{
                          background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        }}>
                          {status === 'expired'
                            ? (lang === 'ru' ? 'Истекло' : 'Expired')
                            : (lang === 'ru' ? 'Ошибка' : 'Failed')}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeNotification(n.orderId) }}
                          style={{ background: 'none', padding: 0, color: 'var(--t-muted)', fontSize: 10 }}
                        >
                          {lang === 'ru' ? 'Удалить' : 'Remove'}
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order tracking sheet */}
      {activeOrder && (
        <OrderTrackingSheet order={activeOrder} onClose={() => setActiveOrder(null)} />
      )}

    </>
  )
}
