import { motion } from 'framer-motion'
import { useStore } from '../store'
import { useToast } from './Toast'
import { useTelegram } from '../hooks/useTelegram'
import type { OrderReceiptPayload } from '../store/types'

const GREEN = '#39ff63'
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const BG = '#161616'
const CHAT_BG = '#0a0a0a'

type Stage = OrderReceiptPayload['stage']

const STAGE_ORDER: Stage[] = ['created', 'processing', 'delivered']

function stageIndex(stage: Stage): number {
  return Math.max(0, STAGE_ORDER.indexOf(stage))
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch { return '' }
}

function formatAmount(amount: number, currency = 'USD'): string {
  const sign = currency === 'USD' ? '$' : ''
  return `${sign}${amount.toFixed(2)}`
}

export default function OrderReceiptMessage({ payload }: { payload: OrderReceiptPayload }) {
  const lang = useStore((s) => s.lang)
  const toast = useToast()
  const { haptic } = useTelegram()
  const idx = stageIndex(payload.stage)
  const delivered = payload.stage === 'delivered'

  const t = (ru: string, en: string) => (lang === 'ru' ? ru : en)

  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value) } catch { }
    haptic('success')
    toast.show(`${label} ${t('скопирован', 'copied')}`, 'success')
  }

  const stages: { key: Stage; label: string }[] = [
    { key: 'created', label: t('Создан', 'Created') },
    { key: 'processing', label: t('В обработке', 'Processing') },
    { key: 'delivered', label: t('Выдан', 'Delivered') },
  ]

  // 0 -> 0%, 1 -> 50%, 2 -> 100%
  const progressPct = idx === 0 ? 0 : idx === 1 ? 50 : 100

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: '100%', maxWidth: 342,
        position: 'relative',
        background: BG,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 18, overflow: 'hidden',
        boxShadow: delivered
          ? `0 18px 48px -16px ${GREEN}55, 0 0 0 1px ${GREEN}33 inset`
          : '0 18px 48px -20px rgba(0,0,0,0.7)',
        fontFamily: DISPLAY,
      }}
    >
      {/* TOP */}
      <div style={{ padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: DISPLAY, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)', marginBottom: 4,
            }}>
              {delivered ? t('Заказ выполнен', 'Order completed') : t('Новый заказ', 'New order')}
            </div>
            <div style={{
              fontFamily: DISPLAY, fontSize: 16, fontWeight: 700,
              color: '#fff', lineHeight: 1.2, letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {payload.productTitle}
            </div>
          </div>
          <div style={{
            background: `${GREEN}1a`, padding: 7, borderRadius: 9,
            display: 'inline-flex', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {delivered ? <path d="M5 13l4 4L19 7" /> : <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></>}
            </svg>
          </div>
        </div>

        {/* Progress track */}
        <div style={{ padding: '0 4px', marginBottom: 26 }}>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
            {/* track bg */}
            <div style={{
              position: 'absolute', top: 6, left: 6, right: 6, height: 2,
              background: 'rgba(255,255,255,0.08)', borderRadius: 2,
            }} />
            {/* track fill */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `calc((100% - 12px) * ${progressPct / 100})` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              style={{
                position: 'absolute', top: 6, left: 6, height: 2,
                background: GREEN, borderRadius: 2,
                boxShadow: `0 0 10px ${GREEN}aa`,
              }}
            />
            {stages.map((s, i) => {
              const isDone = i < idx
              const isActive = i === idx && !delivered
              const isFinalDone = i === idx && delivered
              return (
                <div key={s.key} style={{
                  position: 'relative', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', zIndex: 1,
                }}>
                  {isActive ? (
                    <span style={{
                      position: 'relative', width: 14, height: 14,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: GREEN, opacity: 0.55,
                        animation: 'fvReceiptPing 1.5s cubic-bezier(0,0,0.2,1) infinite',
                      }} />
                      <span style={{
                        position: 'relative', width: 12, height: 12, borderRadius: '50%',
                        background: GREEN, boxShadow: `0 0 12px ${GREEN}`,
                      }} />
                    </span>
                  ) : (
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: isDone || isFinalDone ? GREEN : 'rgba(255,255,255,0.1)',
                      boxShadow: isDone || isFinalDone ? `0 0 8px ${GREEN}88` : 'none',
                    }} />
                  )}
                  <span style={{
                    marginTop: 10, fontFamily: DISPLAY, fontSize: 10,
                    fontWeight: isActive || isFinalDone ? 700 : 500,
                    color: isActive || isFinalDone
                      ? GREEN
                      : isDone
                        ? 'rgba(255,255,255,0.62)'
                        : 'rgba(255,255,255,0.22)',
                    letterSpacing: '-0.01em',
                  }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Perforation */}
      <div style={{ position: 'relative', height: 16 }}>
        <div style={{
          position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
          width: 16, height: 16, borderRadius: '50%', background: CHAT_BG,
        }} />
        <div style={{
          position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
          width: 16, height: 16, borderRadius: '50%', background: CHAT_BG,
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: 14, right: 14, height: 1,
          borderTop: '1px dashed rgba(255,255,255,0.12)',
        }} />
      </div>

      {/* BOTTOM */}
      <div style={{ padding: '4px 18px 16px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 12, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{
              fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.32)',
              letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
              {t('Сумма', 'Amount')}
            </span>
            <button
              onClick={() => copy(payload.amount.toFixed(2), t('Сумма', 'Amount'))}
              style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: MONO, fontSize: 20, fontWeight: 700, color: '#fff',
                letterSpacing: '-0.02em',
              }}
            >
              {formatAmount(payload.amount, payload.currency)}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', minWidth: 0 }}>
            <span style={{
              fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.32)',
              letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
              {t('Номер', 'Order ID')}
            </span>
            <button
              onClick={() => copy(payload.orderId, 'ID')}
              style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.7)',
                letterSpacing: '-0.01em',
                maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {payload.orderId}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{
          paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {!delivered ? (
              <>
                <span style={{
                  position: 'relative', width: 8, height: 8, display: 'inline-flex',
                }}>
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: '50%', background: GREEN,
                    opacity: 0.75,
                    animation: 'fvReceiptPing 1.5s cubic-bezier(0,0,0.2,1) infinite',
                  }} />
                  <span style={{
                    position: 'relative', width: 8, height: 8, borderRadius: '50%', background: GREEN,
                  }} />
                </span>
                <span style={{
                  fontFamily: DISPLAY, fontSize: 11, color: 'rgba(255,255,255,0.55)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t('оператор уже видит ваш заказ', 'operator is reviewing your order')}
                </span>
              </>
            ) : (
              <>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: GREEN,
                  boxShadow: `0 0 10px ${GREEN}`,
                }} />
                <span style={{
                  fontFamily: DISPLAY, fontSize: 11, color: GREEN, fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>
                  {t('Заказ выдан', 'Order delivered')}
                </span>
              </>
            )}
          </div>
          <span style={{
            fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.25)',
            flexShrink: 0,
          }}>
            {formatTime(delivered && payload.deliveredAt ? payload.deliveredAt : payload.createdAt)}
          </span>
        </div>
      </div>

      {/* barcode trim */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, transparent, ${GREEN}55, transparent)`,
      }} />

      <style>{`
        @keyframes fvReceiptPing {
          0%   { transform: scale(1);   opacity: 0.75; }
          80%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </motion.div>
  )
}
