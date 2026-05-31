import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import PageTransition from '../components/PageTransition'
import Confetti from '../components/Confetti'
import CryptoLogo from '../components/CryptoLogo'
import { useToast } from '../components/Toast'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { api } from '../store/api'
import { useTelegram } from '../hooks/useTelegram'
import { CONFIG } from '../config'
import { createOrder, formatOrderError, generateOrderId, generateUniqueAmount, paymentUri, fetchOrderStatus, fetchWalletAddresses } from '../utils/payment'
import { useCryptoRates, calcCryptoAmount, formatCryptoAmount } from '../hooks/useCryptoRates'
import { tgNotify } from '../utils/tgNotify'
import { adminDepositCancelled, formatUserRef } from '../../../shared/telegramTemplates'
import { track } from '../utils/analytics'
import { rateLimit, rateLimitUndo, isValidAmount, audit } from '../utils/security'
import { paymentSecondsRemaining } from '../utils/paymentTimer'
import type { CryptoNetwork, OrderStatus } from '../store/types'
import PendingInvoiceGate from '../components/PendingInvoiceGate'
import {
  isActiveCryptoInvoice,
  pickLatestActiveDeposit,
  pickLatestActiveCryptoPending,
} from '../utils/pendingOrder'

type Step = 'amount' | 'network' | 'pay' | 'success'
const QUICK_AMOUNTS = [10, 25, 50, 100]
const EASE = [0.22, 1, 0.36, 1] as const

interface CoinGroup {
  coin: string
  label: string
  symbol: string
  color: string
  networks: Array<{ id: CryptoNetwork; label: string; tag: string; tagEn: string }>
}

const COIN_GROUPS: CoinGroup[] = [
  {
    coin: 'usdt', label: 'Tether', symbol: 'USDT', color: '#26A17B',
    networks: [
      { id: 'trc20', label: 'TRC20', tag: 'TRON · быстро и дёшево', tagEn: 'TRON · fast & cheap' },
      { id: 'erc20', label: 'ERC20', tag: 'Ethereum · популярная',  tagEn: 'Ethereum · popular' },
      { id: 'bep20', label: 'BEP20', tag: 'BNB Chain · низкие комиссии', tagEn: 'BNB Chain · low fees' },
    ],
  },
  {
    coin: 'usdc', label: 'USD Coin', symbol: 'USDC', color: '#2775CA',
    networks: [
      { id: 'usdc_eth', label: 'ERC20', tag: 'Ethereum',  tagEn: 'Ethereum' },
      { id: 'usdc_sol', label: 'SPL',   tag: 'Solana · очень быстро', tagEn: 'Solana · very fast' },
    ],
  },
  { coin: 'eth', label: 'Ethereum', symbol: 'ETH', color: '#627EEA',
    networks: [{ id: 'eth', label: 'Ethereum', tag: 'ERC20', tagEn: 'ERC20' }] },
  { coin: 'ton', label: 'Toncoin', symbol: 'TON', color: '#0098EA',
    networks: [{ id: 'ton', label: 'TON', tag: 'The Open Network · быстро и дёшево', tagEn: 'The Open Network · fast & cheap' }] },
  { coin: 'sol', label: 'Solana', symbol: 'SOL', color: '#14F195',
    networks: [{ id: 'sol', label: 'Solana', tag: 'SPL · очень быстро', tagEn: 'SPL · very fast' }] },
  { coin: 'btc', label: 'Bitcoin', symbol: 'BTC', color: '#F7931A',
    networks: [{ id: 'btc', label: 'Bitcoin', tag: 'Нативная сеть', tagEn: 'Native network' }] },
]

