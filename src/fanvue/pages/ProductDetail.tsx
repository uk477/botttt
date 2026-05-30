import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { NetworkPicker, PayPanel } from './Deposit'
import Confetti from '../components/Confetti'
import DeliveryBlock, { ManualDeliveryBlock } from '../components/DeliveryBlock'
import { useToast } from '../components/Toast'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { api } from '../store/api'
import { useTelegram } from '../hooks/useTelegram'
import { createOrder, formatOrderError, generateOrderId, generateUniqueAmount } from '../utils/payment'
import { tgNotify } from '../utils/tgNotify'
import {
  adminBalancePurchase,
  adminCryptoOrder,
  adminOrderCancelled,
  formatUserRef,
} from '../../../shared/telegramTemplates'
import { track } from '../utils/analytics'
import { rateLimit, audit } from '../utils/security'
import type { CryptoNetwork, Order } from '../store/types'


const EASE = [0.22, 1, 0.36, 1] as const

type PayStep = 'select' | 'pending_gate' | 'crypto_net' | 'crypto_pay' | 'success'

const TIERS = [
  { min: 3, pct: 5 },
  { min: 5, pct: 10 },
  { min: 10, pct: 15 },
]

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const toast = useToast()

  const lang = useStore((s) => s.lang)
  const products = useStore((s) => s.products)
  const categories = useStore((s) => s.categories)
  const user = useStore((s) => s.user)
  const orders = useStore((s) => s.orders)
  const addOrder = useStore((s) => s.addOrder)
  const updateBalance = useStore((s) => s.updateBalance)
  const addNotification = useStore((s) => s.addNotification)
  const setOrderStatus = useStore((s) => s.setOrderStatus)
  const tryAutoFulfill = useStore((s) => s.tryAutoFulfill)
  const addRealSale = useStore((s) => s.addRealSale)
  const refreshUser = useStore((s) => s.refreshUser)
  const cancelPendingBuyOrders = useStore((s) => s.cancelPendingBuyOrders)

  const product = products.find((p) => p.id === Number(id))
  const [qty, setQty] = useState(1)
  const [showPayment, setShowPayment] = useState(false)
  const [payStep, setPayStep] = useState<PayStep>('select')
  const [selectedNet, setSelectedNet] = useState<CryptoNetwork | null>(null)
  const [pendingOrder, setPendingOrder] = useState<{
    id: string
    uniqueAmount: number
    createdAt?: string
    expiresAt?: string
    address?: string
  } | null>(null)
  const purchaseLock = useRef(false)

  useEffect(() => {
    if (product) track('product_view', { id: product.id, title: product.title })
  }, [product])

  useEffect(() => {
    if (!showPayment) {
      setPayStep('select')
      setSelectedNet(null)
      setPendingOrder(null)
    }
  }, [showPayment])

  if (!product) {
    return (
      <div className="fv-detail-shell fv-detail-missing">
        <button className="fv-back" onClick={() => navigate(-1)}>←</button>
        <strong>{lang === 'ru' ? 'Товар не найден' : 'Product not found'}</strong>
      </div>
    )
  }

  const title = lang === 'ru' ? product.title : product.title_en
  const desc = lang === 'ru' ? product.description : product.desc_en
  const cat = categories.find((c) => c.id === product.cat_id)
  const isAuto = product.delivery === 'auto'
  const isOut = !isAuto && product.stock === 0
  const activeTier = [...TIERS].reverse().find((tier) => qty >= tier.min)
  const discountPct = activeTier?.pct ?? 0
  const total = product.price * qty * (1 - discountPct / 100)
  const balance = user?.balance ?? 0
  const hasEnoughBalance = balance >= total
  const cryptoOption = CRYPTO_OPTIONS.find((c) => c.id === selectedNet)

  const latestPendingBuy = useMemo(() => {
    const pending = orders
      .filter(
        (o) =>
          o.kind === 'buy' &&
          o.status === 'pending' &&
          o.provider &&
          o.provider !== 'balance',
      )
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
    return pending[0] ?? null
  }, [orders])

  const resumePendingBuy = (o: Order) => {
    const net = o.provider as CryptoNetwork
    setSelectedNet(net)
    setPendingOrder({
      id: o.id,
      uniqueAmount: o.amount,
      createdAt: o.created,
      expiresAt: o.expires_at,
    })
    setPayStep('crypto_pay')
  }

  const similar = products
    .filter((p) => p.active && p.id !== product.id && p.cat_id === product.cat_id)
    .slice(0, 3)

  const originalUnit = product.price
  const originalTotal = originalUnit * qty
  const lowStock = !isAuto && product.stock > 0 && product.stock <= 5
  const maxQty = Math.max(1, product.stock)
  const categoryName = cat ? (lang === 'ru' ? cat.name : cat.name_en) : 'Fanvue'
  const deliveryLabel = product.delivery === 'auto'
    ? (lang === 'ru' ? 'Мгновенно' : 'Instant')
    : (lang === 'ru' ? '1–24 часа' : '1–24h')


  const handleBuyWithBalance = async () => {
    if (purchaseLock.current || !user) return
    if (!rateLimit('purchase', 3, 30_000)) {
      toast.show(lang === 'ru' ? 'Слишком быстро, подождите' : 'Too fast, please wait', 'error')
      return
    }
    const freshBalance = useStore.getState().user?.balance ?? 0
    if (freshBalance < total) {
      toast.show(lang === 'ru' ? 'Недостаточно средств' : 'Insufficient balance', 'error')
      return
    }
    purchaseLock.current = true
    haptic('success')
    audit('purchase_balance', user.uid, { productId: product.id, qty, total })

    if (api.isEnabled()) {
      const res = await api.purchaseBalance({
        product_id: product.id,
        quantity: qty,
        amount_usd: total,
      })
      if (!res?.ok || !res.order) {
        toast.show(lang === 'ru' ? 'Не удалось оформить заказ' : 'Could not complete purchase', 'error')
        purchaseLock.current = false
        return
      }
      const o = res.order
      const orderId = String(o.id)
      addOrder({
        id: orderId,
        orderNum: orders.filter((x) => x.kind === 'buy').length + 1,
        kind: 'buy',
        product_title: title,
        product_id: product.id,
        amount: total,
        status: 'completed',
        quantity: qty,
        provider: 'balance',
        created: String(o.created_at ?? new Date().toISOString()),
        paid_at: String(o.paid_at ?? new Date().toISOString()),
      })
      await refreshUser()
      if (product.delivery === 'auto') tryAutoFulfill(orderId)
    } else {
      const buyCount = orders.filter((o) => o.kind === 'buy').length + 1
      const orderId = generateOrderId('buy')
      addOrder({
        id: orderId,
        orderNum: buyCount,
        kind: 'buy',
        product_title: title,
        product_id: product.id,
        amount: total,
        status: 'paid',
        quantity: qty,
        created: new Date().toISOString(),
        paid_at: new Date().toISOString(),
      })
      updateBalance(-total)
      if (product.delivery === 'auto') tryAutoFulfill(orderId)
      tgNotify(
        adminBalancePurchase({
          userLabel: formatUserRef({
            username: user.username,
            full_name: user.full_name,
            uid: user.uid,
          }),
          product: title,
          qty,
          amountUsd: total,
        }),
      )
    }

    addRealSale({
      id: `sale-${Date.now()}`,
      uid: user.uid,
      username: user.username,
      full_name: user.full_name,
      photo_url: user.photo_url,
      productTitle: title,
      productIndex: products.findIndex((p) => p.id === product.id) <= 0 ? 0 : 1,
      amount: total,
      ts: Date.now(),
    })
    toast.show(lang === 'ru' ? 'Заказ оплачен.' : 'Order paid.', 'success')
    setPayStep('success')
    setTimeout(() => { purchaseLock.current = false }, 2000)
  }

  const handlePayCrypto = async () => {
    if (!selectedNet || !user) return
    if (purchaseLock.current) return
    if (!rateLimit('purchase_crypto', 3, 30_000)) {
      toast.show(lang === 'ru' ? 'Слишком быстро, подождите' : 'Too fast, please wait', 'error')
      return
    }
    purchaseLock.current = true
    haptic('medium')
    audit('purchase_crypto', user?.uid, { productId: product.id, qty, total, network: selectedNet })
    await cancelPendingBuyOrders()
    const result = await createOrder({
      uid: user.uid,
      kind: 'buy',
      product_id: product.id,
      quantity: qty,
      amount_usd: total,
      network: selectedNet,
    })
    if (api.isEnabled() && !result.ok) {
      toast.show(formatOrderError(result.code, result.message, lang), 'error')
      purchaseLock.current = false
      return
    }
    const remote = result.ok ? result : null
    const buyCount = orders.filter((o) => o.kind === 'buy').length + 1
    const orderId = remote?.id ?? generateOrderId('buy')
    const uniqueAmount = remote?.amount_usd ?? generateUniqueAmount(total)
    const createdIso = new Date().toISOString()
    addOrder({
      id: orderId,
      orderNum: buyCount,
      kind: 'buy',
      product_title: title,
      product_id: product.id,
      amount: uniqueAmount,
      status: 'pending',
      quantity: qty,
      provider: selectedNet,
      created: createdIso,
    })
    setPendingOrder({
      id: orderId,
      uniqueAmount,
      createdAt: createdIso,
      expiresAt: remote?.expires_at,
      address: remote?.address,
    })
    tgNotify(
      adminCryptoOrder({
        userLabel: formatUserRef({
          username: user?.username,
          full_name: user?.full_name,
          uid: user?.uid,
        }),
        product: title,
        qty,
        amountUsd: uniqueAmount,
        network: selectedNet,
        orderId,
      }),
    )
    setPayStep('crypto_pay')
    setTimeout(() => { purchaseLock.current = false }, 2000)
  }

  const titleWords = title.split(/\s+/).filter(Boolean)
  const tickerItems = [
    deliveryLabel,
    lang === 'ru' ? 'ГОТОВ К ВЫДАЧЕ' : 'READY TO SHIP',
    lang === 'ru' ? 'ОПЛАТА КРИПТО / БАЛАНС' : 'CRYPTO / BALANCE',
    lang === 'ru' ? 'TELEGRAM ЧЕК' : 'TELEGRAM RECEIPT',
    lang === 'ru' ? 'ANTI-FRAUD' : 'ANTI-FRAUD',
  ]

  return (
    <PageTransition>
      <main className="pdb-shell">
        <div className="pdb-grid" aria-hidden />
        <div className="pdb-grain" aria-hidden />

        <header className="pdb-bar">
          <motion.button
            className="pdb-back"
            type="button"
            onClick={() => {
              haptic('light')
              navigate('/')
            }}
            aria-label="Back"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            whileTap={{ scale: 0.94 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
            <span>{lang === 'ru' ? 'НАЗАД' : 'BACK'}</span>
          </motion.button>
          <div className="pdb-bar-meta">
            <span className="pdb-bar-idx">№ {String(product.id).padStart(3, '0')}</span>
            <span className={`pdb-bar-dot${lowStock ? ' is-low' : ''}`}>
              <i /> {product.stock} {lang === 'ru' ? 'ШТ' : 'PCS'}
            </span>
          </div>
        </header>

        <div className="pdb-ticker" aria-hidden>
          <div className="pdb-ticker-track">
            {[...tickerItems, ...tickerItems, ...tickerItems].map((t, i) => (
              <span key={i}>
                {t}
                <em>◆</em>
              </span>
            ))}
          </div>
        </div>

        <section className="pdb-hero">
          <motion.div
            className="pdb-cat"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
          >
            <span className="pdb-cat-line" />
            <span className="pdb-cat-name">{categoryName}</span>
            <span className="pdb-cat-meta">/ {deliveryLabel}</span>
          </motion.div>

          <h1 className="pdb-title">
            {titleWords.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                className={`pdb-title-w${i === 0 ? ' is-fill' : ' is-stroke'}`}
                initial={false}
                animate={{ opacity: 1, y: 0, skewY: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.09 }}
              >
                {word}
              </motion.span>
            ))}
            <motion.span
              className="pdb-title-cursor"
              aria-hidden
              initial={false}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: 0.6 }}
            />
          </h1>

          <motion.p
            className="pdb-desc"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.45 }}
          >
            <span className="pdb-desc-rule" aria-hidden />
            {desc}
          </motion.p>

          <motion.div
            className="pdb-price"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.55 }}
          >
            <div className="pdb-price-label">
              <span>{lang === 'ru' ? 'К ОПЛАТЕ' : 'TOTAL'}</span>
              <em>USD</em>
            </div>
            <div className="pdb-price-figure">
              <motion.span
                key={total.toFixed(2)}
                initial={false}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.42, ease: EASE }}
              >
                ${total.toFixed(2)}
              </motion.span>
              <AnimatePresence>
                {discountPct > 0 && (
                  <motion.div
                    key={discountPct}
                    className="pdb-price-save"
                    initial={false}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                  >
                    <s>${originalTotal.toFixed(2)}</s>
                    <em>−{discountPct}%</em>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </section>

        <section className="pdb-section">
          <div className="pdb-section-head">
            <span className="pdb-section-num">02</span>
            <span className="pdb-section-bar" />
            <span className="pdb-section-name">{lang === 'ru' ? 'КОЛИЧЕСТВО' : 'QUANTITY'}</span>
            <span className="pdb-section-tail">{qty} × ${product.price.toFixed(0)}</span>
          </div>

          <div className="pdb-stepper">
            <button
              onClick={() => { haptic('light'); setQty((q) => Math.max(1, q - 1)) }}
              disabled={qty <= 1}
              aria-label="Decrease"
              className="pdb-step pdb-step--minus"
            >
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" /></svg>
            </button>
            <div className="pdb-step-value">
              <AnimatePresence mode="popLayout">
                <motion.b
                  key={qty}
                  initial={false}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -18, opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
                >
                  {qty}
                </motion.b>
              </AnimatePresence>
              <span>{lang === 'ru' ? 'ШТ.' : 'PCS'}</span>
            </div>
            <button
              onClick={() => { haptic('light'); setQty((q) => Math.min(maxQty, q + 1)) }}
              disabled={qty >= maxQty}
              aria-label="Increase"
              className="pdb-step pdb-step--plus"
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
              </svg>
            </button>
          </div>

          <div className="pdb-tiers">
            {TIERS.map((tier, idx) => {
              const active = qty >= tier.min
              return (
                <motion.button
                  key={tier.min}
                  className={`pdb-tier${active ? ' is-on' : ''}`}
                  onClick={() => { haptic('light'); setQty(Math.min(maxQty, tier.min)) }}
                  whileTap={{ scale: 0.96 }}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.1 + idx * 0.06 }}
                >
                  <span className="pdb-tier-min">{tier.min}+ {lang === 'ru' ? 'ШТ' : 'PCS'}</span>
                  <strong className="pdb-tier-pct">−{tier.pct}<i>%</i></strong>
                  <span className="pdb-tier-mark" aria-hidden>{active ? '●' : '○'}</span>
                </motion.button>
              )
            })}
          </div>
        </section>

        {similar.length > 0 && (
          <section className="pdb-section pdb-section--similar">
            <div className="pdb-section-head">
              <span className="pdb-section-num">03</span>
              <span className="pdb-section-bar" />
              <span className="pdb-section-name">{lang === 'ru' ? 'РЯДОМ' : 'NEARBY'}</span>
            </div>
            <div className="pdb-sim">
              {similar.map((item, i) => (
                <motion.button
                  key={item.id}
                  className="pdb-sim-row"
                  onClick={() => navigate(`/product/${item.id}`)}
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.05 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <span className="pdb-sim-idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="pdb-sim-name">{lang === 'ru' ? item.title : item.title_en}</span>
                  <strong className="pdb-sim-price">${item.price.toFixed(0)}</strong>
                  <svg className="pdb-sim-arr" width="14" height="14" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        <div className="pdb-cta-spacer" aria-hidden />

        <motion.div
          className="pdb-dock"
          initial={false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.25 }}
        >
          <motion.button
            className="pdb-cta"
            disabled={isOut}
            whileTap={{ scale: 0.985 }}
            onClick={() => {
              if (isOut) return
              haptic('medium')
              setShowPayment(true)
            }}
          >
            <span className="pdb-cta-bg" aria-hidden />
            <span className="pdb-cta-edge" aria-hidden />
            <span className="pdb-cta-l">
              <span className="pdb-cta-label">
                {isOut ? (lang === 'ru' ? 'НЕТ В НАЛИЧИИ' : 'SOLD OUT') : (lang === 'ru' ? 'ОФОРМИТЬ' : 'CHECKOUT')}
              </span>
              {!isOut && <span className="pdb-cta-sub">{lang === 'ru' ? 'мгновенная выдача' : 'instant delivery'}</span>}
            </span>
            {!isOut && (
              <span className="pdb-cta-r">
                <span className="pdb-cta-amount">${total.toFixed(2)}</span>
                <span className="pdb-cta-arrow" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                </span>
              </span>
            )}
          </motion.button>
        </motion.div>
      </main>

      <AnimatePresence>
        {showPayment && (
          <motion.div
            className="fv-sheet-overlay"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) setShowPayment(false)
            }}
          >
            <motion.div
              className="fv-pay-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            >
              <motion.div
                className="fv-sheet-handle"
                style={{ cursor: 'grab', paddingTop: 10, paddingBottom: 6 }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.3 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 80 || info.velocity.y > 500) {
                    setShowPayment(false)
                  }
                }}
              />

              {payStep === 'select' && (
                <motion.div
                  className="fv-pay-select"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, ease: EASE }}
                >
                  <span className="fv-section-kicker">{lang === 'ru' ? 'Оплата' : 'Checkout'}</span>
                  <h2>{lang === 'ru' ? 'Как оплачиваем?' : 'How do you want to pay?'}</h2>
                  <p className="fv-pay-sub">
                    {lang === 'ru'
                      ? 'Мгновенное зачисление, без скрытых комиссий.'
                      : 'Instant credit, no hidden fees.'}
                  </p>

                  <motion.button
                    className={`fv-pay-card fv-pay-card--balance${!hasEnoughBalance ? ' is-low' : ''}`}
                    onClick={hasEnoughBalance ? handleBuyWithBalance : undefined}
                    disabled={!hasEnoughBalance}
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06, duration: 0.4, ease: EASE }}
                    whileTap={hasEnoughBalance ? { scale: 0.985 } : undefined}
                  >
                    <span className="fv-pay-card-glow" aria-hidden />
                    <span className="fv-pay-card-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
                        <circle cx="17" cy="14.5" r="1.4" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="fv-pay-card-meta">
                      <span className="fv-pay-card-eye">{lang === 'ru' ? 'Баланс магазина' : 'Shop balance'}</span>
                      <strong>${balance.toFixed(2)}</strong>
                      <em>
                        {hasEnoughBalance
                          ? (lang === 'ru' ? `Спишется $${total.toFixed(2)} · мгновенно` : `Charges $${total.toFixed(2)} · instant`)
                          : (lang === 'ru' ? `Не хватает $${(total - balance).toFixed(2)}` : `Need $${(total - balance).toFixed(2)} more`)}
                      </em>
                    </span>
                    <span className="fv-pay-card-cta">
                      {hasEnoughBalance
                        ? (lang === 'ru' ? 'Оплатить' : 'Pay')
                        : (lang === 'ru' ? 'Пополнить' : 'Top up')}
                      <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </motion.button>

                  <motion.button
                    className="fv-pay-card fv-pay-card--crypto"
                    onClick={() => {
                      haptic('light')
                      setPayStep(latestPendingBuy ? 'pending_gate' : 'crypto_net')
                    }}
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.4, ease: EASE }}
                    whileTap={{ scale: 0.985 }}
                  >
                    <span className="fv-pay-card-glow" aria-hidden />
                    <span className="fv-pay-card-icon fv-pay-card-icon--c" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 3v18M7 7h7a3 3 0 0 1 0 6H7m0 0h8a3 3 0 0 1 0 6H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className="fv-pay-card-meta">
                      <span className="fv-pay-card-eye">{lang === 'ru' ? 'Криптовалюта' : 'Crypto'}</span>
                      <strong>USDT · USDC · BTC</strong>
                      <em className="fv-pay-card-chips">
                        <i>TRC20</i><i>ERC20</i><i>SOL</i>
                      </em>
                    </span>
                    <span className="fv-pay-card-cta">
                      {lang === 'ru' ? 'Выбрать' : 'Choose'}
                      <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </motion.button>

                  <div className="fv-pay-trust">
                    <span><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.7"/></svg>{lang === 'ru' ? 'Защищено' : 'Secure'}</span>
                    <span><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>{lang === 'ru' ? 'Зачисление сразу' : 'Instant credit'}</span>
                    <span><svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M5 6h14M5 18h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>{lang === 'ru' ? 'Чек в Telegram' : 'Telegram receipt'}</span>
                  </div>
                </motion.div>
              )}

              {payStep === 'pending_gate' && latestPendingBuy && (
                <motion.div
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, ease: EASE }}
                  style={{ padding: '0 4px 8px' }}
                >
                  <div className="fv-sheet-title-row">
                    <button type="button" onClick={() => setPayStep('select')} aria-label="Back">
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <h2>{lang === 'ru' ? 'Неоплаченный счёт' : 'Unpaid invoice'}</h2>
                  </div>
                  <p className="fv-pay-sub" style={{ marginBottom: 16 }}>
                    {lang === 'ru'
                      ? 'У вас уже есть ожидающая оплата. Продолжите её, отмените и создайте новую, или закройте окно — счёт останется в истории заказов.'
                      : 'You already have a pending payment. Continue it, cancel and create a new one, or close — the invoice stays in order history.'}
                  </p>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,210,74,0.28)',
                      background: 'rgba(255,210,74,0.08)',
                      marginBottom: 16,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      lineHeight: 1.6,
                    }}
                  >
                    <div>
                      {latestPendingBuy.product_title ?? (lang === 'ru' ? 'Заказ' : 'Order')}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.55)' }}>
                      ${latestPendingBuy.amount.toFixed(2)} · {latestPendingBuy.provider?.toUpperCase()}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.45)' }}>
                      #{latestPendingBuy.id.split('-').pop() ?? latestPendingBuy.id.slice(-8)}
                    </div>
                  </div>
                  <motion.button
                    className="dpz-cta fv-full"
                    type="button"
                    onClick={() => resumePendingBuy(latestPendingBuy)}
                    whileTap={{ scale: 0.98 }}
                    style={{ marginBottom: 10 }}
                  >
                    <span className="dpz-cta-bg" aria-hidden />
                    <span className="dpz-cta-t">{lang === 'ru' ? 'Продолжить оплату' : 'Continue payment'}</span>
                  </motion.button>
                  <motion.button
                    className="dpz-cta fv-full"
                    type="button"
                    onClick={() => {
                      void (async () => {
                        await cancelPendingBuyOrders()
                        setPendingOrder(null)
                        setSelectedNet(null)
                        setPayStep('crypto_net')
                      })()
                    }}
                    whileTap={{ scale: 0.98 }}
                    style={{ marginBottom: 10, opacity: 0.92 }}
                  >
                    <span className="dpz-cta-t">{lang === 'ru' ? 'Отменить и выбрать сеть' : 'Cancel & pick network'}</span>
                  </motion.button>
                  <button
                    type="button"
                    className="fv-pay-ghost"
                    onClick={() => setShowPayment(false)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: '14px',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      color: 'rgba(255,255,255,0.75)',
                      fontFamily: "'Space Grotesk', system-ui, sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {lang === 'ru' ? 'Закрыть (ждать в истории)' : 'Close (pay later in history)'}
                  </button>
                </motion.div>
              )}

              {payStep === 'crypto_net' && (
                <motion.div
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, ease: EASE }}
                >
                  <div className="fv-sheet-title-row">
                    <button onClick={() => setPayStep('select')} aria-label="Back">
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <h2>{lang === 'ru' ? 'Чем платим?' : 'How will you pay?'}</h2>
                  </div>
                  <div className="fv-pay-amount-pill">
                    <span>{lang === 'ru' ? 'К оплате' : 'Total'}</span>
                    <strong>${total.toFixed(2)}</strong>
                  </div>
                  <NetworkPicker selected={selectedNet} onSelect={(n) => { haptic('light'); setSelectedNet(n) }} lang={lang} />
                  <motion.button
                    className="dpz-cta fv-full"
                    disabled={!selectedNet}
                    onClick={handlePayCrypto}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="dpz-cta-bg" aria-hidden />
                    <span className="dpz-cta-t">{lang === 'ru' ? 'Создать оплату' : 'Create payment'}</span>
                    <svg className="dpz-cta-ic" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </motion.button>
                </motion.div>
              )}

              {payStep === 'crypto_pay' && cryptoOption && pendingOrder && (
                <motion.div
                  className="dpz dpz--inline"
                  initial={false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <PayPanel
                    orderId={pendingOrder.id}
                    amountUsd={total}
                    uniqueAmount={pendingOrder.uniqueAmount}
                    createdAt={pendingOrder.createdAt}
                    expiresAt={pendingOrder.expiresAt}
                    network={cryptoOption.id}
                    cryptoName={cryptoOption.name}
                    cryptoSymbol={cryptoOption.symbol}
                    cryptoColor={cryptoOption.color}
                    cryptoAddressFallback={pendingOrder.address || cryptoOption.address}
                    lang={lang}
                    onCancel={() => {
                      void (async () => {
                        if (!pendingOrder) return
                        if (api.isEnabled()) await api.cancelOrder(pendingOrder.id)
                        setOrderStatus(pendingOrder.id, 'expired')
                        tgNotify(
                          adminOrderCancelled({
                            userLabel: formatUserRef({
                              username: user?.username,
                              full_name: user?.full_name,
                              uid: user?.uid,
                            }),
                            product: title,
                            qty,
                            amountUsd: pendingOrder.uniqueAmount,
                            network: selectedNet || 'trc20',
                            orderId: pendingOrder.id,
                          }),
                        )
                        setPendingOrder(null)
                        setSelectedNet(null)
                        setPayStep('crypto_net')
                      })()
                    }}
                    onSuccess={() => {
                      if (pendingOrder && selectedNet) {
                        setOrderStatus(pendingOrder.id, 'paid')
                        // Автовыдача после оплаты криптой
                        if (product.delivery === 'auto') tryAutoFulfill(pendingOrder.id)
                        addNotification({
                          orderId: pendingOrder.id,
                          kind: 'buy',
                          amountUsd: total,
                          uniqueAmount: pendingOrder.uniqueAmount,
                          network: selectedNet,
                        })
                      }
                      setPayStep('success')
                    }}
                  />
                </motion.div>
              )}

              {payStep === 'success' && (() => {
                const lastOrder = orders[0]
                const delivered = lastOrder?.kind === 'buy' && lastOrder?.deliveryData
                const GREEN = '#39ff63'
                const MONO = "'JetBrains Mono', ui-monospace, monospace"
                const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
                return (
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 8, fontFamily: DISPLAY }}>
                    {!delivered && <Confetti trigger={true} />}

                    {/* kicker */}
                    <motion.div
                      initial={false}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ delay: 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      style={{ marginBottom: 18 }}
                    >
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        style={{ width: 48, height: 2, background: GREEN, transformOrigin: 'left', boxShadow: `0 0 12px ${GREEN}` }}
                      />
                      <div style={{
                        marginTop: 10, color: GREEN, fontFamily: MONO,
                        fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700,
                      }}>
                        {delivered
                          ? (lang === 'ru' ? 'Выдача / Подтверждено' : 'Delivery / Verified')
                          : (lang === 'ru' ? 'Подтверждение / Принято' : 'Confirmation / Received')}
                      </div>
                    </motion.div>

                    {/* heading */}
                    <motion.div
                      initial={false}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ delay: 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      style={{ marginBottom: 32 }}
                    >
                      <div style={{
                        color: 'rgba(255,255,255,0.4)', fontFamily: DISPLAY,
                        fontSize: 18, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1,
                        marginBottom: 6,
                      }}>
                        {lang === 'ru' ? 'Готово' : 'Done'}
                      </div>
                      <h1 style={{
                        margin: 0, color: '#fff',
                        fontFamily: DISPLAY, fontWeight: 700,
                        fontSize: 56, lineHeight: 0.9, letterSpacing: '-0.04em',
                      }}>
                        {delivered
                          ? (lang === 'ru' ? <>Заказ<br/>выдан</> : <>Order<br/>delivered</>)
                          : (lang === 'ru' ? <>Заказ<br/>создан</> : <>Order<br/>created</>)}
                      </h1>
                    </motion.div>

                    {delivered && lastOrder?.deliveryData ? (
                      <DeliveryBlock data={lastOrder.deliveryData} orderId={lastOrder.id} />
                    ) : (
                      <ManualDeliveryBlock
                        orderId={lastOrder?.id ?? pendingOrder?.id ?? '—'}
                        productTitle={lastOrder?.product_title ?? title}
                        amount={lastOrder?.amount ?? total}
                        createdAt={lastOrder?.created ?? new Date().toISOString()}
                      />
                    )}

                    <motion.button
                      initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setShowPayment(false); navigate('/orders') }}
                      style={{
                        marginTop: 32,
                        width: '100%', height: 64,
                        background: GREEN, color: '#000',
                        border: 'none', borderRadius: 18, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                        fontFamily: DISPLAY, fontWeight: 700, fontSize: 16,
                        letterSpacing: '-0.01em', textTransform: 'uppercase',
                        boxShadow: `0 10px 40px -10px ${GREEN}66`,
                      }}
                    >
                      <span>{lang === 'ru' ? 'Открыть заказы' : 'Open orders'}</span>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                    </motion.button>
                  </div>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
