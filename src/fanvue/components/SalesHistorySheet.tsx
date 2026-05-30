import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  generateSalesForDay,
  getSalesToday,
  formatTime,
  sameDay,
  dayKey,
  isBeforeStats,
  buyerLabel,
  STATS_START,
  mskNow,
  type FakeSale,
} from '../utils/salesGen'

interface Props {
  open: boolean
  onClose: () => void
  lang: 'ru' | 'en'
  productTitle: (i: 0 | 1) => string
}

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTHS_RU_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_EN_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEK_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const WEEK_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function buildMonthGrid(viewMonth: Date) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
  // Monday-first offset
  const offset = (first.getDay() + 6) % 7
  const days: (Date | null)[] = []
  for (let i = 0; i < offset; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))
  }
  while (days.length % 7 !== 0) days.push(null)
  return days
}

export default function SalesHistorySheet({ open, onClose, lang, productTitle }: Props) {
  const today = mskNow()
  const [selected, setSelected] = useState<Date>(today)
  const [viewMonth, setViewMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1))

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])

  const sales: FakeSale[] = useMemo(() => {
    if (sameDay(selected, today)) return getSalesToday(today)
    if (selected.getTime() > today.getTime()) return []
    return generateSalesForDay(selected)
  }, [selected, today])

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

  const isFutureMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
    .getTime() >= new Date(today.getFullYear(), today.getMonth() + 1, 0).getTime()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="hist-overlay"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            className="hist-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="hist-grab" />

            <div className="hist-head">
              <div className="hist-head-l">
                <span className="hist-eye">{lang === 'ru' ? 'История продаж' : 'Sales history'}</span>
                <strong>{lang === 'ru' ? 'Календарь' : 'Calendar'}</strong>
              </div>
              <button className="hist-close" onClick={onClose} aria-label="close">
                <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Month switcher */}
            <div className="hist-monthbar">
              <button className="hist-arr" onClick={goPrevMonth} aria-label="prev month">
                <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="hist-monthname">{monthName} <span>{viewMonth.getFullYear()}</span></div>
              <button className="hist-arr" onClick={goNextMonth} disabled={isFutureMonth} aria-label="next month">
                <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            <div className="hist-week">
              {week.map((w) => <span key={w}>{w}</span>)}
            </div>

            <div className="hist-grid">
              {grid.map((d, i) => {
                if (!d) return <span key={i} className="hist-cell hist-cell--empty" />
                const isToday = sameDay(d, today)
                const isSel = sameDay(d, selected)
                const isFuture = d.getTime() > today.getTime()
                const preStart = isBeforeStats(d)
                const disabled = isFuture || preStart
                const count = disabled ? 0
                  : (isToday ? getSalesToday(today).length : generateSalesForDay(d).length)
                return (
                  <button
                    key={i}
                    className={`hist-cell${isSel ? ' is-selected' : ''}${isToday ? ' is-today' : ''}${disabled ? ' is-future' : ''}`}
                    onClick={() => !disabled && setSelected(d)}
                    disabled={disabled}
                  >
                    <span className="hist-cell-n">{d.getDate()}</span>
                    {count > 0 && <span className="hist-cell-pip">{count}</span>}
                  </button>
                )
              })}
            </div>

            {/* Day detail */}
            <div className="hist-day">
              <div className="hist-day-nav">
                <button className="hist-arr" onClick={() => stepDay(-1)} aria-label="prev day">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div className="hist-day-name">
                  {selected.getDate()} {lang === 'ru' ? MONTHS_RU_GEN[selected.getMonth()] : MONTHS_EN_SHORT[selected.getMonth()]}
                  {sameDay(selected, today) && <em>· {lang === 'ru' ? 'сегодня' : 'today'}</em>}
                </div>
                <button
                  className="hist-arr"
                  onClick={() => stepDay(1)}
                  disabled={sameDay(selected, today) || selected.getTime() > today.getTime()}
                  aria-label="next day"
                >
                  <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>

              {isBeforeStats(selected) ? (
                <div className="hist-empty">
                  {lang === 'ru' ? 'Статистика магазина ведётся с 20 апреля.' : 'Stats start from April 20.'}
                </div>
              ) : sales.length === 0 ? (
                <div className="hist-empty">
                  {sameDay(selected, today)
                    ? (lang === 'ru' ? 'Сегодня пока тихо. Скоро будут сделки.' : 'Quiet so far today.')
                    : (lang === 'ru' ? 'В этот день продаж не было.' : 'No sales on this day.')}
                </div>
              ) : (
                <ul className="hist-list">
                  {sales.map((s, idx) => (
                    <motion.li
                      key={idx}
                      initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <div className="hist-list-av">
                        <img src={s.avatar} alt="" loading="lazy" />
                      </div>
                      <div className="hist-list-txt">
                        <strong>{buyerLabel(s.handle, lang)}</strong>
                        <span>{productTitle(s.productIndex)}</span>
                      </div>
                      <span className="hist-list-time">{formatTime(s.ts)}</span>
                    </motion.li>
                  ))}
                </ul>
              )}

              <div className="hist-day-foot">
                <span>{lang === 'ru' ? 'Сделок за день' : 'Sales today'}</span>
                <strong>{sales.length}</strong>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// silence unused warnings
void dayKey
void STATS_START
