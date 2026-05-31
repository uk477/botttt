import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import CryptoLogo from './CryptoLogo'
import { useToast } from './Toast'
import { useStore } from '../store'
import { CONFIG } from '../config'
import { useTelegram } from '../hooks/useTelegram'
import {
  paymentUri,
  fetchOrderStatus,
  fetchWalletAddresses,
} from '../utils/payment'
import { useCryptoRates, calcCryptoAmount, formatCryptoAmount, getLatestRates } from '../hooks/useCryptoRates'
import { paymentSecondsRemaining } from '../utils/paymentTimer'
import type { CryptoNetwork, OrderStatus } from '../store/types'

const TOTAL_SECONDS = CONFIG.paymentTimeoutMinutes * 60

export type CryptoInvoicePanelProps = {
  orderId: string
  uniqueAmount: number
  amountCrypto?: number
  createdAt?: string
  expiresAt?: string
  network: CryptoNetwork
  cryptoName: string
  cryptoSymbol: string
  cryptoColor: string
  cryptoAddressFallback: string
  lang: 'ru' | 'en'
  onCancel: () => void
  onSuccess: () => void
}

export default function CryptoInvoicePanel({
  orderId,
  uniqueAmount,
  amountCrypto,
  createdAt,
  expiresAt,
  network,
  cryptoName,
  cryptoSymbol,
  cryptoColor,
  cryptoAddressFallback,
  lang,
  onCancel,
  onSuccess,
}: CryptoInvoicePanelProps) {
  const { haptic } = useTelegram()
  const toast = useToast()
  const [timer, setTimer] = useState(() =>
    paymentSecondsRemaining(TOTAL_SECONDS, { expiresAt, createdAt }),
  )
  const [paused, setPaused] = useState(false)
  const [copiedAddr, setCopiedAddr] = useState(false)
  const [copiedAmt, setCopiedAmt] = useState(false)
  const [status, setStatus] = useState<OrderStatus>('pending')

  const cryptoAddresses = useStore((s) => s.cryptoAddresses)
  const qrOverrides = useStore((s) => s.qrOverrides)
  const [runtimeAddress, setRuntimeAddress] = useState('')
  const liveAddress =
    cryptoAddressFallback ||
    runtimeAddress ||
    cryptoAddresses[network] ||
    CONFIG.addresses[network] ||
    ''
  const qrOverride = qrOverrides[network]

  const rates = useCryptoRates()
  const lockedCrypto = amountCrypto != null && amountCrypto > 0 ? amountCrypto : null
  const [amountReady, setAmountReady] = useState(lockedCrypto != null)

  useEffect(() => {
    if (lockedCrypto != null) {
      setAmountReady(true)
      return
    }
    let cancelled = false
    getLatestRates().then(() => {
      if (!cancelled) setAmountReady(true)
    })
    return () => { cancelled = true }
  }, [lockedCrypto, network, uniqueAmount])

  const frozenCryptoRef = useRef<number | null>(null)
  useEffect(() => {
    frozenCryptoRef.current = null
  }, [orderId])

  const liveCalc = lockedCrypto ?? calcCryptoAmount(uniqueAmount, network, rates)

  useEffect(() => {
    if (amountReady && frozenCryptoRef.current == null) {
      frozenCryptoRef.current = liveCalc
    }
  }, [amountReady, liveCalc])

  const cryptoAmount = frozenCryptoRef.current ?? liveCalc
  const qrData =
    amountReady && frozenCryptoRef.current != null
      ? paymentUri(network, liveAddress, cryptoAmount)
      : ''

  useEffect(() => {
    if (cryptoAddressFallback) return
    let cancelled = false
    fetchWalletAddresses().then((addresses) => {
      if (!cancelled) setRuntimeAddress(addresses[network] || '')
    })
    return () => { cancelled = true }
  }, [network, cryptoAddressFallback])

  useEffect(() => {
    const onVis = () => setPaused(document.visibilityState !== 'visible')
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (paused) return
    const iv = window.setInterval(() => {
      setTimer(paymentSecondsRemaining(TOTAL_SECONDS, { expiresAt, createdAt }))
    }, 1000)
    return () => clearInterval(iv)
  }, [paused, expiresAt, createdAt])

  const expiredRef = useRef(false)
  useEffect(() => {
    if (timer > 0 || expiredRef.current) return
    expiredRef.current = true
    void (async () => {
      const s = await fetchOrderStatus(orderId)
      if (s === 'paid' || s === 'completed') {
        setStatus(s)
        return
      }
      if (s === 'expired' || s === 'failed') {
        setStatus(s)
        useStore.getState().setOrderStatus(orderId, s)
        haptic('error')
      }
    })()
  }, [timer, orderId, haptic])

  const onSuccessRef = useRef(onSuccess)
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])
  const hapticRef = useRef(haptic)
  useEffect(() => { hapticRef.current = haptic }, [haptic])

  useEffect(() => {
    const tick = async () => {
      const s = await fetchOrderStatus(orderId)
      if (!s) return
      setStatus(s)
      if (s === 'paid') hapticRef.current('light')
      else if (s === 'completed') {
        hapticRef.current('success')
        setTimeout(() => onSuccessRef.current(), 800)
      } else if (s === 'expired' || s === 'failed') {
        hapticRef.current('error')
      }
    }
    tick()
    const iv = window.setInterval(tick, CONFIG.pollIntervalMs)
    return () => clearInterval(iv)
  }, [orderId])

  const copyText = async (text: string, kind: 'addr' | 'amt') => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    haptic('success')
    if (kind === 'addr') {
      setCopiedAddr(true)
      toast.show(lang === 'ru' ? 'Адрес скопирован' : 'Address copied', 'success')
      setTimeout(() => setCopiedAddr(false), 2000)
    } else {
      setCopiedAmt(true)
      toast.show(lang === 'ru' ? 'Сумма скопирована' : 'Amount copied', 'success')
      setTimeout(() => setCopiedAmt(false), 2000)
    }
  }

  const fmtTimer = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const isPaid = status === 'paid' || status === 'completed'
  const lowTime = timer < 60
  const amountStr = amountReady
    ? formatCryptoAmount(cryptoAmount, network)
    : '…'
  const statusLabel = isPaid
    ? (lang === 'ru' ? 'Оплата получена' : 'Payment received')
    : status === 'expired' || status === 'failed'
      ? (lang === 'ru' ? 'Счёт истёк' : 'Invoice expired')
      : (lang === 'ru' ? 'Ожидаем перевод' : 'Awaiting payment')

  return (
    <div className="cinv" style={{ ['--cinv-accent' as string]: cryptoColor }}>
      <header className="cinv__head">
        <div className="cinv__head-left">
          <CryptoLogo network={network} size={32} />
          <div>
            <div className="cinv__net">{cryptoName}</div>
            <div className="cinv__status">{statusLabel}</div>
          </div>
        </div>
        <div className={`cinv__timer${lowTime ? ' is-urgent' : ''}`}>{fmtTimer(timer)}</div>
      </header>

      <div className="cinv__scroll">
        <div className="cinv__amount-card">
          <span className="cinv__label">
            {lang === 'ru' ? 'Переведите точно' : 'Send exactly'}
          </span>
          <button
            type="button"
            className="cinv__amount-btn"
            disabled={!amountReady}
            onClick={() => copyText(amountStr, 'amt')}
          >
            <span className="cinv__amount-val">{amountStr}</span>
            <span className="cinv__amount-sym">{cryptoSymbol}</span>
          </button>
          <span className="cinv__usd">≈ ${uniqueAmount.toFixed(2)}</span>
          {copiedAmt && (
            <span className="cinv__copied">{lang === 'ru' ? 'Скопировано' : 'Copied'}</span>
          )}
        </div>

        <div className="cinv__qr-wrap">
          {amountReady && (qrOverride || qrData || liveAddress) ? (
            qrOverride ? (
              <img src={qrOverride} alt="" className="cinv__qr-img" />
            ) : (
              <QRCodeSVG
                value={qrData || liveAddress}
                size={200}
                bgColor="#ffffff"
                fgColor="#0a0a0c"
                level="M"
              />
            )
          ) : (
            <div className="cinv__qr-placeholder" aria-busy="true" />
          )}
        </div>

        <div className="cinv__field">
          <span className="cinv__label">{lang === 'ru' ? 'Адрес' : 'Address'}</span>
          <div className="cinv__addr-box">{liveAddress || '—'}</div>
          <button
            type="button"
            className="btn btn-secondary cinv__copy-btn"
            onClick={() => copyText(liveAddress, 'addr')}
            disabled={!liveAddress}
          >
            {copiedAddr
              ? (lang === 'ru' ? 'Скопировано' : 'Copied')
              : (lang === 'ru' ? 'Скопировать адрес' : 'Copy address')}
          </button>
        </div>

        <p className="cinv__hint t-sm t-muted">
          {lang === 'ru'
            ? 'Сумма уникальна для вашего счёта. Баланс обновится после подтверждения в сети.'
            : 'Amount is unique to your invoice. Balance updates after network confirmation.'}
        </p>
      </div>

    </div>
  )
}