export default function Deposit() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const toast = useToast()
  const lang = useStore((s) => s.lang)
  const user = useStore((s) => s.user)
  const orders = useStore((s) => s.orders)
  const addOrder = useStore((s) => s.addOrder)
  const addNotification = useStore((s) => s.addNotification)
  const creditDeposit = useStore((s) => s.creditDeposit)
  const cancelAllPendingCrypto = useStore((s) => s.cancelAllPendingCrypto)
  const reconcilePendingOrders = useStore((s) => s.reconcilePendingOrders)
  const setOrderStatus = useStore((s) => s.setOrderStatus)
  const [creating, setCreating] = useState(false)

  const activeDeposit = useMemo(() => pickLatestActiveDeposit(orders), [orders])
  const blockingBuy = useMemo(() => {
    const latest = pickLatestActiveCryptoPending(orders)
    return latest?.kind === 'buy' ? latest : null
  }, [orders])

  const [step, setStep] = useState<Step>('amount')
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState<CryptoNetwork | null>(null)
  const [pendingOrder, setPendingOrder] = useState<{
    id: string
    uniqueAmount: number
    createdAt: string
    expiresAt?: string
    address?: string
  } | null>(null)

  useEffect(() => {
    void reconcilePendingOrders()
  }, [reconcilePendingOrders])

  const resumedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (blockingBuy) return
    if (activeDeposit) {
      if (resumedIdRef.current !== activeDeposit.id) {
        resumedIdRef.current = activeDeposit.id
        setAmount(String(activeDeposit.amount))
        setNetwork((activeDeposit.provider as CryptoNetwork) ?? null)
        setPendingOrder({
          id: activeDeposit.id,
          uniqueAmount: activeDeposit.amount,
          createdAt: activeDeposit.created,
          expiresAt: activeDeposit.expires_at,
        })
        setStep('pay')
      }
      return
    }
    resumedIdRef.current = null
    if (pendingOrder) {
      const o = orders.find((x) => x.id === pendingOrder.id)
      if (!o || o.kind !== 'deposit' || !isActiveCryptoInvoice(o)) {
        setPendingOrder(null)
        if (step === 'pay') setStep('amount')
      }
    }
  }, [activeDeposit?.id, blockingBuy?.id, orders, pendingOrder?.id, step])

  const numAmount = parseFloat(amount) || 0
  const amountOk = numAmount >= 1
  const cryptoOption = CRYPTO_OPTIONS.find((c) => c.id === network)

  const removeNotification = useStore((s) => s.removeNotification)
  const refreshUser = useStore((s) => s.refreshUser)

  const cancelDeposit = async () => {
    if (!pendingOrder) return
    if (api.isEnabled()) await api.cancelOrder(pendingOrder.id)
    setOrderStatus(pendingOrder.id, 'expired')
    removeNotification(pendingOrder.id)
    setPendingOrder(null)
    void refreshUser()
    tgNotify(
      adminDepositCancelled({
        userLabel: formatUserRef({
          username: user?.username,
          full_name: user?.full_name,
          uid: user?.uid,
        }),
        amountUsd: pendingOrder.uniqueAmount,
        network: network ?? 'trc20',
        orderId: pendingOrder.id,
      }),
    )
  }

  const handleContinue = () => {
    if (!amountOk) return
    track('deposit_start', { amount: numAmount }); haptic('medium')
    setStep('network')
  }

  const handleSelectNetwork = async () => {
    if (!network || !user || creating) return
    if (!isValidAmount(numAmount, 1, 50_000)) {
      toast.show(lang === 'ru' ? 'Некорректная сумма' : 'Invalid amount', 'error')
      return
    }
    if (!rateLimit('deposit', 12, 60_000)) {
      toast.show(lang === 'ru' ? 'Подождите минуту перед новым счётом' : 'Wait a minute before creating another invoice', 'error')
      return
    }
    setCreating(true)
    haptic('medium')
    audit('deposit_start', user.uid, { amount: numAmount, network })
    await cancelAllPendingCrypto()
    await reconcilePendingOrders()
    const result = await createOrder({ uid: user.uid, kind: 'deposit', amount_usd: numAmount, network })
    if (api.isEnabled() && !result.ok) {
      rateLimitUndo('deposit')
      setCreating(false)
      toast.show(formatOrderError(result.code, result.message, lang), 'error')
      return
    }
    const remote = result.ok ? result : null
    const depositCount = orders.filter((o) => o.kind === 'deposit').length + 1
    const orderId = remote?.id ?? generateOrderId('deposit')
    const uniqueAmount = remote?.amount_usd ?? generateUniqueAmount(numAmount)
    addOrder({ id: orderId, orderNum: depositCount, kind: 'deposit', amount: uniqueAmount, status: 'pending', provider: network, created: new Date().toISOString() })
    setPendingOrder({
      id: orderId,
      uniqueAmount,
      createdAt: new Date().toISOString(),
      expiresAt: remote?.expires_at,
      address: remote?.address,
    })
    addNotification({ orderId, kind: 'deposit', amountUsd: numAmount, uniqueAmount, network })
    setCreating(false)
    setStep('pay')
  }

  const handleSuccess = () => {
    if (!pendingOrder) return
    if (!rateLimit('deposit_confirm', 3, 60_000)) return
    audit('deposit_confirm', user?.uid, { orderId: pendingOrder.id, amount: pendingOrder.uniqueAmount })
    creditDeposit(pendingOrder.id, pendingOrder.uniqueAmount)
    const creditedMsg = api.isEnabled()
      ? (lang === 'ru' ? 'Оплата подтверждена, баланс обновлён' : 'Payment confirmed, balance updated')
      : (lang === 'ru' ? `+$${pendingOrder.uniqueAmount.toFixed(2)} зачислено` : `+$${pendingOrder.uniqueAmount.toFixed(2)} credited`)
    toast.show(creditedMsg, 'success')
    setStep('success')
  }

  const goBack = () => {
    if (step === 'amount') navigate(-1)
    else if (step === 'pay') navigate('/profile') // keep order pending — only "Cancel" button or 30-min timer cancels it
    else if (step === 'success') navigate('/profile')
    else setStep('amount')
  }

  const stepIndex = step === 'amount' ? 0 : step === 'network' ? 1 : 2

  if (blockingBuy && step !== 'success') {
    return (
      <PageTransition>
        <main className="dpz">
          <header className="dpz-top">
            <button className="dpz-back" onClick={() => navigate(-1)} aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square"/></svg>
              <span>{lang === 'ru' ? 'НАЗАД' : 'BACK'}</span>
            </button>
          </header>
          <div style={{ marginTop: 12 }}>
            <PendingInvoiceGate
              lang={lang}
              invoice={blockingBuy}
              context="deposit"
              onContinue={() => {
                if (blockingBuy.product_id) navigate(`/product/${blockingBuy.product_id}`)
                else navigate('/orders')
              }}
              onCancelAndNew={() => {
                void (async () => {
                  await cancelAllPendingCrypto()
                  await reconcilePendingOrders()
                  setStep('amount')
                })()
              }}
              onDismiss={() => navigate(-1)}
            />
          </div>
        </main>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <main className="dpz">
        <div className="dpb-grid" aria-hidden />
        <div className="dpb-grain" aria-hidden />

        <header className="dpz-top">
          <button className="dpz-back" onClick={goBack} aria-label="Back">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter"/></svg>
            <span>{lang === 'ru' ? 'НАЗАД' : 'BACK'}</span>
          </button>
          <div className="dpz-top-meta">
            <span className="dpz-top-eye">
              {step === 'pay'
                ? (lang === 'ru' ? 'Счёт активен' : 'Live invoice')
                : `${lang === 'ru' ? 'Шаг' : 'Step'} ${stepIndex + 1}/3`}
            </span>
            <strong className="dpz-top-title">
              {step === 'amount' && (lang === 'ru' ? 'Пополнение' : 'Top up')}
              {step === 'network' && (lang === 'ru' ? 'Сеть' : 'Network')}
              {step === 'pay'    && (lang === 'ru' ? 'Оплата' : 'Payment')}
              {step === 'success'&& (lang === 'ru' ? 'Готово' : 'Done')}
            </strong>
          </div>
          <div className="dpz-prog" aria-hidden>
            {step === 'pay'
              ? [0,1,2].map((i) => <span key={i} className="dpz-prog-i is-on is-live" />)
              : [0,1,2].map((i) => (
                <span key={i} className={`dpz-prog-i${i <= stepIndex ? ' is-on' : ''}${i === stepIndex ? ' is-now' : ''}`} />
              ))}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === 'amount' && (
            <motion.section
              key="amount" className="dpz-card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              <div className="dpz-balrow">
                <div className="dpz-balrow-i">
                  <span className="dpz-balrow-eye">{lang === 'ru' ? 'Сейчас' : 'Current'}</span>
                  <strong className="dpz-balrow-num">${(user?.balance ?? 0).toFixed(2)}</strong>
                </div>
                <svg className="dpz-balrow-arr" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="dpz-balrow-i dpz-balrow-i--next">
                  <span className="dpz-balrow-eye">{lang === 'ru' ? 'Станет' : 'After'}</span>
                  <strong className="dpz-balrow-num">${((user?.balance ?? 0) + numAmount).toFixed(2)}</strong>
                </div>
              </div>

              <h1 className="dpz-h2">{lang === 'ru' ? 'Сумма пополнения' : 'Top-up amount'}</h1>

              <div className={`dpz-money${amountOk ? ' is-valid' : ''}${numAmount > 0 && !amountOk ? ' is-warn' : ''}`}>
                <span className="dpz-money-cur">$</span>
                <input
                  className="dpz-money-input"
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                />
                <span className="dpz-money-eq">USD</span>
              </div>

              <AnimatePresence>
                {numAmount > 0 && numAmount < 1 && (
                  <motion.p
                    className="dpz-warn"
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                  >
                    {lang === 'ru' ? 'Минимум — $1' : 'Minimum is $1'}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="dpz-quick">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    className={`dpz-quick-i${amount === String(a) ? ' is-active' : ''}`}
                    onClick={() => { setAmount(String(a)); haptic('light') }}
                  >
                    +${a}
                  </button>
                ))}
              </div>

              <button
                className="dpz-cta"
                disabled={!amountOk}
                onClick={handleContinue}
              >
                <span className="dpz-cta-t">{lang === 'ru' ? 'Далее' : 'Continue'}</span>
                <svg className="dpz-cta-ic" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </motion.section>
          )}

          {step === 'network' && (
            <motion.section
              key="network" className="dpz-card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              <div className="dpz-amt-pill">
                <span className="dpz-amt-pill-eye">{lang === 'ru' ? 'К зачислению' : 'To credit'}</span>
                <strong>${numAmount.toFixed(2)}</strong>
              </div>

              <h1 className="dpz-h2">{lang === 'ru' ? 'Способ оплаты' : 'Payment method'}</h1>

              <NetworkPicker selected={network} onSelect={(n) => { setNetwork(n); haptic('light') }} lang={lang} />

              <button
                className="dpz-cta"
                disabled={!network}
                onClick={handleSelectNetwork}
              >
                <span className="dpz-cta-t">{lang === 'ru' ? 'Создать счёт' : 'Create invoice'}</span>
                <svg className="dpz-cta-ic" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </motion.section>
          )}


          {step === 'pay' && cryptoOption && pendingOrder && (
            <motion.section
              key="pay" className="dpz-card dpz-card--pay"
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <PayPanel
                orderId={pendingOrder.id}
                amountUsd={numAmount}
                uniqueAmount={pendingOrder.uniqueAmount}
                createdAt={pendingOrder.createdAt}
                expiresAt={pendingOrder.expiresAt}
                network={cryptoOption.id}
                cryptoName={cryptoOption.name}
                cryptoSymbol={cryptoOption.symbol}
                cryptoColor={cryptoOption.color}
                cryptoAddressFallback={pendingOrder.address || cryptoOption.address}
                lang={lang}
                onCancel={() => { cancelDeposit(); navigate('/profile') }}
                onSuccess={handleSuccess}
              />
            </motion.section>
          )}

          {step === 'success' && pendingOrder && (
            <motion.section
              key="success" className="dpz-card dpz-success"
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <Confetti trigger={true} />
              <motion.div
                className="dpz-success-mark"
                initial={{ scale: 0, rotate: -120 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              >
                <svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </motion.div>
              <span className="dpz-kicker">{lang === 'ru' ? 'Зачислено' : 'Credited'}</span>
              <h2 className="dpz-success-num">+${pendingOrder.uniqueAmount.toFixed(2)}</h2>
              <p className="dpz-success-p">{lang === 'ru' ? 'Можно возвращаться к покупке.' : 'You can return to checkout.'}</p>
              <motion.button className="dpz-cta" onClick={() => navigate('/')} whileTap={{ scale: 0.98 }}>
                <span className="dpz-cta-bg" aria-hidden />
                <span className="dpz-cta-t">{lang === 'ru' ? 'В маркет' : 'Back to market'}</span>
                <svg className="dpz-cta-ic" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </motion.button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </PageTransition>
  )
}

/* ────────────────── NETWORK PICKER ────────────────── */
export function NetworkPicker({
  selected, onSelect, lang,
}: { selected: CryptoNetwork | null; onSelect: (n: CryptoNetwork) => void; lang: 'ru' | 'en' }) {
  const [expanded, setExpanded] = useState<string | null>(() => {
    if (!selected) return null
    return COIN_GROUPS.find((g) => g.networks.some((n) => n.id === selected))?.coin ?? null
  })

  const tap = (g: CoinGroup) => {
    if (g.networks.length === 1) { onSelect(g.networks[0].id); setExpanded(g.coin); return }
    setExpanded((p) => p === g.coin ? null : g.coin)
  }

  return (
    <div className="dpz-coins">
      {COIN_GROUPS.map((g, i) => {
        const open = expanded === g.coin
        const groupSel = g.networks.some((n) => n.id === selected)
        const single = g.networks.length === 1
        const selectedNet = g.networks.find((n) => n.id === selected)
        return (
          <motion.div
            key={g.coin}
            className={`dpz-coin-wrap${open ? ' is-open' : ''}${groupSel ? ' is-sel' : ''}`}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: EASE }}
          >
            <motion.button
              className="dpz-coin"
              onClick={() => tap(g)}
              whileTap={{ scale: 0.985 }}
              style={groupSel ? { ['--accent' as never]: g.color } : undefined}
            >
              <CryptoLogo network={g.networks[0].id} size={38} showBadge={single} />
              <div className="dpz-coin-meta">
                <strong>{g.label}</strong>
                <span>{g.symbol}{!single && (
                  <i className="dpz-coin-count"> · {g.networks.length} {lang === 'ru' ? 'сети' : 'networks'}</i>
                )}</span>
              </div>
              {groupSel && selectedNet && (
                <span className="dpz-coin-tag" style={{ background: `${g.color}22`, color: g.color, borderColor: `${g.color}55` }}>
                  {selectedNet.label}
                </span>
              )}
              {!single && (
                <motion.span
                  className="dpz-coin-arrow"
                  animate={{ rotate: open ? 90 : 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </motion.span>
              )}
              {single && groupSel && (
                <span className="dpz-coin-check" style={{ background: g.color }}>
                  <svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              )}
            </motion.button>

            <AnimatePresence initial={false}>
              {open && !single && (
                <motion.div
                  className="dpz-nets"
                  initial={false}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                >
                  <div className="dpz-nets-inner">
                    {g.networks.map((n, ni) => {
                      const isSel = selected === n.id
                      return (
                        <motion.button
                          key={n.id}
                          className={`dpz-net${isSel ? ' is-sel' : ''}`}
                          onClick={() => onSelect(n.id)}
                          initial={false}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: ni * 0.04, duration: 0.22, ease: EASE }}
                          whileTap={{ scale: 0.98 }}
                          style={isSel ? { ['--accent' as never]: g.color } : undefined}
                        >
                          <CryptoLogo network={n.id} size={28} />
                          <div className="dpz-net-meta">
                            <strong>{n.label}</strong>
                            <span>{lang === 'ru' ? n.tag : n.tagEn}</span>
                          </div>
                          <span className={`dpz-net-radio${isSel ? ' is-on' : ''}`} aria-hidden>
                            {isSel && <svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ────────────────── PAY PANEL ────────────────── */
const TOTAL_SECONDS = CONFIG.paymentTimeoutMinutes * 60

export function PayPanel({
  orderId, amountUsd, uniqueAmount, createdAt, expiresAt, network,
  cryptoName, cryptoSymbol, cryptoColor, cryptoAddressFallback,
  lang, onCancel, onSuccess,
}: {
  orderId: string
  amountUsd: number
  uniqueAmount: number
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
}) {
  const { haptic } = useTelegram()
  const toast = useToast()
  const [timer, setTimer] = useState(() =>
    paymentSecondsRemaining(TOTAL_SECONDS, { expiresAt, createdAt }),
  )
  const [paused, setPaused] = useState(false)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<OrderStatus>('pending')
  const [stepN, setStepN] = useState(0)

  const cryptoAddresses = useStore((s) => s.cryptoAddresses)
  const qrOverrides = useStore((s) => s.qrOverrides)
  const [runtimeAddress, setRuntimeAddress] = useState('')
  const liveAddress = cryptoAddressFallback || runtimeAddress || cryptoAddresses[network] || CONFIG.addresses[network] || ''
  const qrOverride = qrOverrides[network]

  const rates = useCryptoRates()
  const cryptoAmount = calcCryptoAmount(uniqueAmount, network, rates)
  const qrData = paymentUri(network, liveAddress, cryptoAmount)

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
        return
      }
      if (api.isEnabled()) {
        try {
          await api.cancelOrder(orderId)
        } catch {
          /* idempotent */
        }
      }
      setStatus('expired')
      useStore.getState().setOrderStatus(orderId, 'expired')
      haptic('error')
    })()
  }, [timer, orderId, haptic])

  // step reflects real status: 0 = waiting, 1 = detected/confirming, 2 = credited

  const onSuccessRef = useRef(onSuccess)
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])
  const hapticRef = useRef(haptic)
  useEffect(() => { hapticRef.current = haptic }, [haptic])

  useEffect(() => {
    const tick = async () => {
      const s = await fetchOrderStatus(orderId)
      if (!s) return
      setStatus(s)
      if (s === 'paid') {
        setStepN(1); hapticRef.current('light')
      } else if (s === 'completed') {
        setStepN(2); hapticRef.current('success')
        setTimeout(() => onSuccessRef.current(), 1200)
      } else if (s === 'expired' || s === 'failed') {
        hapticRef.current('error')
      }
    }
    tick() // immediate check
    const iv = window.setInterval(tick, CONFIG.pollIntervalMs)
    return () => clearInterval(iv)
  }, [orderId])

  const onCopy = async () => {
    if (!liveAddress) {
      toast.show(lang === 'ru' ? 'Адрес не настроен' : 'Address not configured', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(liveAddress)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = liveAddress; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    haptic('success'); setCopied(true)
    toast.show(lang === 'ru' ? 'Адрес скопирован' : 'Address copied', 'success')
    setTimeout(() => setCopied(false), 1800)
  }

  const onCopyAmount = async () => {
    const value = formatCryptoAmount(cryptoAmount, network)
    try { await navigator.clipboard.writeText(value) } catch { /* ignore */ }
    haptic('success')
    toast.show(lang === 'ru' ? `Сумма ${value} ${cryptoSymbol} скопирована` : `Amount ${value} ${cryptoSymbol} copied`, 'success')
  }

  const fmtTimer = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const pct = useMemo(() => (timer / TOTAL_SECONDS), [timer])
  const lowTime = timer < 60
  const isPaid = status === 'paid' || status === 'completed'
  const visibleAddress = liveAddress || (lang === 'ru' ? 'Адрес не настроен' : 'Address not configured')

  return (
    <div className="dpz-pay" style={{ ['--accent' as never]: cryptoColor }}>
      <div className={`dpz-pay-pulse${lowTime ? ' is-low' : ''}`} aria-hidden>
        <motion.div
          className="dpz-pay-pulse-bar"
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.8, ease: 'linear' }}
        />
      </div>

      <div className="dpz-pay-hd">
        <div className="dpz-pay-hd-l">
          <CryptoLogo network={network} size={36} />
          <div className="dpz-pay-hd-meta">
            <strong>{cryptoName}</strong>
          </div>
        </div>
        <div className="dpz-pay-hd-r">
          <span className={`dpz-pay-status${isPaid ? ' is-paid' : ''}`}>
            <i />
            {isPaid
              ? (lang === 'ru' ? 'Оплачено' : 'Paid')
              : (lang === 'ru' ? 'Активно' : 'Active')}
          </span>
          <span className={`dpz-pay-clock${lowTime ? ' is-low' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M12 9v4l2.5 2.5M9 3h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            {fmtTimer(timer)}
          </span>
        </div>
      </div>

      <section className="dpz-pay-stage">
        <span className="dpz-pay-stage-glow" aria-hidden />
        <div className="dpz-pay-hero">
          <motion.button
            type="button"
            className="dpz-pay-hero-num dpz-pay-hero-num--btn"
            onClick={onCopyAmount}
            key={String(cryptoAmount)}
            initial={false}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.36, ease: EASE }}
            whileTap={{ scale: 0.97 }}
            aria-label={lang === 'ru' ? 'Скопировать сумму' : 'Copy amount'}
          >
            <span className="dpz-pay-hero-val">{formatCryptoAmount(cryptoAmount, network)}</span>
            <em>{cryptoSymbol}</em>
          </motion.button>
          <span className="dpz-pay-hero-eye">
            ≈ ${uniqueAmount.toFixed(2)}
          </span>
        </div>

        <motion.div
          className="dpz-pay-qr"
          initial={false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
        >
          {qrOverride
            ? <img src={qrOverride} alt="QR" className="dpz-pay-qr-img" />
            : <QRCodeSVG value={qrData || liveAddress} size={164} bgColor="#ffffff" fgColor="#0a0a0c" level="M" />
          }
          <span className="dpz-pay-qr-corner dpz-pay-qr-corner--tl" aria-hidden />
          <span className="dpz-pay-qr-corner dpz-pay-qr-corner--tr" aria-hidden />
          <span className="dpz-pay-qr-corner dpz-pay-qr-corner--bl" aria-hidden />
          <span className="dpz-pay-qr-corner dpz-pay-qr-corner--br" aria-hidden />
          <motion.span
            className="dpz-pay-scanline"
            aria-hidden
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </section>

      <button className={`dpz-pay-addr${copied ? ' is-copied' : ''}`} onClick={onCopy}>
        <div className="dpz-pay-addr-row">
          <span className="dpz-pay-addr-eye">
            {lang === 'ru' ? 'адрес для пополнения' : 'deposit address'}
          </span>
          <span className="dpz-pay-addr-action">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? 'ok' : 'cp'}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {copied
                  ? <><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>{lang === 'ru' ? 'Скопировано' : 'Copied'}</>
                  : <><svg viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8"/></svg>{lang === 'ru' ? 'Копировать' : 'Copy'}</>}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
        <span className="dpz-pay-addr-text">{visibleAddress}</span>
        <span className="dpz-pay-addr-full">{visibleAddress}</span>
      </button>

      <div className={`dpz-pay-flow${isPaid ? ' is-done' : ''}`} data-step={isPaid ? 2 : stepN}>
        {[
          lang === 'ru' ? 'Ожидание оплаты' : 'Waiting for payment',
          lang === 'ru' ? 'Подтверждение в сети' : 'Network confirmation',
          lang === 'ru' ? 'Зачислено' : 'Credited',
        ].map((label, i) => {
          const current = isPaid ? 2 : stepN
          const state = i < current ? 'done' : i === current ? 'active' : 'idle'
          return (
            <div key={i} className={`dpz-pay-flow-step is-${state}`}>
              <span className="dpz-pay-flow-dot" aria-hidden>
                {state === 'done' ? (
                  <svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : state === 'active' ? (
                  <span className="dpz-pay-flow-pulse" />
                ) : (
                  <i>{i + 1}</i>
                )}
              </span>
              <span className="dpz-pay-flow-label">{label}</span>
              {i < 2 && <span className="dpz-pay-flow-line" aria-hidden />}
            </div>
          )
        })}
      </div>

      <div className="dpz-pay-note">
        <span className="dpz-pay-note-ico" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5m0 3.5v.01M4.5 19h15a1.5 1.5 0 0 0 1.32-2.22l-7.5-13.5a1.5 1.5 0 0 0-2.64 0l-7.5 13.5A1.5 1.5 0 0 0 4.5 19Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
        <span>
          {lang === 'ru'
            ? <>Переведите <button type="button" className="dpz-pay-note-amount" onClick={onCopyAmount}>ровно {formatCryptoAmount(cryptoAmount, network)} {cryptoSymbol}</button> на адрес выше — сумма уникальна и привязана к вашему счёту. Баланс пополнится автоматически после первого подтверждения сети.</>
            : <>Send <button type="button" className="dpz-pay-note-amount" onClick={onCopyAmount}>exactly {formatCryptoAmount(cryptoAmount, network)} {cryptoSymbol}</button> to the address above — the amount is unique to your invoice. Your balance updates automatically after the first network confirmation.</>}
        </span>
      </div>

      <button
        className="dpz-cancel"
        onClick={onCancel}
        disabled={status === 'completed' || status === 'paid'}
      >
        {lang === 'ru' ? 'Отменить платёж' : 'Cancel payment'}
      </button>
    </div>
  )
}
