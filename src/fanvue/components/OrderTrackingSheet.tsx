import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import { useTelegram } from '../hooks/useTelegram'
import { CONFIG } from '../config'
import { openTelegramWithText } from '../utils/telegramLink'
import type { Order } from '../store/types'

interface Props {
  order: Order
  onClose: () => void
}


function StatusBar({ status }: { status: Order['status'] }) {
  const steps = [
    { key: 'paid',      labelRu: 'Оплачено',          labelEn: 'Paid',          icon: '✅' },
    { key: 'preparing', labelRu: 'Ожидает выдачи',     labelEn: 'Awaiting',      icon: '📦' },
    { key: 'completed', labelRu: 'Выполнено',           labelEn: 'Completed',     icon: '🎉' },
  ]

  const activeIdx = status === 'completed' ? 2 : status === 'paid' ? 1 : 0
  const lang = useStore((s) => s.lang)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 24 }}>
      {steps.map((step, i) => {
        const done    = i <= activeIdx
        const current = i === activeIdx
        const isLast  = i === steps.length - 1

        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', flex: i < steps.length - 1 ? 1 : 0 }}>
            {/* Step circle + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 64 }}>
              <motion.div
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: done
                    ? (status === 'completed' && i === 2 ? 'var(--g-brand)' : 'rgba(73,242,100,0.15)')
                    : 'var(--surface-2)',
                  border: done
                    ? `2px solid ${current && status !== 'completed' ? 'var(--orange)' : 'var(--success)'}`
                    : '2px solid var(--b-default)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                  boxShadow: current && status !== 'completed'
                    ? '0 0 12px rgba(255,165,0,0.4)'
                    : done ? '0 0 8px rgba(73,242,100,0.3)' : 'none',
                }}
                initial={false}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
              >
                {current && status === 'paid' && i === 1
                  ? <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid var(--orange)', borderTopColor: 'transparent' }}
                    />
                  : done ? step.icon : <span style={{ fontSize: 14, color: 'var(--t-muted)' }}>{i + 1}</span>
                }
              </motion.div>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: done ? (current && status !== 'completed' ? 'var(--orange)' : 'var(--success)') : 'var(--t-muted)',
                textAlign: 'center', lineHeight: 1.3, maxWidth: 60,
              }}>
                {lang === 'ru' ? step.labelRu : step.labelEn}
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div style={{
                flex: 1, height: 2, marginTop: 20,
                background: 'var(--b-default)',
                overflow: 'hidden', position: 'relative',
              }}>
                {i < activeIdx && (
                  <motion.div
                    style={{ position: 'absolute', inset: 0, background: 'var(--success)' }}
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ delay: i * 0.15 + 0.2, duration: 0.4 }}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function OrderTrackingSheet({ order, onClose }: Props) {
  const navigate            = useNavigate()
  const lang                = useStore((s) => s.lang)
  const siteLinks           = useStore((s) => s.siteLinks)
  const addMsg              = useStore((s) => s.addSupportMessage)
  const forwarded           = useStore((s) => s.supportForwardedOrders)
  const markOrderForwarded  = useStore((s) => s.markOrderForwarded)
  const { haptic }          = useTelegram()
  const [showSupportPreview, setShowSupportPreview] = useState(false)

  const alreadyForwarded = forwarded.includes(order.id)

  const isCompleted  = order.status === 'completed'
  const isPaid       = order.status === 'paid'

  const productTitle = order.product_title ?? ''
  const isVerification =
    productTitle === 'Верификация вашего аккаунта' || productTitle === 'Verify your account'

  const paidAt = order.paid_at ? new Date(order.paid_at).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
  const qtyStr = order.quantity && order.quantity > 1 ? ` × ${order.quantity}` : ''

  const supportMsg = lang === 'ru'
    ? `🛍 FANVUE MARKET — Заявка на выдачу\n${'─'.repeat(32)}\n\n📦 Товар:   ${order.product_title ?? 'Товар'}${qtyStr}\n🆔 Заказ:   #${order.id}\n💵 Сумма:   $${order.amount.toFixed(2)}\n📅 Оплачен: ${paidAt}\n${'─'.repeat(32)}\n\n✅ Оплата подтверждена.\nПожалуйста, выдайте товар. Спасибо! 🙏`
    : `🛍 FANVUE MARKET — Delivery Request\n${'─'.repeat(32)}\n\n📦 Item:    ${order.product_title ?? 'Product'}${qtyStr}\n🆔 Order:   #${order.id}\n💵 Amount:  $${order.amount.toFixed(2)}\n📅 Paid at: ${paidAt}\n${'─'.repeat(32)}\n\n✅ Payment confirmed.\nPlease deliver my order. Thank you! 🙏`

  function handleSupport() {
    if (alreadyForwarded) return
    haptic('success')
    markOrderForwarded(order.id)
    addMsg({ id: Date.now(), sender: 'user', text: supportMsg, created: new Date().toISOString() })
    // Verification service — append a beautifully styled intake card from the bot
    const title = order.product_title ?? ''
    const isVerification =
      title === 'Верификация вашего аккаунта' || title === 'Verify your account'
    if (isVerification) {
      addMsg({
        id: Date.now() + 1,
        sender: 'bot',
        kind: 'system',
        text: `verification_intake:${order.id}`,
        created: new Date(Date.now() + 1).toISOString(),
      })
    }
    onClose()
    navigate('/support')
  }

  function handleTelegram() {
    haptic('light')
    openTelegramWithText(siteLinks.adminUrl, supportMsg, CONFIG.adminUsername)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          className="sheet"
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          style={{ maxHeight: '90dvh', overflowY: 'auto' }}
        >
          <div className="sheet-handle" style={{ cursor: 'grab' }} />

          {/* Header */}
          <div className="row-between mb-4">
            <div>
              <div className="t-xs t-muted mb-1">{lang === 'ru' ? 'Отслеживание заказа' : 'Order Tracking'}</div>
              <div className="t-lg fw-black">{order.product_title ?? (lang === 'ru' ? 'Ваш заказ' : 'Your Order')}</div>
            </div>
            <motion.button onClick={onClose} whileTap={{ scale: 0.9 }} style={{ color: 'var(--t-muted)', fontSize: 22, lineHeight: 1 }}>×</motion.button>
          </div>

          {/* Order details card */}
          <div className="card mb-5" style={{ padding: '14px 16px' }}>
            <div className="row-between mb-2">
              <span className="t-xs t-muted">ID</span>
              <span className="t-xs fw-bold" style={{ fontFamily: 'monospace', color: 'var(--brand)' }}>{order.id}</span>
            </div>
            <div className="row-between mb-2">
              <span className="t-xs t-muted">{lang === 'ru' ? 'Сумма' : 'Amount'}</span>
              <span className="t-md fw-black">${order.amount.toFixed(2)}</span>
            </div>
            {order.quantity && order.quantity > 1 && (
              <div className="row-between mb-2">
                <span className="t-xs t-muted">{lang === 'ru' ? 'Кол-во' : 'Qty'}</span>
                <span className="t-sm fw-bold">{order.quantity}</span>
              </div>
            )}
            <div className="row-between">
              <span className="t-xs t-muted">{lang === 'ru' ? 'Оплачен' : 'Paid at'}</span>
              <span className="t-xs">{order.paid_at ? new Date(order.paid_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            </div>
          </div>

          {/* Status bar */}
          <div className="t-xs t-muted fw-bold mb-3" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {lang === 'ru' ? 'Статус выполнения' : 'Delivery status'}
          </div>
          <StatusBar status={order.status} />

          {/* Completed state */}
          {isCompleted && (
            <motion.div
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                textAlign: 'center', padding: '20px 16px',
                background: 'rgba(73,242,100,0.08)',
                border: '1px solid rgba(73,242,100,0.2)',
                borderRadius: 16, marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
              <div className="t-md fw-black" style={{ color: 'var(--success)' }}>
                {lang === 'ru' ? 'Заказ выполнен!' : 'Order Completed!'}
              </div>
              <div className="t-xs t-muted mt-2">
                {lang === 'ru' ? 'Спасибо, что выбрали Fanvue Market' : 'Thank you for choosing Fanvue Market'}
              </div>
            </motion.div>
          )}

          {/* Pending — awaiting payment */}
          {order.status === 'pending' && (
            <div style={{
              background: 'rgba(255,210,74,0.08)',
              border: '1px solid rgba(255,210,74,0.25)',
              borderRadius: 14, padding: '16px', marginBottom: 20,
            }}>
              <div className="t-sm fw-bold" style={{ color: 'var(--orange)', marginBottom: 4 }}>
                ⏳ {lang === 'ru' ? 'Ожидает оплаты' : 'Awaiting payment'}
              </div>
              <div className="t-xs t-muted">
                {lang === 'ru'
                  ? 'Переведите криптовалюту на указанный кошелёк. Кнопки поддержки станут доступны после оплаты.'
                  : 'Send crypto to the specified wallet. Support buttons will appear after payment is confirmed.'}
              </div>
            </div>
          )}

          {/* Paid — waiting for delivery */}
          {isPaid && (
            <AnimatePresence mode="wait">
              {!showSupportPreview ? (
                <motion.div key="prompt"
                  initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                >
                  <div style={{
                    background: 'rgba(255,165,0,0.08)',
                    border: '1px solid rgba(255,165,0,0.25)',
                    borderRadius: 14, padding: '14px 16px', marginBottom: 20,
                  }}>
                    <div className="t-sm fw-bold" style={{ color: 'var(--orange)', marginBottom: 4 }}>
                      ⏳ {lang === 'ru' ? 'Администратор готовит ваш заказ' : 'Admin is preparing your order'}
                    </div>
                    <div className="t-xs t-muted">
                      {lang === 'ru'
                        ? 'Напишите нам — приложите ID заказа, и мы выдадим ваш товар как можно скорее.'
                        : 'Contact us with your order ID and we\'ll deliver your product as soon as possible.'}
                    </div>
                  </div>

                  <div className="t-sm fw-bold mb-3">{lang === 'ru' ? 'Получить товар' : 'Get my order'}</div>
                  <div className="col gap-3">
                    {!isVerification && (
                      <motion.button
                        onClick={() => setShowSupportPreview(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '16px 18px',
                          background: 'var(--surface-2)',
                          border: '1.5px solid var(--b-default)',
                          borderRadius: 16, textAlign: 'left',
                        }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(var(--brand-rgb),0.12)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💬</div>
                        <div>
                          <div className="t-sm fw-bold">{lang === 'ru' ? 'Написать в поддержку' : 'Write to Support'}</div>
                          <div className="t-xs t-muted mt-1">{lang === 'ru' ? 'Чат прямо в этом боте' : 'Chat right here in the bot'}</div>
                        </div>
                      </motion.button>
                    )}

                    <motion.button
                      onClick={handleTelegram}
                      style={isVerification ? {
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '16px 18px',
                        background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 16, textAlign: 'left',
                        color: '#fff',
                        boxShadow: '0 10px 28px rgba(34,158,217,0.35)',
                      } : {
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '16px 18px',
                        background: 'var(--surface-2)',
                        border: '1.5px solid var(--b-default)',
                        borderRadius: 16, textAlign: 'left',
                      }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: isVerification ? 'rgba(255,255,255,0.18)' : 'rgba(0,136,204,0.12)',
                        color: isVerification ? '#fff' : '#0088cc',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                      }}>✈️</div>
                      <div>
                        <div className="t-sm fw-bold" style={isVerification ? { color: '#fff' } : undefined}>
                          {lang === 'ru' ? 'Написать в Telegram' : 'Message on Telegram'}
                        </div>
                        <div className="t-xs mt-1" style={{ color: isVerification ? 'rgba(255,255,255,0.85)' : 'var(--t-muted)' }}>
                          @{CONFIG.adminUsername}
                        </div>
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="confirm"
                  initial={false} animate={{ opacity: 1, y: 0 }}
                  className="col gap-3"
                >
                  {/* Preview of auto-message */}
                  <div style={{
                    background: 'var(--surface-2)', borderRadius: 14,
                    padding: '14px 16px', borderLeft: '3px solid var(--brand)',
                  }}>
                    <div className="t-xs t-muted mb-2">{lang === 'ru' ? 'Будет отправлено:' : 'Will be sent:'}</div>
                    <div className="t-sm" style={{ lineHeight: 1.6, whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: 12 }}>
                      {supportMsg}
                    </div>
                  </div>

                  <motion.button
                    className={`btn ${alreadyForwarded ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleSupport}
                    disabled={alreadyForwarded}
                    whileTap={{ scale: alreadyForwarded ? 1 : 0.97 }}
                  >
                    {alreadyForwarded
                      ? (lang === 'ru' ? '✅ Уже отправлено' : '✅ Already sent')
                      : `💬 ${lang === 'ru' ? 'Отправить в поддержку →' : 'Send to Support →'}`}
                  </motion.button>

                  <motion.button className="btn btn-ghost" onClick={() => setShowSupportPreview(false)} whileTap={{ scale: 0.97 }}>
                    ← {lang === 'ru' ? 'Назад' : 'Back'}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
