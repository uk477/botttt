import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import NotificationBell from '../components/NotificationBell'
import { useStore } from '../store'
import { CONFIG } from '../config'
import { SettingsIcon } from '../components/NavIcons'

const MONTH_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTH_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW_RU   = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const DOW_EN   = ['Mo','Tu','We','Th','Fr','Sa','Su']

const GOAL = 10
const PER_REF = 5    // $5 per referral purchase
const MONTHLY_BONUS = 50  // $50 bonus for hitting 10 refs in a month
const MAX_MONTHLY = GOAL * PER_REF + MONTHLY_BONUS // $100 total (50 earned + 50 bonus)

function dayGradient(count: number): string {
  if (count === 0) return 'none'
  if (count === 1) return 'linear-gradient(135deg,#1a6b52,#26a17b)'
  if (count === 2) return 'linear-gradient(135deg,#1a4d8a,#4a90e2)'
  return 'linear-gradient(135deg,#6b1a8a,#b84ae2)'
}

function dayGlow(count: number): string {
  if (count === 0) return 'none'
  if (count === 1) return '0 0 12px rgba(38,161,123,0.55)'
  if (count === 2) return '0 0 12px rgba(74,144,226,0.55)'
  return '0 0 16px rgba(184,74,226,0.65)'
}

function DayEmoji({ count }: { count: number }) {
  if (count === 0) return null
  if (count >= 3) return <span style={{ fontSize: 16 }}>🔥</span>
  if (count >= 2) return <span style={{ fontSize: 14 }}>⭐</span>
  return <span style={{ fontSize: 13 }}>✨</span>
}

const HOW_STEPS_RU = [
  { icon: '🔗', title: 'Поделись ссылкой', desc: 'Отправь свою реферальную ссылку другу в Telegram, соцсетях или где угодно — это бесплатно' },
  { icon: '🛍', title: 'Друг совершает покупку', desc: 'Он переходит по ссылке, регистрируется и оплачивает любой товар в нашем маркете' },
  { icon: '💸', title: 'Ты получаешь $5', desc: 'Автоматически зачисляем $5 сразу после оплаты. 10 таких покупателей — ещё +$50 бонус сверху!' },
]

const HOW_STEPS_EN = [
  { icon: '🔗', title: 'Share your link', desc: 'Send your referral link to anyone via Telegram, social media or anywhere — it\'s free' },
  { icon: '🛍', title: 'Friend makes a purchase', desc: 'They follow the link, sign up and pay for any product in our market' },
  { icon: '💸', title: 'You earn $5', desc: 'We credit $5 automatically right after their payment. Get 10 such buyers — earn +$50 bonus on top!' },
]

const RULES_RU = [
  { icon: '✅', text: 'За каждого друга, который купил товар по твоей ссылке — **$5** на реф. баланс сразу' },
  { icon: '🎁', text: 'Ежемесячный бонус: приведи **10 покупателей** за месяц — получи **+$50** сверх заработанных $50. Итого до **$100** в месяц!' },
  { icon: '🎯', text: 'Прогресс обнуляется **1-го числа каждого месяца** — копи заново. Деньги остаются.' },
  { icon: '👤', text: 'Засчитывается только **новый пользователь** — тот, кто ещё не был зарегистрирован в боте' },
  { icon: '🛒', text: 'Реферал должен совершить **хотя бы одну оплату** любого товара (не просто зарегистрироваться)' },
  { icon: '🚫', text: 'Самореферальные схемы (один и тот же человек с разных аккаунтов) **не засчитываются и банятся**' },
  { icon: '💳', text: 'Вывод доступен от **$10** — это всего 2 реферала. Выводи хоть каждую неделю!' },
  { icon: '🔔', text: 'Уведомления о начислениях приходят **мгновенно** — следи в колокольчике' },
]

const RULES_EN = [
  { icon: '✅', text: 'For every friend who buys via your link — **$5** to your ref balance instantly' },
  { icon: '🎁', text: 'Monthly bonus: bring **10 buyers** in one month — earn **+$50** on top of your $50. Up to **$100/month**!' },
  { icon: '🎯', text: 'Progress resets on the **1st of each month** — start fresh. Your earned money stays.' },
  { icon: '👤', text: 'Only **new users** count — someone who was not previously registered in the bot' },
  { icon: '🛒', text: 'The referral must complete **at least one payment** for any product (not just register)' },
  { icon: '🚫', text: 'Self-referral schemes (same person from multiple accounts) **are not counted and will be banned**' },
  { icon: '💳', text: 'Withdrawal from **$10** — that\'s just 2 referrals. Withdraw as often as you like!' },
  { icon: '🔔', text: 'Accrual notifications arrive **instantly** — watch the bell icon' },
]

function RuleLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ color: 'var(--t-primary)', fontWeight: 800 }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </span>
  )
}

export default function RefCalendar() {
  const navigate     = useNavigate()
  const lang         = useStore((s) => s.lang)
  const refDailyLog  = useStore((s) => s.refDailyLog)
  const user         = useStore((s) => s.user)

  const now = new Date()
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [flipped,   setFlipped]   = useState<Record<number, boolean>>({})
  const [rulesOpen, setRulesOpen] = useState(false)

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  const todayDay = isCurrentMonth ? now.getDate() : -1

  const firstDow   = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}`
  const progress = Object.entries(refDailyLog)
    .filter(([k]) => k.startsWith(monthKey))
    .reduce((sum, [, v]) => sum + v, 0)
  const pct       = Math.min((progress / GOAL) * 100, 100)
  const earned    = progress * PER_REF + (progress >= GOAL ? MONTHLY_BONUS : 0)
  const monthName = lang === 'ru' ? MONTH_RU[viewMonth] : MONTH_EN[viewMonth]
  const dow       = lang === 'ru' ? DOW_RU : DOW_EN
  const howSteps  = lang === 'ru' ? HOW_STEPS_RU : HOW_STEPS_EN
  const rules     = lang === 'ru' ? RULES_RU : RULES_EN

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function getCount(day: number): number {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return refDailyLog[key] ?? 0
  }

  function handleFlip(day: number) {
    if (isCurrentMonth && day > todayDay) return
    setFlipped(f => ({ ...f, [day]: !f[day] }))
  }

  return (
    <PageTransition>
      <div className="page">

        {/* Header */}
        <motion.div className="row-between mb-4" initial={false} animate={{ opacity: 1, y: 0 }}>
          <motion.button
            onClick={() => navigate(-1)}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-muted)' }}
            whileTap={{ scale: 0.9 }}
          >←</motion.button>
          <div style={{ textAlign: 'center' }}>
            <div className="t-lg fw-black">{lang === 'ru' ? '🎁 Реф. календарь' : '🎁 Ref. Calendar'}</div>
            <div className="t-xs t-muted">{lang === 'ru' ? 'Твои приглашения' : 'Your invitations'}</div>
          </div>
          <div className="row gap-2">
            <NotificationBell />
            <motion.button
              className="card"
              style={{ padding: 10, color: 'var(--t-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => navigate('/settings')}
              whileTap={{ scale: 0.9 }}
            >
              <SettingsIcon size={20} />
            </motion.button>
          </div>
        </motion.div>

        {/* Monthly earnings card */}
        <motion.div
          className="balance-card mb-4"
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          style={{ padding: '18px 20px' }}
        >
          <div className="row-between mb-3">
            <div>
              <div className="t-xs" style={{ opacity: 0.75, marginBottom: 4 }}>
                {lang === 'ru' ? 'Заработано в этом месяце' : 'Earned this month'}
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>
                ${earned}
                <span style={{ fontSize: 16, fontWeight: 600, opacity: 0.65, marginLeft: 4 }}>/ ${MAX_MONTHLY}</span>
              </div>
              <div className="t-xs" style={{ marginTop: 6, opacity: 0.7 }}>
                {progress} / {GOAL} {lang === 'ru' ? 'покупателей' : 'buyers'}
                {progress > 0 && progress < GOAL && (
                  <span style={{ marginLeft: 8, color: '#FFD700', fontWeight: 700 }}>
                    🔥 +${progress * PER_REF} {lang === 'ru' ? 'уже твои' : 'already yours'}
                  </span>
                )}
              </div>
            </div>
            <motion.div
              animate={progress >= GOAL ? { rotate: [0, -10, 10, -6, 6, 0] } : {}}
              transition={{ duration: 0.5, repeat: progress >= GOAL ? Infinity : 0, repeatDelay: 2 }}
              style={{ fontSize: 44 }}
            >
              {progress >= GOAL ? '🏆' : '🎯'}
            </motion.div>
          </div>

          {/* Segmented progress bar */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
            {Array.from({ length: GOAL }).map((_, i) => (
              <motion.div
                key={i}
                style={{
                  flex: 1, height: 6, borderRadius: 3,
                  background: i < progress
                    ? (i < 3 ? '#26a17b' : i < 7 ? '#4a90e2' : '#b84ae2')
                    : 'rgba(255,255,255,0.2)',
                }}
                initial={{ scaleY: 0.3 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.2 + i * 0.04, type: 'spring', stiffness: 400 }}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {progress >= GOAL ? (
              <motion.div key="done" initial={false} animate={{ opacity: 1, y: 0 }} className="t-sm fw-bold" style={{ color: '#FFD700' }}>
                🎉 {lang === 'ru' ? `Цель! $${GOAL * PER_REF} + $${MONTHLY_BONUS} бонус = $${MAX_MONTHLY}!` : `Goal! $${GOAL * PER_REF} + $${MONTHLY_BONUS} bonus = $${MAX_MONTHLY}!`}
              </motion.div>
            ) : (
              <motion.div key="progress" initial={false} animate={{ opacity: 1 }} className="t-xs" style={{ opacity: 0.75 }}>
                {lang === 'ru'
                  ? `Ещё ${GOAL - progress} покупателей = +$${(GOAL - progress) * PER_REF} + 🎁 $${MONTHLY_BONUS} бонус`
                  : `${GOAL - progress} more buyers = +$${(GOAL - progress) * PER_REF} + 🎁 $${MONTHLY_BONUS} bonus`}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* How it works — 3 steps */}
        <motion.div
          className="mb-4"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <div className="t-sm fw-black mb-3" style={{ letterSpacing: '-0.01em' }}>
            {lang === 'ru' ? '⚡ Как это работает' : '⚡ How it works'}
          </div>
          <div className="col gap-2">
            {howSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  background: 'var(--surface-2)',
                  borderRadius: 12, padding: '12px 14px',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: i === 0
                    ? 'linear-gradient(135deg,rgba(232,54,93,0.2),rgba(232,54,93,0.08))'
                    : i === 1
                      ? 'linear-gradient(135deg,rgba(151,114,255,0.2),rgba(151,114,255,0.08))'
                      : 'linear-gradient(135deg,rgba(73,242,100,0.2),rgba(73,242,100,0.08))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>
                  {step.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-sm fw-bold" style={{ marginBottom: 3 }}>
                    <span style={{
                      background: 'var(--surface-hover)', borderRadius: 5,
                      fontSize: 10, fontWeight: 800, padding: '1px 6px', marginRight: 6,
                      color: 'var(--t-muted)',
                    }}>
                      {i + 1}
                    </span>
                    {step.title}
                  </div>
                  <div className="t-xs t-muted" style={{ lineHeight: 1.5 }}>{step.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Calendar header */}
        <motion.div className="row-between mb-3" initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <motion.button
            onClick={prevMonth}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
            whileTap={{ scale: 0.9 }}
          >‹</motion.button>
          <div className="t-md fw-black">{monthName} {viewYear}</div>
          <motion.button
            onClick={nextMonth}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
            whileTap={{ scale: 0.9 }}
          >›</motion.button>
        </motion.div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {dow.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--t-muted)', paddingBottom: 2 }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const day      = idx + 1
            const count    = getCount(day)
            const isToday  = day === todayDay
            const isFuture = isCurrentMonth && day > todayDay
            const isOpen   = !isFuture && (count > 0 || flipped[day])
            const grad     = dayGradient(count)
            const glow     = dayGlow(count)

            return (
              <motion.div
                key={day}
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.015, type: 'spring', stiffness: 300, damping: 20 }}
                whileTap={isFuture ? {} : { scale: 0.88 }}
                onClick={() => handleFlip(day)}
                style={{
                  aspectRatio: '1', borderRadius: 10,
                  background: isOpen ? grad : 'var(--surface-2)',
                  border: isToday ? '2px solid var(--brand)' : isOpen ? '1.5px solid transparent' : '1.5px solid var(--b-default)',
                  boxShadow: isOpen ? glow : isToday ? '0 0 10px rgba(var(--brand-rgb),0.4)' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: isFuture ? 'default' : 'pointer',
                  position: 'relative', overflow: 'hidden',
                  opacity: isFuture ? 0.35 : 1,
                }}
              >
                {isOpen && count > 0 && (
                  <motion.div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
                )}
                <AnimatePresence mode="wait">
                  {isOpen && count > 0 ? (
                    <motion.div key="open" initial={false} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.3 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, zIndex: 1 }}
                    >
                      <DayEmoji count={count} />
                      <span style={{ fontSize: 13, fontWeight: 900, color: 'white', lineHeight: 1 }}>+{count}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 600, lineHeight: 1 }}>{day}</span>
                    </motion.div>
                  ) : (
                    <motion.div key="closed" initial={false} animate={{ opacity: 1 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                    >
                      {isFuture
                        ? <span style={{ fontSize: 11, color: 'var(--t-muted)' }}>🔒</span>
                        : <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? 'var(--brand)' : 'var(--t-secondary)' }}>{day}</span>
                      }
                      {!isFuture && !isToday && <span style={{ fontSize: 8, color: 'var(--t-muted)', lineHeight: 1 }}>0</span>}
                    </motion.div>
                  )}
                </AnimatePresence>
                {isToday && (
                  <motion.div
                    style={{ position: 'absolute', inset: -2, borderRadius: 11, border: '2px solid var(--brand)', pointerEvents: 'none' }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  />
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Legend */}
        <motion.div
          className="col gap-2"
          style={{ marginTop: 20, padding: '14px', background: 'var(--surface-2)', borderRadius: 14 }}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="t-xs fw-bold t-muted" style={{ marginBottom: 4 }}>
            {lang === 'ru' ? 'Обозначения' : 'Legend'}
          </div>
          {[
            { grad: dayGradient(1), glow: dayGlow(1), emoji: '✨', label: lang === 'ru' ? '1 покупатель — $5' : '1 buyer — $5' },
            { grad: dayGradient(2), glow: dayGlow(2), emoji: '⭐', label: lang === 'ru' ? '2 покупателя — $10' : '2 buyers — $10' },
            { grad: dayGradient(3), glow: dayGlow(3), emoji: '🔥', label: lang === 'ru' ? '3+ покупателей — огонь!' : '3+ buyers — on fire!' },
          ].map((item) => (
            <div key={item.label} className="row gap-3" style={{ alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: item.grad, boxShadow: item.glow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                {item.emoji}
              </div>
              <span className="t-xs t-muted">{item.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Rules accordion */}
        <motion.div
          style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden', border: '1.5px solid var(--b-default)' }}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          {/* Accordion toggle */}
          <motion.button
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', background: 'var(--surface-2)', textAlign: 'left',
            }}
            onClick={() => setRulesOpen((v) => !v)}
            whileTap={{ scale: 0.99 }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg,rgba(255,215,0,0.2),rgba(255,165,0,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              📋
            </div>
            <div style={{ flex: 1 }}>
              <div className="t-sm fw-black">
                {lang === 'ru' ? 'Условия программы' : 'Program Terms'}
              </div>
              <div className="t-xs t-muted">
                {lang === 'ru' ? 'Как именно засчитываются рефералы' : 'How referrals are counted'}
              </div>
            </div>
            <motion.div
              animate={{ rotate: rulesOpen ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              style={{ color: 'var(--t-muted)', fontSize: 18, lineHeight: 1 }}
            >
              ‹
            </motion.div>
          </motion.button>

          {/* Rules content */}
          <AnimatePresence>
            {rulesOpen && (
              <motion.div
                initial={false}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '4px 16px 16px' }}>
                  {/* Hero banner */}
                  <div style={{
                    background: 'linear-gradient(135deg,rgba(232,54,93,0.1),rgba(151,114,255,0.08))',
                    border: '1px solid rgba(232,54,93,0.2)',
                    borderRadius: 12, padding: '14px 16px', marginBottom: 14, marginTop: 10,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>💰</div>
                    <div className="t-sm fw-black" style={{ marginBottom: 4 }}>
                      {lang === 'ru'
                        ? `$${PER_REF} за каждого + $${MONTHLY_BONUS} бонус при 10 = $${MAX_MONTHLY}/мес`
                        : `$${PER_REF} per buyer + $${MONTHLY_BONUS} bonus for 10 = $${MAX_MONTHLY}/month`}
                    </div>
                    <div className="t-xs t-muted" style={{ lineHeight: 1.5 }}>
                      {lang === 'ru'
                        ? `Каждый месяц заново. Деньги на балансе копятся вечно. Вывод от $10 в любое время.`
                        : `Resets monthly. Earned money accumulates forever. Withdraw from $10 at any time.`}
                    </div>
                  </div>

                  {/* Rules list */}
                  <div className="col gap-3">
                    {rules.map((rule, i) => (
                      <motion.div
                        key={i}
                        initial={false}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{rule.icon}</span>
                        <span className="t-xs t-muted" style={{ lineHeight: 1.6 }}>
                          <RuleLine text={rule.text} />
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Support link */}
                  <div style={{
                    marginTop: 16, padding: '12px 14px',
                    background: 'rgba(0,136,204,0.08)',
                    border: '1px solid rgba(0,136,204,0.2)',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 20 }}>✈️</span>
                    <div style={{ flex: 1 }}>
                      <div className="t-xs fw-bold" style={{ color: '#0088cc' }}>
                        {lang === 'ru' ? 'Остались вопросы?' : 'Have questions?'}
                      </div>
                      <div className="t-xs t-muted">
                        {lang === 'ru'
                          ? `Напиши нам в Telegram — @${CONFIG.adminUsername}`
                          : `Message us on Telegram — @${CONFIG.adminUsername}`}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div style={{ height: 24 }} />
      </div>
    </PageTransition>
  )
}
