import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import CryptoInvoiceOverlay from '../components/CryptoInvoiceOverlay'
import Confetti from '../components/Confetti'
import CryptoLogo from '../components/CryptoLogo'
import { useToast } from '../components/Toast'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { api } from '../store/api'
import { useTelegram } from '../hooks/useTelegram'
import { CONFIG } from '../config'
import { createOrder, formatOrderError, generateOrderId, generateUniqueAmount } from '../utils/payment'
import { getLatestRates } from '../hooks/useCryptoRates'
import { tgNotify } from '../utils/tgNotify'
import { adminDepositCancelled, formatUserRef } from '../../../shared/telegramTemplates'
import { track } from '../utils/analytics'
import { rateLimit, rateLimitUndo, isValidAmount, audit } from '../utils/security'
import type { CryptoNetwork } from '../store/types'
import PendingInvoiceGate from '../components/PendingInvoiceGate'
import {
  isPendingCryptoInvoice,
  pickLatestPendingDeposit,
  pickLatestPendingCrypto,
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
  const location = useLocation()
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

  const resumedIdRef = useRef<string | null>(null)

  const activeDeposit = useMemo(() => pickLatestPendingDeposit(orders), [orders])
  const blockingBuy = useMemo(() => {
    const latest = pickLatestPendingCrypto(orders)
    return latest?.kind === 'buy' ? latest : null
  }, [orders])

  const resumeDeposit = (o: NonNullable<typeof activeDeposit>) => {
    if (!o) return
    resumedIdRef.current = o.id
    setAmount(String(o.amount))
    setNetwork((o.provider as CryptoNetwork) ?? null)
    setPendingOrder({
      id: o.id,
      uniqueAmount: o.amount,
      amountCrypto: o.amount_crypto,
      createdAt: o.created,
      expiresAt: o.expires_at,
    })
    setStep('pay')
  }

  const [step, setStep] = useState<Step>('amount')
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState<CryptoNetwork | null>(null)
  const [pendingOrder, setPendingOrder] = useState<{
    id: string
    uniqueAmount: number
    amountCrypto?: number
    createdAt: string
    expiresAt?: string
    address?: string
  } | null>(null)

  useEffect(() => {
    void reconcilePendingOrders()
  }, [reconcilePendingOrders])

  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo

  useEffect(() => {
    const st = location.state as { resumeOrderId?: string; returnTo?: string } | null
    const resumeId = st?.resumeOrderId
    if (resumeId) {
      const o = orders.find((x) => x.id === resumeId && x.kind === 'deposit' && x.status === 'pending')
      if (o) resumeDeposit(o)
      const keep = st?.returnTo ? { returnTo: st.returnTo } : {}
      navigate(location.pathname, { replace: true, state: keep })
      return
    }
    if (blockingBuy) return
    if (activeDeposit) {
      if (resumedIdRef.current !== activeDeposit.id) resumeDeposit(activeDeposit)
      return
    }
    resumedIdRef.current = null
    if (pendingOrder) {
      const o = orders.find((x) => x.id === pendingOrder.id)
      if (!o || o.kind !== 'deposit' || o.status !== 'pending') {
        setPendingOrder(null)
        if (step === 'pay') setStep('amount')
      }
    }
  }, [
    activeDeposit?.id,
    blockingBuy?.id,
    orders,
    pendingOrder?.id,
    step,
    location.state,
    location.pathname,
    navigate,
  ])

  const numAmount = parseFloat(amount) || 0
  const amountOk = numAmount >= 1
  const cryptoOption = CRYPTO_OPTIONS.find((c) => c.id === network)

  const removeNotification = useStore((s) => s.removeNotification)
  const refreshUser = useStore((s) => s.refreshUser)

  const cancelDeposit = async () => {
    if (!pendingOrder) return
    try { if (api.isEnabled()) await api.cancelOrder(pendingOrder.id) } catch { /* proceed with local cleanup */ }
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
    try {
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
    const amountCrypto = remote?.amount_crypto
    if (!api.isEnabled()) await getLatestRates()
    addOrder({
      id: orderId,
      orderNum: depositCount,
      kind: 'deposit',
      amount: uniqueAmount,
      amount_crypto: amountCrypto,
      status: 'pending',
      provider: network,
      created: new Date().toISOString(),
      expires_at: remote?.expires_at,
    })
    setPendingOrder({
      id: orderId,
      uniqueAmount,
      amountCrypto,
      createdAt: new Date().toISOString(),
      expiresAt: remote?.expires_at,
      address: remote?.address,
    })
    addNotification({ orderId, kind: 'deposit', amountUsd: uniqueAmount, uniqueAmount, network })
    setCreating(false)
    setStep('pay')
    } catch {
      toast.show(lang === 'ru' ? 'Ошибка сети' : 'Network error', 'error')
      setCreating(false)
    }
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
    if (step === 'amount') {
      if (returnTo) navigate(returnTo, { replace: true })
      else navigate(-1)
      return
    }
    if (step === 'pay') {
      if (returnTo) navigate(returnTo, { replace: true })
      else navigate('/profile')
      return
    }
    if (step === 'success') {
      if (returnTo) navigate(returnTo, { replace: true })
      else navigate('/profile')
      return
    }
    setStep('amount')
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
                <span className="dpz-amt-pill-eye">{lang === 'ru' ? 'Базовая сумма' : 'Base amount'}</span>
                <strong>~${numAmount.toFixed(2)}</strong>
              </div>
              <p className="t-xs t-muted" style={{ textAlign: 'center', marginBottom: 12 }}>
                {lang === 'ru'
                  ? 'На экране оплаты будет точная сумма с копейками для идентификации платежа'
                  : 'The payment screen will show the exact amount with cents for payment matching'}
              </p>

              <h1 className="dpz-h2">{lang === 'ru' ? 'Способ оплаты' : 'Payment method'}</h1>

              <NetworkPicker selected={network} onSelect={(n) => { setNetwork(n); haptic('light') }} lang={lang} />

              <button
                className="dpz-cta"
                disabled={!network || creating}
                onClick={handleSelectNetwork}
              >
                <span className="dpz-cta-t">
                  {creating
                    ? (lang === 'ru' ? 'Создаём счёт…' : 'Creating…')
                    : (lang === 'ru' ? 'Создать счёт' : 'Create invoice')}
                </span>
                <svg className="dpz-cta-ic" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
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

        <CryptoInvoiceOverlay
          open={step === 'pay' && !!cryptoOption && !!pendingOrder}
          title={lang === 'ru' ? 'Пополнение баланса' : 'Top up balance'}
          orderId={pendingOrder?.id ?? ''}
          uniqueAmount={pendingOrder?.uniqueAmount ?? 0}
          amountCrypto={pendingOrder?.amountCrypto}
          createdAt={pendingOrder?.createdAt}
          expiresAt={pendingOrder?.expiresAt}
          network={cryptoOption?.id ?? 'trc20'}
          cryptoName={cryptoOption?.name ?? ''}
          cryptoSymbol={cryptoOption?.symbol ?? ''}
          cryptoColor={cryptoOption?.color ?? '#39ff63'}
          cryptoAddressFallback={pendingOrder?.address || cryptoOption?.address || ''}
          lang={lang}
          onCancel={() => {
            void (async () => {
              await cancelDeposit()
              setStep('amount')
            })()
          }}
          onSuccess={handleSuccess}
        />
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

/** @deprecated Use CryptoInvoicePanel */
export { default as PayPanel } from '../components/CryptoInvoicePanel'

