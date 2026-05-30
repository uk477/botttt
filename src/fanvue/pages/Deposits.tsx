import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import OrderDetailModal from '../components/OrderDetailModal'

import { useStore, CRYPTO_OPTIONS } from '../store'
import type { Order, CryptoNetwork } from '../store/types'
import CryptoLogo from '../components/CryptoLogo'

const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const GREEN = '#39ff63'
const AMBER = '#ffb84a'
const RED = '#ff5a5a'
const INK = '#0a0a0a'

type DepositFilter = 'all' | 'success' | 'pending' | 'failed'

const STATUS_META: Record<
  string,
  { ru: string; en: string; color: string; bg: string; border: string }
> = {
  completed: { ru: 'Зачислено',  en: 'Credited',  color: GREEN, bg: 'rgba(57,255,99,0.10)',  border: 'rgba(57,255,99,0.30)' },
  paid:      { ru: 'Зачислено',  en: 'Credited',  color: GREEN, bg: 'rgba(57,255,99,0.10)',  border: 'rgba(57,255,99,0.30)' },
  pending:   { ru: 'Ожидает',    en: 'Pending',   color: AMBER, bg: 'rgba(255,184,74,0.10)', border: 'rgba(255,184,74,0.30)' },
  failed:    { ru: 'Отменён',    en: 'Cancelled', color: RED,   bg: 'rgba(255,90,90,0.08)',  border: 'rgba(255,90,90,0.25)' },
  expired:   { ru: 'Истёк',      en: 'Expired',   color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
}

function statusBucket(s: Order['status']): DepositFilter {
  if (s === 'completed' || s === 'paid') return 'success'
  if (s === 'pending') return 'pending'
  return 'failed'
}

function formatTime(iso: string, lang: string) {
  return new Date(iso).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDayHeader(iso: string, lang: string) {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today))  return lang === 'ru' ? 'Сегодня'  : 'Today'
  if (sameDay(d, yest))   return lang === 'ru' ? 'Вчера'    : 'Yesterday'
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

export default function Deposits() {
  const navigate = useNavigate()
  const lang = useStore((s) => s.lang)
  const allOrders = useStore((s) => s.orders)
  const [filter, setFilter] = useState<DepositFilter>('all')
  const [openOrder, setOpenOrder] = useState<Order | null>(null)

  const deposits = useMemo(
    () => allOrders.filter((o) => o.kind === 'deposit'),
    [allOrders],
  )

  const filtered = useMemo(() => {
    const arr = filter === 'all' ? deposits : deposits.filter((o) => statusBucket(o.status) === filter)
    return arr.slice().sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
  }, [deposits, filter])

  const groups = useMemo(() => {
    const map = new Map<string, { dayLabel: string; items: Order[] }>()
    filtered.forEach((o) => {
      const d = new Date(o.created)
      const key = d.toDateString()
      const entry = map.get(key) ?? { dayLabel: formatDayHeader(o.created, lang), items: [] }
      entry.items.push(o)
      map.set(key, entry)
    })
    return Array.from(map.values())
  }, [filtered, lang])

  const FILTERS: { key: DepositFilter; label: string; count: number }[] = [
    { key: 'all',     label: lang === 'ru' ? 'Все'        : 'All',       count: deposits.length },
    { key: 'success', label: lang === 'ru' ? 'Успешные'   : 'Success',   count: deposits.filter((o) => statusBucket(o.status) === 'success').length },
    { key: 'pending', label: lang === 'ru' ? 'Ожидают'    : 'Pending',   count: deposits.filter((o) => statusBucket(o.status) === 'pending').length },
    { key: 'failed',  label: lang === 'ru' ? 'Отменены'   : 'Cancelled', count: deposits.filter((o) => statusBucket(o.status) === 'failed').length },
  ]


  return (
    <PageTransition>
      <div
        style={{
          minHeight: '100vh',
          background: INK,
          color: '#fff',
          fontFamily: DISPLAY,
          padding: 'max(18px, calc(var(--tg-top) + 8px)) 18px calc(var(--dock-h, 80px) + 64px)',
        }}
      >
        {/* Top bar */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
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
            <div style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.22em', color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
            }}>
              /02 · {lang === 'ru' ? 'Пополнения' : 'Deposits'}
            </div>
          </div>

          {/* Title row */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            margin: '4px 0 16px',
          }}>
            <h1 style={{
              fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em',
              margin: 0, lineHeight: 1,
            }}>
              {lang === 'ru' ? 'Пополнения' : 'Deposits'}
            </h1>
            <div style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em',
            }}>
              {filtered.length} / {deposits.length}
            </div>
          </div>
        </motion.div>

        {/* Filter pills */}
        <div
          style={{
            display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none',
            marginBottom: 18, padding: '2px 0',
          }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 12px 8px 14px',
                  borderRadius: 999,
                  fontFamily: DISPLAY,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  background: active ? GREEN : 'rgba(255,255,255,0.035)',
                  color: active ? INK : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${active ? GREEN : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background 160ms, color 160ms',
                }}
              >
                {f.label}
                <span style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 999,
                  background: active ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.06)',
                  color: active ? INK : 'rgba(255,255,255,0.55)',
                }}>{f.count}</span>
              </button>
            )
          })}
        </div>

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
                  padding: '60px 16px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: 18,
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
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                  {lang === 'ru' ? 'Здесь пока пусто' : 'Nothing here yet'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 18 }}>
                  {lang === 'ru' ? 'Ваши пополнения появятся в этом списке' : 'Your deposits will show up here'}
                </div>
                <button
                  onClick={() => navigate('/deposit')}
                  style={{
                    background: GREEN, color: INK, border: 'none',
                    padding: '12px 22px', borderRadius: 999,
                    fontFamily: DISPLAY, fontSize: 11, fontWeight: 800,
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {lang === 'ru' ? 'Пополнить' : 'Top up'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {groups.map(({ dayLabel, items }) => {
                  const daySum = items
                    .filter((o) => statusBucket(o.status) === 'success')
                    .reduce((s, o) => s + o.amount, 0)
                  return (
                    <div key={dayLabel}>
                      {/* Day header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        marginBottom: 10, paddingLeft: 2,
                      }}>
                        <div style={{
                          fontFamily: MONO, fontSize: 10, fontWeight: 700,
                          letterSpacing: '0.18em', color: 'rgba(255,255,255,0.6)',
                          textTransform: 'uppercase',
                        }}>
                          {dayLabel}
                        </div>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                        {daySum > 0 && (
                          <div style={{
                            fontFamily: MONO, fontSize: 10, fontWeight: 700,
                            color: GREEN,
                          }}>
                            +${daySum.toFixed(2)}
                          </div>
                        )}
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
                          const bucket = statusBucket(o.status)
                          const isSuccess = bucket === 'success'
                          const isPending = bucket === 'pending'
                          const isFailed = bucket === 'failed'

                          return (
                            <motion.button
                              key={o.id}
                              onClick={() => setOpenOrder(o)}
                              variants={{
                                hidden: { opacity: 0, y: 8 },
                                show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
                              }}
                              whileTap={{ scale: 0.99 }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                padding: '14px 14px 14px 16px',
                                background: 'rgba(255,255,255,0.025)',
                                border: `1px solid ${isPending ? 'rgba(255,184,74,0.18)' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: 16,
                                cursor: 'pointer',
                                color: '#fff',
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Icon */}
                              <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                {cryptoOpt ? (
                                  <CryptoLogo network={cryptoOpt.id} size={28} />
                                ) : (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 19V5M5 12l7-7 7 7"/>
                                  </svg>
                                )}
                              </div>

                              {/* Body */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em',
                                  color: '#fff',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                  marginBottom: 4,
                                }}>
                                  {cryptoOpt ? cryptoOpt.name : (lang === 'ru' ? 'Пополнение' : 'Deposit')}
                                </div>
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.5)',
                                }}>
                                  <span>{formatTime(o.created, lang)}</span>
                                  <span style={{
                                    width: 3, height: 3, borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.25)',
                                  }} />
                                  <span style={{
                                    fontWeight: 700, letterSpacing: '0.06em',
                                    color: meta.color, opacity: 0.95,
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                  }}>
                                    {isPending && (
                                      <span style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: AMBER,
                                        boxShadow: `0 0 6px ${AMBER}`,
                                        animation: 'pulseDot 1.4s ease-in-out infinite',
                                      }} />
                                    )}
                                    {label.toUpperCase()}
                                  </span>
                                </div>
                              </div>

                              {/* Right amount */}
                              <div style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'flex-end', justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <div style={{
                                  fontFamily: DISPLAY,
                                  fontSize: 17, fontWeight: 800,
                                  letterSpacing: '-0.02em',
                                  color: isSuccess ? GREEN : isPending ? AMBER : 'rgba(255,255,255,0.45)',
                                  textDecoration: isFailed ? 'line-through' : 'none',
                                  textDecorationColor: 'rgba(255,90,90,0.5)',
                                }}>
                                  {isSuccess ? '+' : ''}${o.amount.toFixed(2)}
                                </div>
                                {cryptoOpt && (
                                  <div style={{
                                    fontFamily: MONO, fontSize: 9, fontWeight: 700,
                                    color: 'rgba(255,255,255,0.4)',
                                    letterSpacing: '0.1em', marginTop: 2,
                                  }}>
                                    {cryptoOpt.symbol}
                                  </div>
                                )}
                              </div>
                            </motion.button>
                          )
                        })}
                      </motion.div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <style>{`
          @keyframes pulseDot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
          }
        `}</style>
      </div>

      <OrderDetailModal order={openOrder} onClose={() => setOpenOrder(null)} />
    </PageTransition>
  )
}
