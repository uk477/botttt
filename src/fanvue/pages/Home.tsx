import { useMemo, useRef, useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useMotionValue, useSpring, animate, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import { useTelegram } from '../hooks/useTelegram'
import SalesHistorySheet from '../components/SalesHistorySheet'
import { getOnline, getRecentSales, getTotalSales, formatAgo, buyerLabel, lotLabel, mskNow } from '../utils/salesGen'
import lotAccountImg from '../../assets/shop-lot-account.webp'
import lotVerifyImg from '../../assets/shop-lot-verify.webp'
import fanvueGlyph from '../../assets/fanvue-glyph.png'
import solanaLogo from '../assets/solana.svg'

const StickHeroGame = lazy(() => import('../games/StickHeroGame'))

const EASE = [0.22, 1, 0.36, 1] as const

export default function Home() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  const lang = useStore((s) => s.lang)
  const user = useStore((s) => s.user)
  const products = useStore((s) => s.products)
  const photos = useStore((s) => s.photos)
  const orders = useStore((s) => s.orders)

  const lots = useMemo(
    () => products.filter((p) => p.active).slice(0, 2),
    [products],
  )

  const balance = user?.balance ?? 0
  const myOrders = orders.filter((o) => o.status === 'pending').length

  const open = (id: number) => { haptic('medium'); navigate(`/product/${id}`) }
  const goDeposit = () => { haptic('light'); navigate('/deposit') }
  const goOrders  = () => { haptic('light'); navigate('/orders') }
  const goSupport = () => { haptic('light'); navigate('/support') }
  const goAbout   = () => { haptic('light'); navigate('/settings') }

  const fallback = [lotAccountImg, lotVerifyImg]

  // Realistic deterministic counters (re-evaluated periodically)
  const [now, setNow] = useState(() => mskNow().getTime())
  useEffect(() => {
    const t = setInterval(() => setNow(mskNow().getTime()), 30000)
    return () => clearInterval(t)
  }, [])

  const realSales = useStore((s) => s.realSales)

  const online = useMemo(() => getOnline(new Date(now)), [now])
  const recentSales = useMemo(() => {
    const fakes = getRecentSales(3, new Date(now))
    const merged = [
      ...realSales.map((s) => ({
        buyerId: `real-${s.uid}`,
        handle: s.username || s.full_name.slice(0, 4).toUpperCase(),
        avatar: s.photo_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${s.uid}&radius=50`,
        productIndex: s.productIndex,
        ts: s.ts,
      })),
      ...fakes,
    ]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5)
    return merged
  }, [now, realSales])
  const totalSales = useMemo(() => getTotalSales(new Date(now)) + orders.length, [now, orders.length])

  // Animated count-up for total sales
  const [shownTotal, setShownTotal] = useState(0)
  useEffect(() => {
    const c = animate(shownTotal, totalSales, {
      duration: 1.1, delay: 0.15, ease: EASE,
      onUpdate: (v) => setShownTotal(v),
    })
    return () => c.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSales])

  const [historyOpen, setHistoryOpen] = useState(false)

  const productTitle = (i: 0 | 1) => lotLabel(i, lang)

  // Animated balance count-up (0 → current on mount, smooth on change)
  const [shownBal, setShownBal] = useState(0)
  useEffect(() => {
    const c = animate(shownBal, balance, {
      duration: 0.95, delay: 0.12, ease: EASE,
      onUpdate: (v) => setShownBal(v),
    })
    return () => c.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance])
  const balDecimals = balance % 1 === 0 ? 0 : 2

  // Top-up ripple
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const spawnRipple = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const id = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }])
    window.setTimeout(() => {
      setRipples((rs) => rs.filter((x) => x.id !== id))
    }, 700)
  }

  // Easter egg: triple-tap the Fanvue logo to launch Stick Hero
  const tapsRef = useRef<number[]>([])
  const [eggPhase, setEggPhase] = useState<'idle' | 'loading' | 'playing'>('idle')
  const onLogoTap = () => {
    const now = performance.now()
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 700), now]
    if (tapsRef.current.length >= 3) {
      tapsRef.current = []
      haptic('success')
      setEggPhase('loading')
      window.setTimeout(() => setEggPhase('playing'), 1200)
    }
  }


  return (
    <main className="shop">
      {/* ── HERO ── */}
      <header className="shop-hero">
        <motion.div
          className="shop-hero-brand"
          aria-label="Fanvue Market"
          initial={false}
          animate={{ opacity: 1 }}
        >
          <motion.img
            src={fanvueGlyph}
            alt=""
            draggable={false}
            decoding="async"
            // @ts-expect-error - valid HTML attr
            fetchpriority="high"
            width={36}
            height={36}
            className="shop-hero-brand-logo"
            initial={false}
            animate={{ opacity: 1 }}
            onClick={onLogoTap}
            style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
            whileTap={{ scale: 0.85 }}
          />

          <motion.span
            className="shop-hero-brand-sep"
            aria-hidden
            initial={false}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
          />

          <span className="shop-hero-brand-mark" aria-hidden>
            {'MARKET'.split('').map((ch, i) => (
              <motion.span
                key={i}
                initial={false}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.44, ease: EASE, delay: 0.18 + i * 0.035 }}
              >
                {ch}
              </motion.span>
            ))}
            <span className="shop-hero-brand-sheen" aria-hidden />
          </span>

        </motion.div>


        <motion.div
          className="shop-hero-bal"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}
        >
          <div className="shop-hero-bal-main">
            <span className="shop-hero-bal-rule" aria-hidden />
            <div className="shop-hero-bal-text">
              <span className="shop-hero-bal-eye">{lang === 'ru' ? 'Ваш баланс' : 'Your balance'}</span>
              <span className="shop-hero-bal-num">
                <i>$</i>{shownBal.toFixed(balDecimals)}
              </span>
            </div>
            <div className="shop-hero-bal-decals" aria-hidden>
              <div className="shop-hero-bal-decal-row"><span className="dot dot-on" /><span className="bar bar-lg" /></div>
              <div className="shop-hero-bal-decal-row"><span className="bar bar-md" /><span className="bar bar-sm" /></div>
              <div className="shop-hero-bal-decal-row"><span className="bar bar-md" /></div>
            </div>
          </div>
          <motion.button
            className="home-topup"
            onPointerDown={spawnRipple}
            onClick={goDeposit}
            aria-label={lang === 'ru' ? 'Пополнить баланс' : 'Top up balance'}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
          >
            <span className="home-topup-bg" aria-hidden />
            <span className="home-topup-gloss" aria-hidden />
            <span className="home-topup-ring" aria-hidden />
            <span className="home-topup-l">
              <span className="home-topup-label">{lang === 'ru' ? 'ПОПОЛНИТЬ' : 'TOP UP'}</span>
              <span className="home-topup-coins" aria-hidden>
                {[
                  { id: 'usdt', src: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/usdt.svg' },
                  { id: 'eth',  src: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/eth.svg' },
                  { id: 'btc',  src: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/btc.svg' },
                  { id: 'sol',  src: solanaLogo },
                  { id: 'ton',  src: 'https://assets.coingecko.com/coins/images/17980/standard/ton_symbol.png' },
                ].map((c) => (
                  <span key={c.id} className="home-topup-coin">
                    <img src={c.src} alt="" width={18} height={18} loading="lazy" />
                  </span>
                ))}
              </span>
            </span>
            <span className="home-topup-arrow" aria-hidden>
              <span className="home-topup-arrow-box">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </span>
            <AnimatePresence>
              {ripples.map((r) => (
                <motion.span
                  key={r.id}
                  className="shop-hero-topup-ripple"
                  style={{ left: r.x, top: r.y }}
                  initial={false}
                  animate={{ opacity: 0, scale: 5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
                />
              ))}
            </AnimatePresence>
          </motion.button>
        </motion.div>

        <div className="shop-quick">
          <button className="shop-quick-i" onClick={goOrders}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            <span>{lang === 'ru' ? 'Заказы' : 'Orders'}</span>
            {myOrders > 0 && <i className="shop-quick-pip">{myOrders}</i>}
          </button>
          <button className="shop-quick-i" onClick={goSupport}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
            <span>{lang === 'ru' ? 'Чат' : 'Chat'}</span>
          </button>
          <button className="shop-quick-i" onClick={goAbout}>
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v.01M11 12h1v4h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>{lang === 'ru' ? 'О магазине' : 'About'}</span>
          </button>
        </div>
      </header>

      {/* ── LIVE STATUS BAR ── */}
      <motion.div
        className="shop-live"
        style={{ gridTemplateColumns: '0.9fr 1.12fr 1fr' }}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
      >
        <span className="shop-live-cell" style={{ justifyContent: 'center', padding: '10px 8px', gap: '6px' }}>
          <span className="shop-live-dot"><i /></span>
          <span className="shop-live-t">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.b
                key={online}
                initial={false}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: 8, opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.32, ease: EASE }}
              >{online}</motion.b>
            </AnimatePresence>
            {' '}{lang === 'ru' ? 'онлайн' : 'online'}
          </span>
        </span>
        <span className="shop-live-cell" style={{ justifyContent: 'center', padding: '10px 8px', gap: '6px' }}>
          <svg className="shop-live-ic" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 9-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="shop-live-t">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.b
                key={Math.round(shownTotal)}
                initial={false}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 6, opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
              >{Math.round(shownTotal)}</motion.b>
            </AnimatePresence>
            {' '}{lang === 'ru' ? 'продаж всего' : 'total sales'}
          </span>
        </span>
        <span className="shop-live-cell shop-live-cell--green" style={{ justifyContent: 'center', padding: '10px 8px', gap: '6px' }}>
          <span className="shop-live-bolt" aria-hidden="true">
            <svg className="shop-live-ic" viewBox="0 0 24 24" fill="none"><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </span>
          <span className="shop-live-t shop-live-t--green">
            {lang === 'ru' ? 'Быстрая выдача' : 'Fast delivery'}
          </span>
        </span>
      </motion.div>

      {/* ── TWO LOTS ── */}
      <section className="shop-lots">
        {lots.map((p, i) => {
          const rawTitle = lang === 'ru' ? p.title : p.title_en
          const rawDesc  = lang === 'ru' ? p.description : p.desc_en
          const title = i === 0
            ? (rawTitle === 'Готовый верифицированный аккаунт' || rawTitle === 'Ready verified account'
                ? (lang === 'ru' ? 'Verified-аккаунт' : 'Verified account')
                : rawTitle)
            : (rawTitle === 'Верификация вашего аккаунта' || rawTitle === 'Verify your account'
                ? (lang === 'ru' ? 'Прохождение верификации' : 'Verification service')
                : rawTitle)
          const desc = i === 0
            ? (rawDesc.startsWith('Полностью готовый аккаунт Fanvue') || rawDesc.startsWith('A fully ready Fanvue account')
                ? (lang === 'ru' ? 'Чистый профиль с пройденным верифом. Передаём данные сразу после оплаты.' : 'Clean profile, verification passed. Credentials handed over after payment.')
                : rawDesc)
            : (rawDesc.startsWith('Проводим верификацию') || rawDesc.startsWith('We verify your existing')
                ? (lang === 'ru' ? 'Проводим верификацию на твоём аккаунте. Деньги назад, если откажут.' : 'We pass verification on your account. Refund if rejected.')
                : rawDesc)
          const image = photos[`product_${p.id}`] || fallback[i] || fallback[0]
          const isAuto = p.delivery === 'auto'
          const isOut = !isAuto && p.stock === 0
          const isLow = !isAuto && !isOut && p.stock <= 5
          return (
            <LotCard
              key={p.id}
              index={i}
              num={String(i + 1).padStart(2, '0')}
              title={title}
              short={desc}
              price={p.price}
              image={image}
              delivery={p.delivery}
              isOut={isOut}
              isLow={isLow}
              stock={p.stock}
              lang={lang}
              onOpen={() => !isOut && open(p.id)}
            />
          )
        })}
      </section>

      {/* ── SALES HISTORY (live) ── */}
      <section className="shop-feed">
        <div className="shop-feed-h">
          <span className="shop-feed-pulse"><i /></span>
          <span>{lang === 'ru' ? 'Последние сделки' : 'Latest sales'}</span>
          <span className="shop-feed-count">{recentSales.length}</span>
        </div>
        {recentSales.length === 0 ? (
          <div className="shop-feed-empty">
            {lang === 'ru' ? 'Пока тихо. Будь первым.' : 'Quiet so far. Be the first.'}
          </div>
        ) : (
          <ul className="shop-feed-list">
            {recentSales.map((s, i) => (
              <motion.li
                key={s.ts}
                initial={false}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.04 * i, duration: 0.35, ease: EASE }}
              >
                <div className="shop-feed-av">
                  <img src={s.avatar} alt="" loading="lazy" />
                </div>
                <div className="shop-feed-txt">
                  <strong>{buyerLabel(s.handle, lang)}</strong>
                  <span>{productTitle(s.productIndex)}</span>
                </div>
                <span className="shop-feed-ago">{formatAgo(s.ts, lang, now)}</span>
              </motion.li>
            ))}
          </ul>
        )}
        <button className="shop-feed-more" onClick={() => { haptic('light'); setHistoryOpen(true) }}>
          <span>{lang === 'ru' ? 'Полная история продаж' : 'Full sales history'}</span>
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="shop-trust">
        <TrustItem
          index={0}
          glyph={<svg viewBox="0 0 24 24" fill="none"><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" stroke="currentColor" strokeWidth="1.6"/><path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          title={lang === 'ru' ? 'Возврат' : 'Refund'}
          sub={lang === 'ru' ? 'если сделка сорвалась' : 'if the deal fails'}
        />
        <TrustItem
          index={1}
          glyph={<svg viewBox="0 0 24 24" fill="none"><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>}
          title={lang === 'ru' ? 'Мгновенно' : 'Instant'}
          sub={lang === 'ru' ? 'выдача сразу после оплаты' : 'delivery right after payment'}
        />
        <TrustItem
          index={2}
          glyph={<svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5C4 5.12 5.12 4 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8A2.5 2.5 0 0 1 17.5 17H13l-4 3v-3H6.5A2.5 2.5 0 0 1 4 14.5v-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="9" cy="10.5" r="1" fill="currentColor"/><circle cx="12" cy="10.5" r="1" fill="currentColor"/><circle cx="15" cy="10.5" r="1" fill="currentColor"/></svg>}
          live
          title={lang === 'ru' ? 'Живой саппорт' : 'Real support'}
          sub={lang === 'ru' ? 'отвечаем за пару минут' : 'we reply in a couple of minutes'}
        />
      </section>

      <SalesHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        lang={lang}
        productTitle={productTitle}
      />

      <AnimatePresence>
        {eggPhase === 'loading' && (
          <motion.div
            key="egg-loading"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'radial-gradient(120% 80% at 50% 40%, #0e1820 0%, #050708 70%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22,
              color: '#fff',
            }}
          >
            <motion.div
              initial={false}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              style={{
                width: 76, height: 76, borderRadius: 22,
                background: 'linear-gradient(180deg,#39ff63,#1fe07a)',
                display: 'grid', placeItems: 'center',
                boxShadow: '0 20px 50px rgba(57,255,99,0.4), inset 0 -6px 14px rgba(0,0,0,0.18)',
                color: '#062612', fontWeight: 900, fontSize: 38, letterSpacing: '-0.04em',
              }}
            >F</motion.div>
            <div style={{ fontSize: 11, letterSpacing: '0.32em', color: '#7a8693', fontWeight: 700 }}>
              STICK HERO
            </div>
            <div style={{ width: 140, height: 3, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <motion.div
                initial={false}
                animate={{ x: '100%' }}
                transition={{ duration: 1.1, ease: 'easeInOut' }}
                style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg,transparent,#39ff63,transparent)' }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#a8b2bf' }}>
              {lang === 'ru' ? 'Загрузка…' : 'Loading…'}
            </div>
          </motion.div>
        )}
        {eggPhase === 'playing' && (
          <Suspense key="egg-game" fallback={null}>
            <StickHeroGame onExit={() => setEggPhase('idle')} />
          </Suspense>
        )}
      </AnimatePresence>
    </main>
  )
}

/* ──────────────── LOT CARD ──────────────── */
function LotCard({
  index, num, title, short, price, image, delivery, isOut, isLow, stock, lang, onOpen,
}: {
  index: number
  num: string
  title: string
  short: string
  price: number
  image: string
  delivery: 'auto' | 'manual'
  isOut: boolean
  isLow: boolean
  stock: number
  lang: 'ru' | 'en'
  onOpen: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const mediaY = useTransform(scrollYProgress, [0, 1], ['-8%', '12%'])
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.16])

  const cx = useMotionValue(0)
  const cy = useMotionValue(0)
  const sx = useSpring(cx, { stiffness: 280, damping: 20 })
  const sy = useSpring(cy, { stiffness: 280, damping: 20 })
  const onCtaMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    cx.set(((e.clientX - r.left) / r.width - 0.5) * 14)
    cy.set(((e.clientY - r.top) / r.height - 0.5) * 8)
  }
  const onCtaLeave = () => { cx.set(0); cy.set(0) }

  const [shown, setShown] = useState(0)
  useEffect(() => {
    const c = animate(0, price, {
      duration: 0.9, delay: 0.2 + index * 0.15, ease: EASE,
      onUpdate: (v) => setShown(v),
    })
    return () => c.stop()
  }, [price, index])

  const variant = index === 0 ? 'shop-lot--a' : 'shop-lot--b'

  return (
    <motion.article
      ref={ref}
      className={`shop-lot ${variant}${isOut ? ' is-out' : ''}`}
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.08 }}
      onClick={onOpen}
    >
      <div className="shop-lot-num" aria-hidden>
        <span>{num}</span>
        <i />
        <span className="shop-lot-num-eye">{lang === 'ru' ? 'лот' : 'lot'}</span>
      </div>

      <div className="shop-lot-media">
        <motion.img
          src={image}
          alt=""
          loading="eager"
          decoding="async"
          // @ts-expect-error - valid HTML attr
          fetchpriority="high"
          style={{ y: mediaY, scale: mediaScale }}
        />
        <div className="shop-lot-shade" />
        <div className="shop-lot-tags">
          <span className={`shop-tag ${delivery === 'auto' ? 'is-auto' : 'is-manual'}`}>
            {delivery === 'auto'
              ? (lang === 'ru' ? 'Авто' : 'Auto')
              : (lang === 'ru' ? 'Ручная' : 'Manual')}
          </span>
          {isLow && !isOut && (
            <span className="shop-tag is-low">
              <i />
              {lang === 'ru' ? `−${stock}` : `${stock} left`}
            </span>
          )}
          {isOut && (
            <span className="shop-tag is-out">
              {lang === 'ru' ? 'Нет' : 'Sold'}
            </span>
          )}
        </div>
      </div>

      <div className="shop-lot-body">
        <div className="shop-lot-eye">
          <span>{lang === 'ru' ? (index === 0 ? 'Топ-лот · готов к выдаче' : 'Сервис под ключ') : (index === 0 ? 'Top lot · ready to ship' : 'Done-for-you service')}</span>
        </div>

        <h2 className="shop-lot-title">{title}</h2>
        <p className="shop-lot-desc">{short}</p>

        <ul className="shop-lot-feats">
          {(index === 0
            ? [
                lang === 'ru' ? 'Вериф уже пройден' : 'Verified already',
                lang === 'ru' ? 'Быстрая выдача' : 'Fast handoff',
              ]
            : [
                lang === 'ru' ? 'Помогаем пройти этапы' : 'Step-by-step help',
                lang === 'ru' ? 'Возврат если отказ' : 'Refund if rejected',
              ]
          ).map((t) => (
            <li key={t}>
              <svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <div className="shop-lot-foot">
          <div className="shop-price">
            <span className="shop-price-cur">$</span>
            <span className="shop-price-num">{Math.round(shown)}</span>
          </div>
          <motion.button
            className="shop-cta"
            onPointerMove={onCtaMove}
            onPointerLeave={onCtaLeave}
            onClick={(e) => { e.stopPropagation(); onOpen() }}
            disabled={isOut}
            whileTap={{ scale: 0.96 }}
            style={{ x: sx, y: sy }}
          >
            <span>{isOut ? (lang === 'ru' ? 'Нет' : 'Sold') : (lang === 'ru' ? 'Взять' : 'Buy')}</span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </motion.button>
        </div>
      </div>
    </motion.article>
  )
}

function TrustItem({ index = 0, glyph, title, sub, live = false }: { index?: number; glyph: React.ReactNode; title: string; sub: string; live?: boolean }) {
  return (
    <motion.div
      className={`shop-trust-item${live ? ' is-live' : ''}`}
      initial={false}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: EASE, delay: 0.06 * index }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="shop-trust-shine" aria-hidden />
      <div className="shop-trust-glyph">
        <span className="shop-trust-glyph-ring" aria-hidden />
        {glyph}
        {live && <span className="shop-trust-live" aria-hidden><i /></span>}
      </div>
      <div className="shop-trust-text">
        <strong>{title}</strong>
        <span>{sub}</span>
      </div>
    </motion.div>
  )
}
