import { useState, useRef, useEffect, type CSSProperties, type PointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { useTelegram } from '../hooks/useTelegram'
import { tgNotify } from '../utils/tgNotify'
import { isValidCryptoAddress, isValidAmount, rateLimit, audit, sanitizeText } from '../utils/security'
import CryptoLogo from './CryptoLogo'
import type { CryptoNetwork, RefWithdrawal } from '../store/types'

interface Props {
  open: boolean
  onClose: () => void
}

type Step = 'amount' | 'network' | 'address' | 'confirm' | 'done'

const GREEN = '#39FF63'
const INK = '#050505'
const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const BODY = "'DM Sans', system-ui, sans-serif"
const MONO = "'JetBrains Mono', 'Space Mono', ui-monospace, monospace"

const eyebrow: CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.32em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
  fontStyle: 'italic',
}

const sectionLabel: CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: '#fff',
}

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 4,
  padding: '14px 16px',
  color: '#fff',
  fontFamily: MONO,
  fontSize: 15,
  outline: 'none',
}

const primaryBtn = (disabled = false): CSSProperties => ({
  width: '100%',
  background: disabled ? 'rgba(57,255,99,0.18)' : GREEN,
  color: INK,
  fontFamily: DISPLAY,
  fontWeight: 700,
  fontSize: 13,
  padding: '16px 16px',
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
  border: 'none',
  borderRadius: '0 0 28px 0',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
})

const ghostBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.18)',
  color: 'rgba(255,255,255,0.8)',
  fontFamily: DISPLAY,
  fontWeight: 700,
  fontSize: 11,
  padding: '14px 16px',
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
  borderRadius: 4,
  cursor: 'pointer',
}

const STATUS_COLOR: Record<RefWithdrawal['status'], string> = {
  pending: 'rgba(255,255,255,0.55)',
  completed: GREEN,
  rejected: '#ff5050',
}

function StatusLabel({ status, lang }: { status: RefWithdrawal['status']; lang: 'ru' | 'en' }) {
  const label =
    status === 'pending'
      ? lang === 'ru'
        ? 'В обработке'
        : 'Pending'
      : status === 'completed'
        ? lang === 'ru'
          ? 'Выплачено'
          : 'Paid'
        : lang === 'ru'
          ? 'Отклонено'
          : 'Rejected'
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 700,
        color: STATUS_COLOR[status],
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
      }}
    >
      {label}
    </span>
  )
}

