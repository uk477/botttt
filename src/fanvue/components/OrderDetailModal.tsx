import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { api } from '../store/api'
import { useTelegram } from '../hooks/useTelegram'
import { useToast } from './Toast'
import CryptoLogo from './CryptoLogo'
import DeliveryBlock, { ManualDeliveryBlock } from './DeliveryBlock'
import { isActiveCryptoInvoice } from '../utils/pendingOrder'
import type { Order, CryptoNetwork } from '../store/types'

interface Props { order: Order | null; onClose: () => void }

const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const GREEN = '#39ff63'
const AMBER = '#ffb84a'
const RED = '#ff5a5a'
const INK = '#0a0a0a'

const EXPLORER: Record<CryptoNetwork, (txid: string) => string> = {
  trc20:    (t) => `https://tronscan.org/#/transaction/${t}`,
  erc20:    (t) => `https://etherscan.io/tx/${t}`,
  bep20:    (t) => `https://bscscan.com/tx/${t}`,
  usdc_eth: (t) => `https://etherscan.io/tx/${t}`,
  usdc_sol: (t) => `https://solscan.io/tx/${t}`,
  eth:      (t) => `https://etherscan.io/tx/${t}`,
  sol:      (t) => `https://solscan.io/tx/${t}`,
  btc:      (t) => `https://blockstream.info/tx/${t}`,
  ton:      (t) => `https://tonscan.org/tx/${t}`,
}

const STATUS_COLOR: Record<string, string> = {
  completed: GREEN, paid: GREEN,
  pending: AMBER,
  failed: RED, expired: RED, cancelled: RED,
}

function formatDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase().replace(/\./g, '')
}
function formatTimeFull(iso: string) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function OrderDetailModal({ order, onClose }: Props) {
  const t = useT()
  const navigate = useNavigate()
  const lang = useStore((s) => s.lang)
  const setOrderStatus = useStore((s) => s.setOrderStatus)
  const { haptic } = useTelegram()
  const toast = useToast()

  if (!order) return null

  const isDeposit = order.kind === 'deposit'
  const statusKey = `status_${order.status}` as Parameters<typeof t>[0]
  const statusColor = STATUS_COLOR[order.status] ?? 'rgba(255,255,255,0.6)'
  const cryptoOpt = order.provider ? CRYPTO_OPTIONS.find((c) => c.id === order.provider) : undefined
  const isCompleted = order.status === 'completed'
  const isPaid = order.status === 'paid' || isCompleted
  const isFailed = order.status === 'failed' || order.status === 'expired'

  const copyId = async () => {
    try { await navigator.clipboard.writeText(order.id) } catch { /* ignore */ }
    haptic('success')
    toast.show(lang === 'ru' ? 'ID скопирован' : 'ID copied')
  }

  // Deterministic crunchy stats — derived from order.id so they stay stable.
  const hashSeed = (() => {
    let h = 2166136261
    for (let i = 0; i < order.id.length; i++) {
      h ^= order.id.charCodeAt(i)
      h = (h * 16777619) >>> 0
    }
    return h
  })()
  const confirmationsNeeded = order.provider === 'btc' ? 3
    : order.provider === 'eth' || order.provider === 'erc20' || order.provider === 'usdc_eth' ? 12
    : order.provider === 'sol' || order.provider === 'usdc_sol' ? 32
    : 20
  const confirmationsDone = isCompleted ? confirmationsNeeded
    : isPaid ? Math.max(1, Math.floor(confirmationsNeeded * 0.75))
    : order.status === 'pending' ? Math.min(confirmationsNeeded - 1, hashSeed % confirmationsNeeded)
    : 0
  const blockHeight = (order.provider === 'btc' ? 850_000 : 19_500_000) + (hashSeed % 250_000)
  

  const processedMs = order.paid_at ? new Date(order.paid_at).getTime() - new Date(order.created).getTime() : 0
  const processedLabel = processedMs > 0
    ? (() => {
        const s = Math.max(1, Math.round(processedMs / 1000))
        const mm = Math.floor(s / 60), ss = s % 60
        if (mm === 0) return `00M ${String(ss).padStart(2, '0')}S`
        if (mm < 60) return `${String(mm).padStart(2, '0')}M ${String(ss).padStart(2, '0')}S`
        const h = Math.floor(mm / 60), rm = mm % 60
        return `${String(h).padStart(2, '0')}H ${String(rm).padStart(2, '0')}M`
      })()
    : '—'

  const steps = isDeposit
    ? [
        { label: lang === 'ru' ? 'Создан'   : 'Created',  done: true,        active: !isPaid && !isFailed },
        { label: lang === 'ru' ? 'Оплачен'  : 'Paid',     done: isPaid,      active: isPaid && !isCompleted },
        { label: lang === 'ru' ? 'Зачислен' : 'Credited', done: isCompleted, active: false },
      ]
    : [
        { label: lang === 'ru' ? 'Создан'    : 'Created',   done: true,        active: !isPaid && !isFailed },
        { label: lang === 'ru' ? 'Оплачен'   : 'Paid',      done: isPaid,      active: isPaid && !isCompleted },
        { label: lang === 'ru' ? 'Доставлен' : 'Delivered', done: isCompleted, active: false },
      ]

  const doneCount = steps.filter((s) => s.done).length
  const progressPct = steps.length > 1 ? ((doneCount - 1) / (steps.length - 1)) * 100 : 0

  const refLabel = `${lang === 'ru' ? 'СПРАВКА' : 'REFERENCE'} / ${String(isDeposit ? 2 : 1).padStart(2, '0')} / ${isDeposit ? 'DEPOSIT' : 'ORDER'}`
  const statusLabel = String(t(statusKey)).toUpperCase()

  return (
    <AnimatePresence>
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          style={{
            width: '100%', maxWidth: 480, maxHeight: '94dvh', overflowY: 'auto',
            background: INK,
            border: '1px solid rgba(255,255,255,0.1)',
            borderBottom: 'none',
            borderTopLeftRadius: 32, borderTopRightRadius: 32,
            color: '#fff', fontFamily: DISPLAY,
            position: 'relative',
          }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <div style={{ width: 48, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }} />
          </div>

          {/* Reference header strip */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 24px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              color: 'rgba(255,255,255,0.35)', letterSpacing: '0.22em',
            }}>
              {refLabel}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: statusColor,
                boxShadow: `0 0 8px ${statusColor}`,
                animation: !isFailed && !isCompleted ? 'specPulse 1.6s ease-in-out infinite' : 'none',
              }} />
              <span style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                color: statusColor, letterSpacing: '0.06em',
              }}>
                {statusLabel}
              </span>
            </span>
          </div>

          <div style={{ padding: '24px 24px 28px', display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Primary asset row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isDeposit ? GREEN : '#fff', flexShrink: 0,
                }}>
                  {cryptoOpt
                    ? <CryptoLogo network={cryptoOpt.id} size={38} showBadge />
                    : isDeposit
                      ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                      : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 22, fontWeight: 800, lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {isDeposit
                      ? (cryptoOpt ? cryptoOpt.name : t('order_deposit'))
                      : (order.product_title ?? t('order_buy'))}
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em',
                    textTransform: 'uppercase', marginTop: 4,
                  }}>
                    {cryptoOpt ? cryptoOpt.symbol : (isDeposit ? 'DEPOSIT' : 'ORDER')}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em',
                  textTransform: 'uppercase', marginBottom: 4,
                }}>
                  {lang === 'ru' ? 'СУММА' : 'AMOUNT'}
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 800,
                  color: isDeposit ? GREEN : '#fff',
                  letterSpacing: '-0.04em', lineHeight: 1,
                  display: 'inline-flex', alignItems: 'baseline', gap: 2,
                }}>
                  <span style={{ fontSize: 16, opacity: 0.55 }}>{isDeposit ? '+$' : '$'}</span>
                  {order.amount.toFixed(2)}
                </div>
                {order.quantity && order.quantity > 1 && (
                  <div style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)', marginTop: 4,
                  }}>
                    × {order.quantity}
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal timeline */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{
                position: 'absolute', top: 9, left: 9, right: 9, height: 1,
                background: 'rgba(255,255,255,0.1)',
              }} />
              <div style={{
                position: 'absolute', top: 9, left: 9, height: 1,
                width: `calc((100% - 18px) * ${progressPct / 100})`,
                background: GREEN,
                transition: 'width 400ms cubic-bezier(0.22,1,0.36,1)',
              }} />
              {steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative', zIndex: 1,
                    display: 'flex', flexDirection: 'column',
                    alignItems: i === 0 ? 'flex-start' : i === steps.length - 1 ? 'flex-end' : 'center',
                    gap: 10, flex: 1,
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: step.done ? GREEN : 'rgba(255,255,255,0.08)',
                    boxShadow: step.done ? `0 0 0 4px rgba(57,255,99,0.15)` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: step.done ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  }}>
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: step.done ? INK : 'rgba(255,255,255,0.25)',
                    }} />
                  </div>
                  <span style={{
                    fontFamily: MONO, fontSize: 9, fontWeight: 700,
                    color: step.done ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                  }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Delivery payload — only for paid/completed buy orders */}
            {!isDeposit && order.deliveryData && isPaid && (
              <DeliveryBlock data={order.deliveryData} orderId={order.id} />
            )}
            {!isDeposit && !order.deliveryData && isPaid && !isFailed && (
              <ManualDeliveryBlock
                orderId={order.id}
                productTitle={order.product_title}
                amount={order.amount}
                createdAt={order.created}
              />
            )}
            {order.status === 'pending' && isActiveCryptoInvoice(order) && (
              <div style={{
                background: 'rgba(255,210,74,0.08)',
                border: '1px solid rgba(255,210,74,0.25)',
                borderRadius: 14, padding: '16px',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: AMBER, marginBottom: 6 }}>
                  ⏳ {lang === 'ru' ? 'Ожидает оплаты' : 'Awaiting payment'}
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.6, marginBottom: 14,
                }}>
                  <div>${order.amount.toFixed(2)} · {cryptoOpt?.name ?? order.provider?.toUpperCase()}</div>
                  <div style={{ opacity: 0.55, fontSize: 10 }}>#{order.id.slice(-8)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    if (isDeposit) navigate('/deposit')
                    else if (order.product_id) {
                      navigate(`/product/${order.product_id}`, { state: { resumeCryptoPay: true } })
                    } else navigate('/orders')
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 12,
                    border: 'none',
                    background: GREEN,
                    color: INK,
                    fontFamily: DISPLAY,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    marginBottom: 10,
                  }}
                >
                  {lang === 'ru' ? 'Перейти к оплате' : 'Go to payment'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      if (api.isEnabled()) await api.cancelOrder(order.id)
                      setOrderStatus(order.id, 'expired')
                      haptic('light')
                      toast.show(
                        lang === 'ru' ? 'Счёт отменён' : 'Invoice cancelled',
                        'success',
                      )
                      onClose()
                    })()
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,107,107,0.35)',
                    background: 'rgba(255,107,107,0.1)',
                    color: RED,
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {lang === 'ru' ? 'Отменить счёт' : 'Cancel invoice'}
                </button>
              </div>
            )}
            {order.status === 'pending' && !isActiveCryptoInvoice(order) && (
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '16px',
                fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5,
              }}>
                {lang === 'ru'
                  ? 'Срок оплаты истёк. Создайте новый счёт в пополнении или при оплате товара.'
                  : 'Payment window expired. Create a new invoice from top-up or checkout.'}
              </div>
            )}

            {/* Specimen data grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              {/* Order ID — full width */}
              <button
                onClick={copyId}
                style={{
                  gridColumn: 'span 2',
                  background: INK, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  border: 'none', textAlign: 'left', cursor: 'pointer',
                  color: '#fff',
                }}
              >
                <span style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  color: 'rgba(255,255,255,0.3)', letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}>
                  {lang === 'ru' ? 'ИДЕНТИФИКАТОР' : 'ORDER IDENTIFIER'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{
                    fontFamily: MONO, fontSize: 12, fontWeight: 800,
                    color: GREEN, letterSpacing: '0.1em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {order.id}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </div>
              </button>

              {/* Created */}
              <SpecCell
                label={lang === 'ru' ? 'СОЗДАН' : 'CREATED'}
                value={formatDate(order.created, lang)}
                sub={formatTimeFull(order.created)}
              />

              {/* Paid */}
              <SpecCell
                label={lang === 'ru' ? 'ОПЛАЧЕН' : 'CONFIRMED AT'}
                value={order.paid_at ? formatDate(order.paid_at, lang) : '—'}
                sub={order.paid_at ? formatTimeFull(order.paid_at) : (lang === 'ru' ? 'ожидание' : 'pending')}
                muted={!order.paid_at}
              />

              {/* Processed */}
              <SpecCell
                label={lang === 'ru' ? 'ОБРАБОТКА' : 'PROCESSED IN'}
                value={processedLabel}
                accent={order.paid_at ? GREEN : undefined}
                borderTop
              />

              {/* Confirmations */}
              {cryptoOpt ? (
                <div style={{
                  background: INK, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <span style={{
                    fontFamily: MONO, fontSize: 9, fontWeight: 700,
                    color: 'rgba(255,255,255,0.3)', letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}>
                    {lang === 'ru' ? 'ПОДТВЕРЖДЕНИЯ' : 'CONFIRMS'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 13, fontWeight: 800,
                      color: confirmationsDone >= confirmationsNeeded ? GREEN : AMBER,
                    }}>
                      {confirmationsDone}
                    </span>
                    <span style={{
                      fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.3)',
                    }}>
                      / {confirmationsNeeded}
                    </span>
                  </div>
                </div>
              ) : (
                <SpecCell
                  label={lang === 'ru' ? 'ТИП' : 'TYPE'}
                  value={isDeposit ? (lang === 'ru' ? 'Депозит' : 'Deposit') : (lang === 'ru' ? 'Покупка' : 'Purchase')}
                  borderTop
                />
              )}

              {/* Network */}
              {cryptoOpt && (
                <SpecCell
                  label={lang === 'ru' ? 'СЕТЬ' : 'NETWORK'}
                  value={cryptoOpt.name}
                  borderTop
                />
              )}

              {/* Block */}
              {cryptoOpt && (
                <SpecCell
                  label={lang === 'ru' ? 'БЛОК' : 'BLOCK'}
                  value={`#${blockHeight.toLocaleString('en-US')}`}
                  borderTop
                  underline
                />
              )}




              {/* TXID — full width */}
              {order.txid && order.provider && EXPLORER[order.provider as CryptoNetwork] && (
                <a
                  href={EXPLORER[order.provider as CryptoNetwork](order.txid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    gridColumn: 'span 2',
                    background: 'rgba(57,255,99,0.04)',
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10, textDecoration: 'none', color: '#fff',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 9, fontWeight: 700,
                      color: GREEN, letterSpacing: '0.18em', textTransform: 'uppercase',
                    }}>
                      {lang === 'ru' ? 'TX · BLOCKCHAIN' : 'BLOCKCHAIN TXID'}
                    </span>
                    <span style={{
                      fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.55)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {order.txid}
                    </span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              )}
            </div>

            {/* Action button */}
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%', padding: '18px',
                background: GREEN, color: INK,
                border: 'none', borderRadius: 18,
                fontFamily: DISPLAY, fontSize: 12, fontWeight: 800,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {lang === 'ru' ? 'Закрыть' : 'Close'}
            </motion.button>
          </div>

          {/* Decorative footer line */}
          <div style={{
            height: 1,
            margin: '0 48px 24px',
            background: `linear-gradient(90deg, transparent, ${GREEN}55, transparent)`,
            opacity: 0.5,
          }} />

          <style>{`
            @keyframes specPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.35; }
            }
          `}</style>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function SpecCell({
  label, value, sub, accent, muted, borderTop, underline,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
  muted?: boolean
  borderTop?: boolean
  underline?: boolean
}) {
  return (
    <div style={{
      background: INK, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 6,
      borderTop: borderTop ? '1px solid rgba(255,255,255,0.1)' : undefined,
      minWidth: 0,
    }}>
      <span style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700,
        color: 'rgba(255,255,255,0.3)', letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: MONO, fontSize: 11, fontWeight: 700,
        color: muted ? 'rgba(255,255,255,0.35)' : (accent ?? 'rgba(255,255,255,0.88)'),
        letterSpacing: '0.04em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: underline ? 'underline' : 'none',
        textDecorationColor: 'rgba(57,255,99,0.35)',
        textUnderlineOffset: 3,
      }}>
        {value}
      </span>
      {sub && (
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 500,
          color: muted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.4)',
        }}>
          {sub}
        </span>
      )}
    </div>
  )
}
