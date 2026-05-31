import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import OrderDetailModal from '../components/OrderDetailModal'
import OrderPayOverlay from '../components/OrderPayOverlay'

import { useStore, CRYPTO_OPTIONS } from '../store'
import type { Order, OrderStatus, CryptoNetwork } from '../store/types'
import { useTelegram } from '../hooks/useTelegram'
import CryptoLogo from '../components/CryptoLogo'

const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const GREEN = '#39ff63'
const INK = '#0a0a0a'

type Filter = 'all' | 'closed' | 'pending' | 'awaiting' | 'cancelled'

function bucket(o: { status: OrderStatus; paid_at?: string }): Exclude<Filter, 'all'> {
  if (o.status === 'completed') return 'closed'
  if (o.status === 'pending') return 'awaiting'
  if (o.status === 'paid') return 'pending'
  return 'cancelled'
}

const STATUS_META: Record<string, { ru: string; en: string; color: string; bg: string; border: string }> = {
  completed: { ru: 'Закрыт',   en: 'Closed',    color: GREEN,              bg: 'rgba(57,255,99,0.10)',  border: 'rgba(57,255,99,0.28)' },
  paid:      { ru: 'Оплачен',  en: 'Paid',      color: GREEN,              bg: 'rgba(57,255,99,0.10)',  border: 'rgba(57,255,99,0.28)' },
  pending:   { ru: 'Ожидает оплаты', en: 'Awaiting payment', color: '#ffd24a', bg: 'rgba(255,210,74,0.10)', border: 'rgba(255,210,74,0.28)' },
  failed:    { ru: 'Отменён',  en: 'Cancelled', color: '#ff6b6b',          bg: 'rgba(255,107,107,0.10)',border: 'rgba(255,107,107,0.28)' },
  expired:   { ru: 'Истёк',    en: 'Expired',   color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
}

function formatDate(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function Orders() {
  const navigate = useNavigate()
  const lang = useStore((s) => s.lang)
  const allOrders = useStore((s) => s.orders)
  const { showBackButton } = useTelegram()

  const [filter, setFilter] = useState<Filter>('all')
  const [openOrder, setOpenOrder] = useState<Order | null>(null)
  const [payOverlayOrder, setPayOverlayOrder] = useState<Order | null>(null)

  useEffect(() => {
    const cleanup = showBackButton(() => {
      if (openOrder) {
        setOpenOrder(null)
        return
      }
      navigate(-1)
    })
    return cleanup
  }, [openOrder, navigate, showBackButton])

  // include all buy orders in any status
  const orders = useMemo(
    () => allOrders.filter((o) => o.kind === 'buy'),
    [allOrders],
  )

  const filtered = useMemo(() => {
    const arr = filter === 'all' ? orders : orders.filter((o) => bucket(o) === filter)
    return arr.slice().sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
  }, [orders, filter])

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>()
    filtered.forEach((o) => {
      const d = new Date(o.created)
      const key = d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
      const arr = map.get(key) ?? []
      arr.push(o)
      map.set(key, arr)
    })
    return Array.from(map.entries())
  }, [filtered, lang])

  const FILTERS: { key: Filter; label: string }[] = lang === 'ru'
    ? [
        { key: 'all',       label: 'Все' },
        { key: 'closed',    label: 'Закрытые' },
        { key: 'pending',   label: 'В обработке' },
        { key: 'awaiting',  label: 'Ожидает оплаты' },
        { key: 'cancelled', label: 'Отменённые' },
      ]
    : [
        { key: 'all',       label: 'All' },
        { key: 'closed',    label: 'Closed' },
        { key: 'pending',   label: 'Processing' },
        { key: 'awaiting',  label: 'Awaiting payment' },
        { key: 'cancelled', label: 'Cancelled' },
      ]



  return (
    <PageTransition>
      <div
        className="orders-page-shell"
        style={{
          background: INK,
          color: '#fff',
          fontFamily: DISPLAY,
          padding: 'max(18px, calc(var(--tg-top) + 8px)) 18px calc(var(--fv-nav-h, 78px) + var(--tg-bottom, 0px) + 28px)',
          minHeight: 'min-content',
        }}
      >
        {/* Header */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={lang === 'ru' ? 'Назад' : 'Back'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div
              style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase',
              }}
            >
              /history
            </div>
          </div>

          <div
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase', marginTop: 18,
            }}
          >
            /01 · {lang === 'ru' ? 'Журнал операций' : 'Operations log'}
          </div>
          <h1
            style={{
              fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em',
              margin: '6px 0 16px', lineHeight: 1.05,
            }}
          >
            {lang === 'ru' ? 'История заказов' : 'Order History'}
          </h1>

        </motion.div>

        {/* Filter pills */}
        <div
          className="orders-filter-row"
          style={{
            display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none',
            marginBottom: 22, padding: '4px 4px 4px 0',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  position: 'relative',
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontFamily: DISPLAY,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  background: active ? GREEN : 'rgba(255,255,255,0.04)',
                  color: active ? INK : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${active ? GREEN : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background 160ms, color 160ms',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* List */}
        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '64px 16px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: 16,
                }}
              >
                <div
                  style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(57,255,99,0.06)',
                    border: '1px solid rgba(57,255,99,0.2)',
                    color: GREEN,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 14px',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h18M3 12h18M3 17h12"/>
                  </svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                  {lang === 'ru' ? 'Здесь пока пусто' : 'Nothing here yet'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 18 }}>
                  {lang === 'ru' ? 'Ваши заказы появятся в журнале' : 'Your orders will appear here'}
                </div>
                <button
                  onClick={() => navigate('/')}
                  style={{
                    background: GREEN,
                    color: INK,
                    border: 'none',
                    padding: '12px 22px',
                    borderRadius: 999,
                    fontFamily: DISPLAY,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {lang === 'ru' ? 'В маркет' : 'To market'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {groups.map(([day, items]) => (
                  <div key={day}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        marginBottom: 10, paddingLeft: 2,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: MONO, fontSize: 10, fontWeight: 700,
                          letterSpacing: '0.2em', color: 'rgba(255,255,255,0.55)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {day}
                      </div>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                      <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                        {items.length}
                      </div>
                    </div>

                    <motion.div
                      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                      initial="hidden"
                      animate="show"
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
                    >
                      {items.map((o) => {
                        const cryptoOpt = o.provider
                          ? CRYPTO_OPTIONS.find((c) => c.id === (o.provider as CryptoNetwork))
                          : undefined
                        const meta = STATUS_META[o.status] ?? STATUS_META.expired
                        const label = meta[lang as 'ru' | 'en']
                        const isDeposit = o.kind === 'deposit'

                        return (
                          <motion.button
                            key={o.id}
                            onClick={() => setOpenOrder(o)}
                            variants={{
                              hidden: { opacity: 0, y: 8 },
                              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
                            }}
                            whileTap={{ scale: 0.985 }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '14px 14px',
                              background: 'rgba(255,255,255,0.025)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: 14,
                              cursor: 'pointer',
                              color: '#fff',
                            }}
                          >
                            {/* Icon */}
                            <div
                              style={{
                                width: 42, height: 42, borderRadius: 12,
                                background: isDeposit ? 'rgba(57,255,99,0.08)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${isDeposit ? 'rgba(57,255,99,0.22)' : 'rgba(255,255,255,0.08)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: isDeposit ? GREEN : 'rgba(255,255,255,0.75)',
                                flexShrink: 0,
                              }}
                            >
                              {cryptoOpt ? (
                                <CryptoLogo network={cryptoOpt.id} size={24} />
                              ) : isDeposit ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 19V5M5 12l7-7 7 7"/>
                                </svg>
                              ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/>
                                  <path d="M14 2v6h6"/>
                                </svg>
                              )}
                            </div>

                            {/* Body */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14, fontWeight: 700, color: '#fff',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}
                              >
                                {isDeposit
                                  ? (cryptoOpt
                                      ? `${lang === 'ru' ? 'Пополнение' : 'Deposit'} · ${cryptoOpt.name}`
                                      : (lang === 'ru' ? 'Пополнение' : 'Deposit'))
                                  : (o.product_title ?? (lang === 'ru' ? 'Товар' : 'Item'))}
                              </div>
                              <div
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.45)',
                                  marginTop: 4,
                                }}
                              >
                                <span>{formatDate(o.created, lang)}</span>
                                <span style={{ opacity: 0.4 }}>·</span>
                                <span>#{o.id.includes('-') ? o.id.split('-').pop() : o.id.slice(-8)}</span>
                              </div>
                            </div>

                            {/* Right */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                              <div
                                style={{
                                  fontFamily: DISPLAY,
                                  fontSize: 15, fontWeight: 800,
                                  letterSpacing: '-0.01em',
                                  color: isDeposit ? GREEN : '#fff',
                                }}
                              >
                                {isDeposit ? '+' : '−'}${o.amount.toFixed(2)}
                              </div>
                              <div
                                style={{
                                  fontFamily: MONO,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: '0.12em',
                                  textTransform: 'uppercase',
                                  color: meta.color,
                                  background: meta.bg,
                                  border: `1px solid ${meta.border}`,
                                  padding: '3px 8px',
                                  borderRadius: 999,
                                }}
                              >
                                {label}
                              </div>
                            </div>
                          </motion.button>
                        )
                      })}
                    </motion.div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <OrderDetailModal
        order={openOrder}
        onClose={() => setOpenOrder(null)}
        returnTo="/orders"
        onOpenFullscreenPay={setPayOverlayOrder}
      />
      <OrderPayOverlay order={payOverlayOrder} onClose={() => setPayOverlayOrder(null)} />
    </PageTransition>
  )
}

