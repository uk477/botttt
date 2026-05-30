import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useT } from '../i18n'
import { useStore } from '../store'
import { useTelegram } from '../hooks/useTelegram'
import { CONFIG } from '../config'
import { QRCodeSVG } from 'qrcode.react'
import {
  paymentUri, fetchOrderStatus,
} from '../utils/payment'
import { useCryptoRates, calcCryptoAmount, formatCryptoAmount } from '../hooks/useCryptoRates'
import CryptoLogo from './CryptoLogo'
import type { CryptoOption, OrderStatus, OrderKind } from '../store/types'

interface Props {
  orderId: string
  amountUsd: number
  uniqueAmount: number
  createdAt?: string
  crypto: CryptoOption
  kind: OrderKind
  onCancel: () => void
  onSuccess: () => void
}

const TOTAL_SECONDS = CONFIG.paymentTimeoutMinutes * 60

export default function PaymentWaiting({
  orderId, amountUsd, uniqueAmount, createdAt, crypto, kind, onCancel, onSuccess,
}: Props) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { haptic } = useTelegram()
  const [timer, setTimer] = useState(() => {
    if (!createdAt) return TOTAL_SECONDS
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
    return Math.max(0, TOTAL_SECONDS - elapsed)
  })
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<OrderStatus>('pending')
  const [step, setStep] = useState(0)  // 0=connecting, 1=watching, 2=confirmed
  const intervalRef = useRef<number | null>(null)
  const pollRef = useRef<number | null>(null)
  const stepRef = useRef<number | null>(null)

  const cryptoAddresses = useStore((s) => s.cryptoAddresses)
  const qrOverrides = useStore((s) => s.qrOverrides)
  const liveAddress = cryptoAddresses[crypto.id] || crypto.address
  const qrOverride = qrOverrides[crypto.id]

  const rates = useCryptoRates()
  const cryptoAmount = calcCryptoAmount(uniqueAmount, crypto.id, rates)
  const qrData = paymentUri(crypto.id, liveAddress, cryptoAmount)

  // Countdown timer
  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setTimer((p) => {
        if (p <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          onCancel()
          return 0
        }
        return p - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Step animation: 0 → 1 after 1.5s, demo only
  useEffect(() => {
    stepRef.current = window.setTimeout(() => setStep(1), 1500)
    return () => { if (stepRef.current) clearTimeout(stepRef.current) }
  }, [])

  // Poll backend for order status
  useEffect(() => {
    const tick = async () => {
      const s = await fetchOrderStatus(orderId)
      setStatus(s)
      if (s === 'paid' || s === 'completed') {
        setStep(2)
        haptic('success')
        setTimeout(onSuccess, 1200)
      } else if (s === 'expired' || s === 'failed') {
        onCancel()
      }
    }
    pollRef.current = window.setInterval(tick, CONFIG.pollIntervalMs)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [orderId, onSuccess, haptic])

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(liveAddress) } catch { /* ignore */ }
    haptic('success')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progressPct = (timer / TOTAL_SECONDS) * 100

  const STEPS = lang === 'ru'
    ? ['Подключение к сети', 'Ожидание перевода', 'Подтверждение']
    : ['Connecting to network', 'Watching for payment', 'Confirmed']

  return (
    <div>
      {/* Header */}
      <div className="row-between mb-5">
        <div className="row gap-3 items-center">
          <CryptoLogo network={crypto.id} size={36} />
          <div>
            <div className="t-md fw-black">
              {kind === 'deposit' ? t('deposit_title') : t('payment_waiting')}
            </div>
            <div className="row gap-2 items-center">
              <span className="pulse-dot" style={{ width: 6, height: 6 }} />
              <div className="t-xs t-muted">{crypto.name}</div>
            </div>
          </div>
        </div>
        <motion.div
          key={Math.floor(timer / 10)}
          initial={false}
          animate={{ scale: 1, opacity: 1 }}
          className="badge"
          style={{
            background: timer < 60 ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)',
            color: timer < 60 ? 'var(--red)' : 'var(--orange)',
            fontFamily: 'monospace', fontSize: 14, padding: '6px 12px',
          }}
        >
          {formatTimer(timer)}
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="progress-track mb-5">
        <motion.div
          className="progress-fill"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: 'linear' }}
        />
      </div>

      {/* QR — client-side generated, always visible */}
      <motion.div
        className="qr-frame mb-4"
        initial={false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 22 }}
      >
        <div className="qr-inner">
          {qrOverride
            ? <img className="qr-img" src={qrOverride} alt="QR" />
            : <QRCodeSVG
                value={qrData || liveAddress}
                size={196}
                bgColor="#ffffff"
                fgColor="#111111"
                level="M"
                style={{ display: 'block', borderRadius: 6 }}
              />
          }
          <div className="qr-scan" />
        </div>
        <div className="qr-corner qr-tl" />
        <div className="qr-corner qr-tr" />
        <div className="qr-corner qr-bl" />
        <div className="qr-corner qr-br" />
      </motion.div>

      {/* Amount card — prominent */}
      <div className="card mb-3" style={{ padding: '20px', textAlign: 'center', background: 'var(--surface)' }}>
        <div className="t-xs t-muted mb-2" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {lang === 'ru' ? 'Отправить точно' : 'Send exactly'}
        </div>
        <motion.div
          key={cryptoAmount}
          initial={false}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em',
            color: crypto.color, fontFamily: 'monospace',
            lineHeight: 1.1, marginBottom: 6,
          }}
        >
          {formatCryptoAmount(cryptoAmount, crypto.id)}
          <span style={{ fontSize: 20, marginLeft: 6, opacity: 0.85 }}>{crypto.symbol}</span>
        </motion.div>
        <div className="t-xs t-muted">
          ≈ ${amountUsd.toFixed(2)} USD
          {rates && <span style={{ marginLeft: 8, color: 'var(--brand)', fontSize: 10 }}>● LIVE</span>}
        </div>
      </div>

      {/* Address */}
      <div className="address-box mb-5">
        <div className="address-text">{liveAddress}</div>
        <motion.button
          className={`copy-btn${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          whileTap={{ scale: 0.92 }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={copied ? 'ok' : 'cp'}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {copied
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Status steps */}
      <div className="status-steps mb-5">
        {STEPS.map((label, i) => {
          const reached = i <= step
          const active = i === step
          const completed = i < step
          return (
            <motion.div
              key={i}
              className="status-step"
              initial={false}
              animate={{ opacity: reached ? 1 : 0.35, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                className={`status-dot${completed ? ' done' : active ? ' active' : ''}`}
              >
                {completed ? '✓' : active ? <span className="status-spinner" /> : i + 1}
              </div>
              <span className="t-sm" style={{ color: reached ? 'var(--t-primary)' : 'var(--t-muted)' }}>
                {label}
              </span>
            </motion.div>
          )
        })}
      </div>

      {/* Hint */}
      <div className="t-xs t-muted text-center mb-4" style={{ lineHeight: 1.5 }}>
        {lang === 'ru'
          ? `Отправьте ровно эту сумму. Зачисление произойдёт автоматически.`
          : `Send exactly this amount. Funds will be credited automatically.`}
      </div>

      {/* Cancel */}
      <motion.button
        className="btn btn-secondary"
        onClick={onCancel}
        whileTap={{ scale: 0.97 }}
        disabled={status === 'completed' || status === 'paid'}
      >
        {t('payment_cancel')}
      </motion.button>
    </div>
  )
}
