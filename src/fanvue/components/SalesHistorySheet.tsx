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
import { useStore } from '../store'

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

export default function SalesHistorySheet({ open, onClose, lang, productTitle }: Props) {
  const [today] = useState(() => mskNow())
  const [selected, setSelected] = useState<Date>(today)
  const [viewMonth, setViewMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1))
  const realSales = useStore((s) => s.realSales)

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])

  const sales = useMemo(() => {
    const fakes = sameDay(selected, today)
      ? getSalesToday(today)
      : selected.getTime() > today.getTime() ? [] : generateSalesForDay(selected)
    const reals = mergeRealSales(realSales, selected)
    return [...reals, ...fakes].sort((a, b) => a.ts - b.ts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, realSales])

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

  const isFutureMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
    .getTime() >= new Date(today.getFullYear(), today.getMonth() + 1, 0).getTime()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              height: '80dvh',
              display: 'flex',
              flexDirection: 'column',
              background: '#0d100c',
              borderRadius: '20px 20px 0 0',
              borderTop: '1px solid rgba(57,255,99,0.18)',
              overflow: 'hidden',
              touchAction: 'none',
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '8px auto 0' }} />

            {/* Header — fixed */}
            <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{lang === 'ru' ? 'История продаж' : 'Sales history'}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{lang === 'ru' ? 'Календарь' : 'Calendar'}</div>
                </div>
                <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.6)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                </button>
              </div>

              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <button onClick={goPrevMonth} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', color: '#fff' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{monthName} <span style={{ color: 'rgba(255,255,255,0.4)' }}>{viewMonth.getFullYear()}</span></div>
                <button onClick={goNextMonth} disabled={isFutureMonth} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', color: '#fff', opacity: isFutureMonth ? 0.3 : 1 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>

              {/* Weekday headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                {week.map((w) => <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', padding: '2px 0' }}>{w}</div>)}
              </div>

              {/* Calendar grid — compact */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 12 }}>
                {grid.map((d, i) => {
                  if (!d) return <div key={i} />
                  const isToday = sameDay(d, today)
                  const isSel = sameDay(d, selected)
                  const disabled = d.getTime() > today.getTime() || isBeforeStats(d)
                  const count = countForDay(d)
                  return (
                    <button
                      key={i}
                      onClick={() => !disabled && setSelected(d)}
                      disabled={disabled}
                      style={{
                        position: 'relative',
                        height: 34,
                        borderRadius: 8,
                        border: isSel ? '1.5px solid #39ff63' : '1.5px solid transparent',
                        background: isSel ? 'rgba(57,255,99,0.12)' : isToday ? 'rgba(255,255,255,0.06)' : 'transparent',
                        color: disabled ? 'rgba(255,255,255,0.2)' : '#fff',
                        fontSize: 12,
                        fontWeight: isSel || isToday ? 800 : 600,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        cursor: disabled ? 'default' : 'pointer',
                      }}
                    >
                      <span>{d.getDate()}</span>
                      {count > 0 && (
                        <span style={{ fontSize: 8, fontWeight: 800, color: '#39ff63', lineHeight: 1 }}>{count}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Day detail — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y', padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Day nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 8px' }}>
                <button onClick={() => stepDay(-1)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', color: '#fff' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {selected.getDate()} {lang === 'ru' ? MONTHS_RU_GEN[selected.getMonth()] : MONTHS_EN_SHORT[selected.getMonth()]}
                  {sameDay(selected, today) && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>· {lang === 'ru' ? 'сегодня' : 'today'}</span>}
                </div>
                <button
                  onClick={() => stepDay(1)}
                  disabled={sameDay(selected, today)}
                  style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', color: '#fff', opacity: sameDay(selected, today) ? 0.3 : 1 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>

              {isBeforeStats(selected) ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                  {lang === 'ru' ? 'Статистика ведётся с 20 апреля.' : 'Stats start from April 20.'}
                </div>
              ) : sales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                  {sameDay(selected, today)
                    ? (lang === 'ru' ? 'Сегодня пока тихо.' : 'Quiet so far today.')
                    : (lang === 'ru' ? 'В этот день продаж не было.' : 'No sales on this day.')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sales.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                      <img src={s.avatar} alt="" style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }} loading="lazy" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{buyerLabel(s.handle, lang)}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{productTitle(s.productIndex)}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{formatTime(s.ts)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(57,255,99,0.06)', border: '1px solid rgba(57,255,99,0.1)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{lang === 'ru' ? 'Сделок за день' : 'Sales today'}</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#39ff63' }}>{sales.length}</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

void dayKey
void STATS_START