export default function RefWithdrawSheet({ open, onClose }: Props) {
  const lang = useStore((s) => s.lang) as 'ru' | 'en'
  const user = useStore((s) => s.user)
  const allowedNetworks = useStore((s) => s.refWithdrawNetworks)
  const refWithdrawals = useStore((s) => s.refWithdrawals)
  const addRefWithdrawal = useStore((s) => s.addRefWithdrawal)
  const spendRefBalance = useStore((s) => s.spendRefBalance)
  const { haptic } = useTelegram()

  const [step, setStep] = useState<Step>('amount')
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState<CryptoNetwork | null>(null)
  const [address, setAddress] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const trackRef = useRef<HTMLDivElement>(null)

  const swipeProgressRef = useRef(0)
  const [trackW, setTrackW] = useState(0)
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const thumbW = 58
  const maxX = Math.max(trackW - thumbW - 8, 0)
  const swipeProgress = maxX > 0 ? Math.min(swipeX / maxX, 1) : 0

  useEffect(() => {
    if (open) {
      setStep('amount')
      setAmount('')
      setNetwork(null)
      setAddress('')
      setSwipeX(0)
      swipeProgressRef.current = 0
      setIsSwiping(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !trackRef.current) return
    const measure = () => setTrackW(trackRef.current?.offsetWidth ?? 0)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(trackRef.current)
    return () => observer.disconnect()
  }, [open, step])

  if (!user) return null
  const balance = user.ref_balance
  const MIN_WITHDRAW = 10
  const amountNum = parseFloat(amount) || 0
  const amountValid = amountNum >= MIN_WITHDRAW && amountNum <= balance

  const [addressError, setAddressError] = useState<string | null>(null)

  function handleSubmit() {
    if (!network) return
    if (!isValidAmount(amountNum, MIN_WITHDRAW, balance)) return
    const freshBalance = useStore.getState().user?.ref_balance ?? 0
    if (amountNum > freshBalance) return
    if (!isValidCryptoAddress(address.trim(), network)) {
      setAddressError(lang === 'ru' ? 'Некорректный адрес для выбранной сети' : 'Invalid address for selected network')
      return
    }
    if (!rateLimit('ref_withdraw', 3, 120_000)) return
    const sanitizedAddr = sanitizeText(address.trim())
    audit('ref_withdraw', user?.uid, { amount: amountNum, network, address: sanitizedAddr })
    const newId = `RW-${Date.now()}`
    spendRefBalance(amountNum)
    addRefWithdrawal({ id: newId, uid: user?.uid, amount: amountNum, network, address: sanitizedAddr, status: 'pending' } as Parameters<typeof addRefWithdrawal>[0])
    setCreatedId(newId)
    haptic('success')
    tgNotify(
      `💸 Реферальный вывод\n🆔 ${newId}\n👤 ${user?.username ? '@' + user.username : user?.full_name ?? '—'} (ID: ${user?.uid})\n💵 $${amountNum.toFixed(2)} · ${network.toUpperCase()}\n📬 ${sanitizedAddr}`,
    )
    setStep('done')
  }

  const pointerStartRef = useRef<{ id: number; startX: number; startOffset: number; trackW: number } | null>(null)

  function getMaxX(width: number) {
    return Math.max(width - thumbW - 8, 0)
  }

  function handleSwipePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    const el = e.currentTarget as HTMLDivElement
    const width = el.offsetWidth
    if (width !== trackW) setTrackW(width)
    try { el.setPointerCapture(e.pointerId) } catch {}
    pointerStartRef.current = { id: e.pointerId, startX: e.clientX, startOffset: swipeX, trackW: width }
    setIsSwiping(true)
  }

  function handleSwipePointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start || start.id !== e.pointerId) return
    e.stopPropagation()
    const localMax = getMaxX(start.trackW)
    const next = Math.min(Math.max(start.startOffset + (e.clientX - start.startX), 0), localMax)
    swipeProgressRef.current = localMax > 0 ? next / localMax : 0
    setSwipeX(next)
  }

  function handleSwipePointerEnd(e: PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start || start.id !== e.pointerId) return
    e.stopPropagation()
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId) } catch {}
    pointerStartRef.current = null
    setIsSwiping(false)
    if (swipeProgressRef.current >= 0.6) {
      const localMax = getMaxX(start.trackW)
      swipeProgressRef.current = 1
      setSwipeX(localMax)
      handleSubmit()
    } else {
      swipeProgressRef.current = 0
      setSwipeX(0)
    }
  }


  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const netOpt = CRYPTO_OPTIONS.find((o) => o.id === network)
  const stepNum =
    step === 'amount' ? '01' : step === 'network' ? '02' : step === 'address' ? '03' : step === 'confirm' ? '04' : '05'
  const stepTitle =
    step === 'amount'
      ? lang === 'ru' ? 'Сумма' : 'Amount'
      : step === 'network'
        ? lang === 'ru' ? 'Сеть' : 'Network'
        : step === 'address'
          ? lang === 'ru' ? 'Адрес' : 'Address'
          : step === 'confirm'
            ? lang === 'ru' ? 'Подтверждение' : 'Confirm'
            : lang === 'ru' ? 'Готово' : 'Done'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(8px)',
              zIndex: 100,
            }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 101,
              background: INK,
              borderTop: `1px solid rgba(57,255,99,0.25)`,
              borderRadius: '24px 24px 0 0',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: BODY,
              color: '#fff',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Handle + close */}
            <div
              onClick={onClose}
              style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, flexShrink: 0, cursor: 'pointer' }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: GREEN, fontWeight: 700 }}>/{stepNum}</span>
                <span
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 18,
                    fontWeight: 700,
                    fontStyle: 'italic',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {stepTitle}
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '22px 20px 28px' }}>
              <AnimatePresence mode="wait">
                {/* STEP: AMOUNT */}
                {step === 'amount' && (
                  <motion.div
                    key="amount"
                    initial={false}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                  >
                    <div style={eyebrow}>{lang === 'ru' ? 'Доступно' : 'Available'}</div>
                    <div
                      style={{
                        fontFamily: DISPLAY,
                        fontWeight: 700,
                        fontSize: 48,
                        lineHeight: 1,
                        letterSpacing: '-0.04em',
                        marginTop: 8,
                        marginBottom: 18,
                        display: 'flex',
                        alignItems: 'baseline',
                      }}
                    >
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 30, marginRight: 4 }}>$</span>
                      <span>{balance.toFixed(2).split('.')[0]}</span>
                      <span style={{ color: GREEN, opacity: 0.85 }}>.{balance.toFixed(2).split('.')[1]}</span>
                    </div>

                    {/* Min notice */}
                    <div
                      style={{
                        background:
                          balance >= MIN_WITHDRAW ? 'rgba(57,255,99,0.06)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${balance >= MIN_WITHDRAW ? 'rgba(57,255,99,0.25)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 4,
                        padding: '12px 14px',
                        marginBottom: 24,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: BODY,
                          fontSize: 13,
                          fontWeight: 600,
                          color: balance >= MIN_WITHDRAW ? GREEN : '#fff',
                          marginBottom: 4,
                        }}
                      >
                        {lang === 'ru' ? `Минимум $${MIN_WITHDRAW}` : `Minimum $${MIN_WITHDRAW}`}
                      </div>
                      <div style={{ fontFamily: BODY, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                        {balance >= MIN_WITHDRAW
                          ? lang === 'ru'
                            ? 'Баланс достаточен для вывода'
                            : 'Balance is sufficient'
                          : lang === 'ru'
                            ? `Нужно ещё $${(MIN_WITHDRAW - balance).toFixed(2)}`
                            : `Need $${(MIN_WITHDRAW - balance).toFixed(2)} more`}
                      </div>
                    </div>

                    <div style={{ ...sectionLabel, marginBottom: 10 }}>
                      {lang === 'ru' ? 'Сумма вывода' : 'Withdrawal amount'}
                    </div>
                    <div style={{ position: 'relative', marginBottom: 10 }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="100.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        style={{ ...inputStyle, paddingRight: 70 }}
                      />
                      <button
                        onClick={() => setAmount(balance.toFixed(2))}
                        style={{
                          position: 'absolute',
                          right: 6,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontFamily: DISPLAY,
                          fontSize: 10,
                          fontWeight: 700,
                          color: GREEN,
                          background: 'rgba(57,255,99,0.1)',
                          border: '1px solid rgba(57,255,99,0.3)',
                          padding: '8px 12px',
                          borderRadius: 999,
                          textTransform: 'uppercase',
                          letterSpacing: '0.18em',
                          cursor: 'pointer',
                        }}
                      >
                        Max
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        marginBottom: 24,
                        background: 'rgba(57,255,99,0.04)',
                        border: '1px solid rgba(57,255,99,0.14)',
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'rgba(57,255,99,0.12)',
                          color: GREEN,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        ⓘ
                      </div>
                      <div style={{ fontFamily: DISPLAY, fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>
                        {lang === 'ru' ? (
                          <>1 реферал = <span style={{ color: GREEN, fontWeight: 700 }}>$5</span> фиксировано</>
                        ) : (
                          <>1 referral = <span style={{ color: GREEN, fontWeight: 700 }}>$5</span> fixed</>
                        )}
                      </div>
                    </div>

                    <button
                      style={primaryBtn(!amountValid)}
                      disabled={!amountValid}
                      onClick={() => {
                        haptic('light')
                        setStep('network')
                      }}
                    >
                      {lang === 'ru' ? 'Продолжить →' : 'Continue →'}
                    </button>

                    {/* History */}
                    {refWithdrawals.length > 0 && (
                      <div style={{ marginTop: 32 }}>
                        <div style={{ ...eyebrow, marginBottom: 12 }}>
                          {lang === 'ru' ? 'История' : 'History'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {refWithdrawals.map((w) => (
                            <button
                              key={w.id}
                              onClick={() => {
                                haptic('light')
                                setDetailId(w.id)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                background: 'transparent',
                                border: 'none',
                                borderBottomColor: 'rgba(255,255,255,0.06)',
                                borderBottomStyle: 'solid',
                                borderBottomWidth: 1,
                                width: '100%',
                                textAlign: 'left',
                                cursor: 'pointer',
                                color: '#fff',
                              }}
                            >
                              <CryptoLogo network={w.network} size={28} showBadge />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontFamily: DISPLAY,
                                    fontSize: 15,
                                    fontWeight: 700,
                                    letterSpacing: '-0.01em',
                                  }}
                                >
                                  ${w.amount.toFixed(2)}
                                </div>
                                <div
                                  style={{
                                    fontFamily: MONO,
                                    fontSize: 10,
                                    color: 'rgba(255,255,255,0.4)',
                                    marginTop: 2,
                                  }}
                                >
                                  {formatDate(w.createdAt)}
                                </div>
                                {w.status === 'rejected' && w.rejectReason && (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      padding: '6px 8px',
                                      background: 'rgba(255,80,80,0.08)',
                                      border: '1px solid rgba(255,80,80,0.25)',
                                      borderRadius: 6,
                                      fontFamily: BODY,
                                      fontSize: 11,
                                      lineHeight: 1.35,
                                      color: 'rgba(255,180,180,0.95)',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    <span style={{ color: '#ff8080', fontWeight: 700 }}>
                                      {lang === 'ru' ? 'Комментарий: ' : 'Comment: '}
                                    </span>
                                    {w.rejectReason}
                                  </div>
                                )}
                              </div>
                              <StatusLabel status={w.status} lang={lang} />
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, marginLeft: 4 }}>›</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* STEP: NETWORK */}
                {step === 'network' && (
                  <motion.div
                    key="network"
                    initial={false}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                  >
                    <div style={{ ...sectionLabel, marginBottom: 14 }}>
                      {lang === 'ru' ? 'Выберите сеть' : 'Select network'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                      {CRYPTO_OPTIONS.filter((o) => allowedNetworks.includes(o.id)).map((opt) => {
                        const active = network === opt.id
                        return (
                          <button
                            key={opt.id}
                            onClick={() => {
                              haptic('light')
                              setNetwork(opt.id)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 14,
                              padding: '14px 16px',
                              background: active ? 'rgba(57,255,99,0.08)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${active ? 'rgba(57,255,99,0.5)' : 'rgba(255,255,255,0.08)'}`,
                              borderRadius: 4,
                              textAlign: 'left',
                              cursor: 'pointer',
                              color: '#fff',
                            }}
                          >
                            <CryptoLogo network={opt.id} size={32} showBadge />
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontFamily: DISPLAY,
                                  fontSize: 14,
                                  fontWeight: 700,
                                  letterSpacing: '-0.01em',
                                }}
                              >
                                {opt.name}
                              </div>
                              <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                {opt.symbol}
                              </div>
                            </div>
                            {active && (
                              <span style={{ color: GREEN, fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>✓</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={{ ...ghostBtn, flex: 1 }} onClick={() => setStep('amount')}>
                        ← {lang === 'ru' ? 'Назад' : 'Back'}
                      </button>
                      <div style={{ flex: 2 }}>
                        <button
                          style={primaryBtn(!network)}
                          disabled={!network}
                          onClick={() => {
                            haptic('light')
                            setStep('address')
                          }}
                        >
                          {lang === 'ru' ? 'Далее →' : 'Next →'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP: ADDRESS */}
                {step === 'address' && (
                  <motion.div
                    key="address"
                    initial={false}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                  >
                    {netOpt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                        <CryptoLogo network={netOpt.id} size={28} showBadge />
                        <div>
                          <div style={{ ...eyebrow, marginBottom: 2 }}>{lang === 'ru' ? 'Сеть' : 'Network'}</div>
                          <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                            {netOpt.name}
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{ ...sectionLabel, marginBottom: 10 }}>
                      {lang === 'ru' ? 'Адрес кошелька' : 'Wallet address'}
                    </div>
                    <input
                      type="text"
                      placeholder={lang === 'ru' ? 'Вставьте адрес' : 'Paste address'}
                      value={address}
                      onChange={(e) => { setAddress(e.target.value); setAddressError(null) }}
                      style={{ ...inputStyle, marginBottom: 4, borderColor: addressError ? 'rgba(255,80,80,0.6)' : undefined }}
                    />
                    {addressError ? (
                      <div style={{ fontFamily: MONO, fontSize: 10, color: '#ff5050', marginBottom: 20, letterSpacing: '0.06em' }}>
                        {addressError}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 10,
                          color: network && address.trim().length >= 10 && isValidCryptoAddress(address.trim(), network) ? GREEN : 'rgba(255,255,255,0.4)',
                          marginBottom: 20,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {network && address.trim().length >= 10 && isValidCryptoAddress(address.trim(), network)
                          ? (lang === 'ru' ? '✓ Адрес валиден' : '✓ Address valid')
                          : (lang === 'ru' ? 'Адрес должен соответствовать сети' : 'Address must match the network')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={{ ...ghostBtn, flex: 1 }} onClick={() => { setStep('network'); setAddressError(null) }}>
                        ← {lang === 'ru' ? 'Назад' : 'Back'}
                      </button>
                      <div style={{ flex: 2 }}>
                        <button
                          style={primaryBtn(!network || address.trim().length < 10 || !isValidCryptoAddress(address.trim(), network))}
                          disabled={!network || address.trim().length < 10 || !isValidCryptoAddress(address.trim(), network)}
                          onClick={() => {
                            if (network && !isValidCryptoAddress(address.trim(), network)) {
                              setAddressError(lang === 'ru' ? 'Некорректный адрес для выбранной сети' : 'Invalid address for selected network')
                              return
                            }
                            haptic('light')
                            setAddressError(null)
                            setStep('confirm')
                          }}
                        >
                          {lang === 'ru' ? 'Далее →' : 'Next →'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP: CONFIRM */}
                {step === 'confirm' && (
                  <motion.div
                    key="confirm"
                    initial={false}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                  >
                    <div style={{ ...sectionLabel, marginBottom: 14 }}>
                      {lang === 'ru' ? 'Проверьте детали' : 'Review details'}
                    </div>
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 4,
                        padding: 4,
                        marginBottom: 22,
                      }}
                    >
                      {[
                        { label: lang === 'ru' ? 'Сумма' : 'Amount', value: `$${amountNum.toFixed(2)}`, accent: true },
                        { label: lang === 'ru' ? 'Сеть' : 'Network', value: netOpt?.name ?? '' },
                        { label: lang === 'ru' ? 'Адрес' : 'Address', value: address, mono: true },
                      ].map((row, i, arr) => (
                        <div
                          key={row.label}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 14,
                            padding: '14px 12px',
                            borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: MONO,
                              fontSize: 10,
                              color: 'rgba(255,255,255,0.45)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.12em',
                              flexShrink: 0,
                              paddingTop: 2,
                            }}
                          >
                            {row.label}
                          </span>
                          <span
                            style={{
                              fontFamily: row.mono ? MONO : DISPLAY,
                              fontSize: row.mono ? 11 : 14,
                              fontWeight: 700,
                              color: row.accent ? GREEN : '#fff',
                              maxWidth: 200,
                              textAlign: 'right',
                              wordBreak: 'break-all',
                            }}
                          >
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Swipe to confirm */}
                    <div
                      ref={trackRef}
                      style={{
                        position: 'relative',
                        height: 66,
                        borderRadius: 999,
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))',
                        border: '1px solid rgba(57,255,99,0.18)',
                        overflow: 'hidden',
                        marginBottom: 14,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        touchAction: 'none',
                        cursor: isSwiping ? 'grabbing' : 'grab',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 42px rgba(0,0,0,0.35)',
                      }}
                      onPointerDown={handleSwipePointerDown}
                      onPointerMove={handleSwipePointerMove}
                      onPointerUp={handleSwipePointerEnd}
                      onPointerCancel={handleSwipePointerEnd}
                    >
                      {/* progress fill */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${thumbW + 8 + swipeProgress * Math.max(trackW - thumbW - 8, 0)}px`,
                          background: `linear-gradient(90deg, rgba(57,255,99,0.24), rgba(57,255,99,0.72))`,
                          transition: isSwiping ? 'none' : 'width 220ms cubic-bezier(.2,.8,.2,1)',
                          boxShadow: swipeProgress > 0.08 ? '0 0 34px rgba(57,255,99,0.18)' : 'none',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: 66,
                          right: 22,
                          top: '50%',
                          height: 1,
                          background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 8px, transparent 8px 16px)',
                          transform: 'translateY(-50%)',
                          opacity: 0.55,
                        }}
                      />
                      {/* label */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: DISPLAY,
                          fontSize: 12,
                          fontWeight: 700,
                          color: swipeProgress > 0.62 ? INK : 'rgba(255,255,255,0.72)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.18em',
                          pointerEvents: 'none',
                          paddingLeft: 74,
                          paddingRight: 24,
                          whiteSpace: 'nowrap',
                          opacity: swipeProgress > 0.9 ? 0 : 1,
                          transition: 'color 160ms ease, opacity 160ms ease',
                        }}
                      >
                        {swipeProgress > 0.62
                          ? (lang === 'ru' ? 'Отпустите' : 'Release')
                          : (lang === 'ru' ? 'Тяните вправо' : 'Slide right')}
                      </div>
                      {/* thumb */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 4,
                          top: 4,
                          width: thumbW,
                          height: 58,
                          borderRadius: '50%',
                          background: `linear-gradient(180deg, #7dff94, ${GREEN})`,
                          color: INK,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                          transform: `translateX(${swipeX}px)`,
                          transition: isSwiping ? 'none' : 'transform 240ms cubic-bezier(.2,.8,.2,1)',
                          boxShadow: '0 10px 26px rgba(57,255,99,0.36), inset 0 1px 0 rgba(255,255,255,0.6)',
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </div>
                    </div>

                    <button style={ghostBtn} onClick={() => setStep('address')}>
                      ← {lang === 'ru' ? 'Назад' : 'Back'}
                    </button>
                  </motion.div>
                )}

                {/* STEP: DONE */}
                {step === 'done' && (
                  <motion.div
                    key="done"
                    initial={false}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 18 }}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          background: GREEN,
                          color: INK,
                          margin: '0 auto 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 32,
                          fontWeight: 800,
                          boxShadow: '0 0 40px rgba(57,255,99,0.5)',
                        }}
                      >
                        ✓
                      </motion.div>
                      <div
                        style={{
                          fontFamily: DISPLAY,
                          fontWeight: 700,
                          fontStyle: 'italic',
                          fontSize: 24,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {lang === 'ru' ? 'Заявка создана' : 'Request created'}
                      </div>
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.4)',
                          marginTop: 8,
                          textTransform: 'uppercase',
                          letterSpacing: '0.2em',
                        }}
                      >
                        {lang === 'ru' ? 'Обычно до 24 часов' : 'Usually within 24h'}
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 4,
                        marginBottom: 22,
                      }}
                    >
                      {[
                        { label: lang === 'ru' ? 'ID заявки' : 'Request ID', value: createdId ?? '—', mono: true, copy: createdId ?? '' },
                        { label: lang === 'ru' ? 'Сумма' : 'Amount', value: `$${amountNum.toFixed(2)}`, accent: true },
                        { label: lang === 'ru' ? 'Сеть' : 'Network', value: netOpt?.name ?? '' },
                        {
                          label: lang === 'ru' ? 'Адрес' : 'Address',
                          value: address.length > 18 ? `${address.slice(0, 8)}…${address.slice(-8)}` : address,
                          mono: true,
                        },
                      ].map((row, i, arr) => (
                        <div
                          key={row.label}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 14,
                            padding: '14px 14px',
                            borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: MONO,
                              fontSize: 10,
                              color: 'rgba(255,255,255,0.45)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.12em',
                            }}
                          >
                            {row.label}
                          </span>
                          <span
                            style={{
                              fontFamily: row.mono ? MONO : DISPLAY,
                              fontSize: row.mono ? 11 : 14,
                              fontWeight: 700,
                              color: row.accent ? GREEN : '#fff',
                            }}
                          >
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button style={primaryBtn(false)} onClick={onClose}>
                      {lang === 'ru' ? 'Закрыть' : 'Close'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Detail overlay */}
            <AnimatePresence>
              {detailId && (() => {
                const w = refWithdrawals.find((x) => x.id === detailId)
                if (!w) return null
                const opt = CRYPTO_OPTIONS.find((o) => o.id === w.network)
                const fullDate = (iso: string) =>
                  new Date(iso).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                const copy = (val: string, key: string) => {
                  navigator.clipboard?.writeText(val)
                  setCopied(key)
                  haptic('light')
                  setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400)
                }
                const rows: Array<{ label: string; value: string; copyKey?: string; mono?: boolean; accent?: boolean }> = [
                  { label: lang === 'ru' ? 'ID заявки' : 'Request ID', value: w.id, copyKey: 'id', mono: true },
                  { label: lang === 'ru' ? 'Сумма' : 'Amount', value: `$${w.amount.toFixed(2)}`, accent: true },
                  { label: lang === 'ru' ? 'Сеть' : 'Network', value: opt?.name ?? w.network.toUpperCase() },
                  { label: lang === 'ru' ? 'Адрес' : 'Address', value: w.address, copyKey: 'addr', mono: true },
                  { label: lang === 'ru' ? 'Создана' : 'Created', value: fullDate(w.createdAt), mono: true },
                  ...(w.completedAt
                    ? [{
                        label:
                          w.status === 'rejected'
                            ? (lang === 'ru' ? 'Отклонена' : 'Rejected')
                            : (lang === 'ru' ? 'Выполнена' : 'Completed'),
                        value: fullDate(w.completedAt),
                        mono: true,
                      }]
                    : []),
                  ...(w.txid
                    ? [{ label: 'TX HASH', value: w.txid, copyKey: 'tx', mono: true, accent: true }]
                    : []),
                  ...(w.status === 'rejected' && w.rejectReason
                    ? [{ label: lang === 'ru' ? 'Причина отклонения' : 'Reject reason', value: w.rejectReason }]
                    : []),
                ]
                return (
                  <>
                    <motion.div
                      initial={false}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setDetailId(null)}
                      style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)', zIndex: 10,
                      }}
                    />
                    <motion.div
                      initial={false}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 20, opacity: 0 }}
                      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                      style={{
                        position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 11,
                        background: INK, border: '1px solid rgba(57,255,99,0.25)',
                        borderRadius: '16px 16px 16px 0', padding: '18px 18px 16px',
                        maxHeight: '85%', overflowY: 'auto',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: GREEN, fontWeight: 700 }}>/TX</span>
                          <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, fontStyle: 'italic' }}>
                            {lang === 'ru' ? 'Детали вывода' : 'Withdrawal details'}
                          </span>
                        </div>
                        <StatusLabel status={w.status} lang={lang} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {rows.map((r, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex', flexDirection: 'column', gap: 4,
                              padding: '12px 0',
                              borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                            }}
                          >
                            <div
                              style={{
                                fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.45)',
                                textTransform: 'uppercase', letterSpacing: '0.18em',
                              }}
                            >
                              {r.label}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                              <span
                                style={{
                                  fontFamily: r.mono ? MONO : DISPLAY,
                                  fontSize: r.mono ? 12 : 15,
                                  fontWeight: 700,
                                  color: r.accent ? GREEN : '#fff',
                                  wordBreak: 'break-all',
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                {r.value}
                              </span>
                              {r.copyKey && (
                                <button
                                  onClick={() => copy(r.value, r.copyKey!)}
                                  style={{
                                    flexShrink: 0,
                                    fontFamily: DISPLAY, fontSize: 9, fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.18em',
                                    color: copied === r.copyKey ? INK : GREEN,
                                    background: copied === r.copyKey ? GREEN : 'rgba(57,255,99,0.1)',
                                    border: '1px solid rgba(57,255,99,0.3)',
                                    padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
                                  }}
                                >
                                  {copied === r.copyKey
                                    ? (lang === 'ru' ? '✓' : '✓')
                                    : (lang === 'ru' ? 'Копир.' : 'Copy')}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button style={{ ...primaryBtn(false), marginTop: 18 }} onClick={() => setDetailId(null)}>
                        {lang === 'ru' ? 'Закрыть' : 'Close'}
                      </button>
                    </motion.div>
                  </>
                )
              })()}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
