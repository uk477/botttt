import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  generateSalesForDay,
  getSalesToday,
  formatTime,
  sameDay,
  isBeforeStats,
  buyerLabel,
  mskNow,
  type FakeSale,
} from '../utils/salesGen'
import { useStore } from '../store'

interface Props {
  onClose: () => void
  lang: 'ru' | 'en'
  productTitle: (i: 0 | 1) => string
}

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const MONTHS_RU_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEK_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const EASE = [0.22, 1, 0.36, 1] as const

function buildMonthGrid(viewMonth: Date) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
  const offset = (first.getDay() + 6) % 7
  const days: (Date | null)[] = []
  for (let i = 0; i < offset; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))
  }
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function dateDayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function mergeRealSales(realSales: { uid: number; productIndex: 0 | 1; ts: number }[], day: Date): FakeSale[] {
  const dk = dateDayKey(day)
  return realSales
    .filter((s) => dateDayKey(new Date(s.ts)) === dk)
    .map((s): FakeSale => {
      const h = ((s.uid * 2654435761) >>> 0).toString(16).toUpperCase().slice(0, 4)
      return {
        buyerId: `real-${s.uid}`,
        handle: h,
        avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=real${s.uid}&radius=50`,
        productIndex: s.productIndex,
        ts: s.ts,
      }
    })
}

export default function SalesHistorySheet({ onClose, lang, productTitle }: Props) {
  const [today] = useState(() => mskNow())
  const [selected, setSelected] = useState<Date>(() => mskNow())
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const n = mskNow()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [visible, setVisible] = useState(true)
  const closingRef = useRef(false)
  const realSales = useStore((s) => s.realSales)

  useEffect(() => {
    document.body.classList.add('sales-cal-open')
    const scroll = document.querySelector('.scroll-area')
    scroll?.classList.add('sales-cal-open')
    return () => {
      document.body.classList.remove('sales-cal-open')
      scroll?.classList.remove('sales-cal-open')
    }
  }, [])

  const closeSheet = () => {
    if (closingRef.current) return
    closingRef.current = true
    setVisible(false)
  }

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])

  const sales = useMemo(() => {
    const fakes = sameDay(selected, today)
      ? getSalesToday(today)
      : selected.getTime() > today.getTime() ? [] : generateSalesForDay(selected)
    const reals = mergeRealSales(realSales, selected)
    return [...reals, ...fakes].sort((a, b) => a.ts - b.ts)
  }, [selected, realSales, today])

  const countForDay = (d: Date) => {
    if (isBeforeStats(d) || d.getTime() > today.getTime()) return 0
    const fakes = sameDay(d, today) ? getSalesToday(today).length : generateSalesForDay(d).length
    return fakes + mergeRealSales(realSales, d).length
  }

  const monthName = (lang === 'ru' ? MONTHS_RU : MONTHS_EN)[viewMonth.getMonth()]
  const week = lang === 'ru' ? WEEK_RU : WEEK_EN

  const goPrevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
  const goNextMonth = () => {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
    if (next.getTime() > new Date(today.getFullYear(), today.getMonth(), 1).getTime()) return
    setViewMonth(next)
  }

  const stepDay = (delta: number) => {
    const next = new Date(selected)
    next.setDate(next.getDate() + delta)
    if (next.getTime() > today.getTime()) return
    setSelected(next)
    if (next.getMonth() !== viewMonth.getMonth() || next.getFullYear() !== viewMonth.getFullYear()) {
      setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1))
    }
  }

  const isFutureMonth =
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getTime()
    >= new Date(today.getFullYear(), today.getMonth() + 1, 0).getTime()

  const content = (
    <motion.div
      className="sales-cal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'ru' ? 'История продаж' : 'Sales history'}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      onAnimationComplete={() => {
        if (!visible) onClose()
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeSheet() }}
    >
      <motion.div
        className="sales-cal-sheet"
        initial={{ y: '100%' }}
        animate={{ y: visible ? 0 : '100%' }}
        transition={{ type: 'tween', duration: 0.32, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sales-cal-handle" aria-hidden />

        <header className="sales-cal-head">
          <div>
            <p className="sales-cal-eyebrow">{lang === 'ru' ? 'История продаж' : 'Sales history'}</p>
            <h2 className="sales-cal-title">{lang === 'ru' ? 'Календарь' : 'Calendar'}</h2>
          </div>
          <button type="button" className="sales-cal-close" onClick={closeSheet} aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <section className="sales-cal-card">
          <div className="sales-cal-month">
            <button type="button" className="sales-cal-nav" onClick={goPrevMonth} aria-label="Prev month">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <p className="sales-cal-month-title">
              {monthName} <span>{viewMonth.getFullYear()}</span>
            </p>
            <button type="button" className="sales-cal-nav" onClick={goNextMonth} disabled={isFutureMonth} aria-label="Next month">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          <div className="sales-cal-week">
            {week.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="sales-cal-grid">
            {grid.map((d, i) => {
              if (!d) return <div key={`e-${i}`} className="sales-cal-pad" />
              const isToday = sameDay(d, today)
              const isSel = sameDay(d, selected)
              const disabled = d.getTime() > today.getTime() || isBeforeStats(d)
              const count = countForDay(d)
              return (
                <button
                  key={`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
                  type="button"
                  className={[
                    'sales-cal-day',
                    isToday ? 'is-today' : '',
                    isSel ? 'is-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !disabled && setSelected(d)}
                  disabled={disabled}
                >
                  <span className="sales-cal-day-num">{d.getDate()}</span>
                  {count > 0 && <span className="sales-cal-day-dot">{count}</span>}
                </button>
              )
            })}
          </div>
        </section>

        <div className="sales-cal-daynav">
          <button type="button" className="sales-cal-nav" onClick={() => stepDay(-1)} aria-label="Prev day">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <p className="sales-cal-daylabel">
            {selected.getDate()} {lang === 'ru' ? MONTHS_RU_GEN[selected.getMonth()] : MONTHS_EN_SHORT[selected.getMonth()]}
            {sameDay(selected, today) && (
              <span> · {lang === 'ru' ? 'сегодня' : 'today'}</span>
            )}
          </p>
          <button
            type="button"
            className="sales-cal-nav"
            onClick={() => stepDay(1)}
            disabled={sameDay(selected, today)}
            aria-label="Next day"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        <div className="sales-cal-scroll">
          {isBeforeStats(selected) ? (
            <p className="sales-cal-empty">{lang === 'ru' ? 'Статистика ведётся с 20 апреля.' : 'Stats start from April 20.'}</p>
          ) : sales.length === 0 ? (
            <p className="sales-cal-empty">
              {sameDay(selected, today)
                ? (lang === 'ru' ? 'Сегодня пока тихо.' : 'Quiet so far today.')
                : (lang === 'ru' ? 'В этот день продаж не было.' : 'No sales on this day.')}
            </p>
          ) : (
            <ul className="sales-cal-list">
              {sales.map((s) => (
                <li key={`${s.buyerId}-${s.ts}`}>
                  <div className="sales-cal-av">
                    <img src={s.avatar} alt="" loading="lazy" />
                  </div>
                  <div className="sales-cal-meta">
                    <strong>{buyerLabel(s.handle, lang)}</strong>
                    <span>{productTitle(s.productIndex)}</span>
                  </div>
                  <time className="sales-cal-time">{formatTime(s.ts)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="sales-cal-foot">
          <span>{lang === 'ru' ? 'Сделок за день' : 'Sales this day'}</span>
          <strong>{sales.length}</strong>
        </footer>
      </motion.div>
    </motion.div>
  )

  return createPortal(content, document.body)
}
