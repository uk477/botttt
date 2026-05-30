import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { useT } from '../i18n'
import PageTransition from '../components/PageTransition'

/* ───── icons ───── */
const Ic = {
  users:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  box:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  rev:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  pending: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  up:      () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 15 12 9 18 15"/></svg>,
  down:    () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  arrow:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
  dl:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
}

type Period = 'today' | 'week' | 'month' | 'all'

function withinPeriod(ts: string, period: Period) {
  if (period === 'all') return true
  const d   = new Date(ts).getTime()
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  if (period === 'today') return now - d < day
  if (period === 'week')  return now - d < 7 * day
  return now - d < 30 * day
}
function prevPeriod(ts: string, period: Period) {
  if (period === 'all') return false
  const d   = new Date(ts).getTime()
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const span = period === 'today' ? day : period === 'week' ? 7 * day : 30 * day
  return now - d >= span && now - d < 2 * span
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null
  const w = 70, h = 22
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const step = w / (points.length - 1)
  const norm = (v: number) => h - ((v - min) / (max - min || 1)) * h
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${norm(p)}`).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({ Icon, value, label, accent, delta, spark, delay = 0 }: {
  Icon: () => JSX.Element; value: string; label: string; accent: string;
  delta?: number; spark?: number[]; delay?: number
}) {
  const up = (delta ?? 0) >= 0
  return (
    <motion.div
      className="adm2-kpi"
      style={{ ['--kpi-accent' as never]: accent }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
    >
      <div className="adm2-kpi-top">
        <span className="adm2-kpi-ic"><Icon /></span>
        {typeof delta === 'number' && (
          <span className={`adm2-kpi-delta ${up ? 'up' : 'down'}`}>
            {up ? <Ic.up /> : <Ic.down />}{Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="adm2-kpi-val">{value}</div>
      <div className="adm2-kpi-row">
        <span className="adm2-kpi-lbl">{label}</span>
        {spark && <Sparkline points={spark} color={`rgb(${accent})`} />}
      </div>
    </motion.div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const t        = useT()
  const orders   = useStore((s) => s.orders)
  const logs     = useStore((s) => s.logs)
  const tickets  = useStore((s) => s.supportTickets)
  const products = useStore((s) => s.products)
  const refW     = useStore((s) => s.refWithdrawals)
  const supportMessages = useStore((s) => s.supportMessages)

  const [period, setPeriod] = useState<Period>('today')
  const [exportOpen, setExportOpen] = useState(false)

  const buys = useMemo(
    () => orders.filter((o) => o.kind === 'buy' && (o.status === 'completed' || o.status === 'paid')),
    [orders],
  )

  const cur = buys.filter((o) => withinPeriod(o.created, period))
  const prv = buys.filter((o) => prevPeriod(o.created, period))

  const sumCur = cur.reduce((s, o) => s + o.amount, 0)
  const sumPrv = prv.reduce((s, o) => s + o.amount, 0)
  const revDelta = sumPrv === 0 ? (sumCur > 0 ? 100 : 0) : ((sumCur - sumPrv) / sumPrv) * 100

  const ordersDelta = prv.length === 0
    ? (cur.length > 0 ? 100 : 0)
    : ((cur.length - prv.length) / prv.length) * 100

  /* sparkline — последние 7 баков по дням */
  const days = 7
  const dayMs = 24 * 60 * 60 * 1000
  const now = Date.now()
  const revSpark = Array.from({ length: days }, (_, i) => {
    const from = now - (days - i) * dayMs
    const to   = now - (days - i - 1) * dayMs
    return buys
      .filter((o) => {
        const d = new Date(o.created).getTime()
        return d >= from && d < to
      })
      .reduce((s, o) => s + o.amount, 0)
  })
  const ordSpark = Array.from({ length: days }, (_, i) => {
    const from = now - (days - i) * dayMs
    const to   = now - (days - i - 1) * dayMs
    return buys.filter((o) => {
      const d = new Date(o.created).getTime()
      return d >= from && d < to
    }).length
  })

  const uniqueUsers  = new Set(logs.map((l) => l.uid)).size + 12
  const pendingCount = orders.filter((o) => o.status === 'pending').length

  /* attention — only tickets awaiting admin reply */
  const openTickets = tickets.filter((tk) => {
    if (tk.status === 'closed') return false
    const ticketMsgs = supportMessages.filter(
      (m) => m.ticket_id === tk.id &&
        (m.kind === 'text' || m.kind === 'image' || m.kind === 'file' || !m.kind),
    )
    const hasAdminReply = ticketMsgs.some((m) => m.sender === 'admin')
    const hasUnreadUserMsg = ticketMsgs.some((m) => m.sender === 'user' && !m.read_by_admin)
    return !hasAdminReply || hasUnreadUserMsg
  }).length
  const pendingRefW = refW.filter((w) => w.status === 'pending').length

  /* top products */
  const topProducts = useMemo(() => {
    const map = new Map<string, { title: string; count: number; revenue: number }>()
    for (const o of buys) {
      const k = o.product_title ?? '—'
      const cur = map.get(k) ?? { title: k, count: 0, revenue: 0 }
      cur.count += o.quantity ?? 1
      cur.revenue += o.amount
      map.set(k, cur)
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 4)
  }, [buys])

  const recent = logs.slice(0, 6)

  const periodLabel: Record<Period, string> = {
    today: 'Сегодня', week: 'Неделя', month: 'Месяц', all: 'Всё время',
  }

  /* ───── export sales ───── */
  const findBuyer = (o: typeof buys[number]) => {
    const ot = new Date(o.created).getTime()
    const candidates = logs.filter(
      (l) => l.kind === 'buy' && l.product === o.product_title && Math.abs(l.amount - o.amount) < 0.01 && l.username !== 'manual',
    )
    if (candidates.length === 0) return { username: '—', uid: '—' as number | string }
    candidates.sort((a, b) => Math.abs(new Date(a.ts).getTime() - ot) - Math.abs(new Date(b.ts).getTime() - ot))
    return { username: candidates[0].username, uid: candidates[0].uid }
  }

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const fmtDate = (ts: string) =>
    new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const exportRows = () => cur.map((o, i) => {
    const b = findBuyer(o)
    return {
      n: i + 1,
      orderId: o.id,
      orderNum: o.orderNum ?? '',
      date: fmtDate(o.created),
      paidAt: o.paid_at ? fmtDate(o.paid_at) : '',
      buyer: b.username,
      uid: String(b.uid),
      product: o.product_title ?? '—',
      qty: o.quantity ?? 1,
      price: o.amount.toFixed(2),
      status: o.status,
      provider: o.provider ?? '',
      txid: o.txid ?? '',
    }
  })

  const handleExportCSV = () => {
    const rows = exportRows()
    const headers = ['№','ID заказа','Номер','Дата создания','Дата оплаты','Покупатель','UID','Товар','Кол-во','Цена ($)','Статус','Метод оплаты','TxID']
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [headers.join(';')]
    for (const r of rows) {
      lines.push([r.n, r.orderId, r.orderNum, r.date, r.paidAt, r.buyer, r.uid, r.product, r.qty, r.price, r.status, r.provider, r.txid].map(esc).join(';'))
    }
    lines.push('')
    lines.push(['','','','','','','','ИТОГО:', cur.length, sumCur.toFixed(2),'','',''].map(esc).join(';'))
    // BOM for proper UTF-8 recognition by Google Sheets / Excel
    downloadFile('\uFEFF' + lines.join('\n'), `sales_${period}_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8')
    setExportOpen(false)
  }

  const handleExportTXT = () => {
    const rows = exportRows()
    const lines: string[] = []
    lines.push('═══════════════════════════════════════════')
    lines.push(`  ОТЧЁТ ПО ПРОДАЖАМ — ${periodLabel[period]}`)
    lines.push(`  Сформирован: ${fmtDate(new Date().toISOString())}`)
    lines.push('═══════════════════════════════════════════')
    lines.push('')
    rows.forEach((r) => {
      lines.push(`#${r.n}  Заказ ${r.orderId}${r.orderNum ? ` (№${r.orderNum})` : ''}`)
      lines.push(`  Дата:        ${r.date}`)
      if (r.paidAt) lines.push(`  Оплачен:     ${r.paidAt}`)
      lines.push(`  Покупатель:  @${r.buyer} (UID: ${r.uid})`)
      lines.push(`  Товар:       ${r.product}`)
      lines.push(`  Кол-во:      ${r.qty}`)
      lines.push(`  Сумма:       $${r.price}`)
      lines.push(`  Статус:      ${r.status}`)
      if (r.provider) lines.push(`  Оплата:      ${r.provider}`)
      if (r.txid)     lines.push(`  TxID:        ${r.txid}`)
      lines.push('-------------------------------------------')
    })
    lines.push('')
    lines.push(`ВСЕГО ЗАКАЗОВ: ${cur.length}`)
    lines.push(`ОБЩАЯ СУММА:   $${sumCur.toFixed(2)}`)
    lines.push('═══════════════════════════════════════════')
    downloadFile(lines.join('\n'), `sales_${period}_${new Date().toISOString().slice(0,10)}.txt`, 'text/plain;charset=utf-8')
    setExportOpen(false)
  }

  return (
    <PageTransition>
      <div className="page adm2-page">
        {/* hero */}
        <motion.div
          className="adm2-hero"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
        >
          <div>
            <div className="adm2-hero-eyebrow">Панель управления</div>
            <div className="adm2-hero-title">
              Привет, <span>админ</span>
            </div>
            <div className="adm2-hero-sub">
              {cur.length} {cur.length === 1 ? 'продажа' : 'продаж'} · ${sumCur.toFixed(0)} за {periodLabel[period].toLowerCase()}
            </div>
          </div>

          <div className="adm2-segment">
            {(['today', 'week', 'month', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                className={`adm2-seg-btn${period === p ? ' is-active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {period === p && (
                  <motion.span className="adm2-seg-pill" layoutId="seg-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }} />
                )}
                <span style={{ position: 'relative' }}>{periodLabel[p]}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* export sales */}
        <div style={{ position: 'relative', marginTop: 12 }}>
          <button
            onClick={() => setExportOpen((v) => !v)}
            disabled={cur.length === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 12,
              background: 'rgba(57,255,99,0.10)',
              border: '1px solid rgba(57,255,99,0.28)',
              color: '#39ff63', fontWeight: 700, fontSize: 13,
              cursor: cur.length === 0 ? 'not-allowed' : 'pointer',
              opacity: cur.length === 0 ? 0.45 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            <Ic.dl />
            <span>Скачать продажи · {periodLabel[period]} ({cur.length})</span>
          </button>
          <AnimatePresence>
            {exportOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20,
                  background: 'rgba(20,22,26,0.98)',
                  border: '1px solid rgba(57,255,99,0.25)',
                  borderRadius: 12, padding: 6, minWidth: 220,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                }}
              >
                <button
                  className="adm2-att-row"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={handleExportCSV}
                >
                  <div className="adm2-att-dot" style={{ background: '#39ff63' }} />
                  <div className="adm2-att-body">
                    <div className="t-sm fw-bold">Google Таблицы (CSV)</div>
                    <div className="t-xs t-muted">Откроется в Google Sheets / Excel</div>
                  </div>
                </button>
                <button
                  className="adm2-att-row"
                  style={{ width: '100%', textAlign: 'left', marginTop: 4 }}
                  onClick={handleExportTXT}
                >
                    <div className="adm2-att-dot" style={{ background: '#9788c4' }} />
                  <div className="adm2-att-body">
                    <div className="t-sm fw-bold">Текстовый файл (.txt)</div>
                    <div className="t-xs t-muted">Простой читаемый отчёт</div>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* KPI grid */}
        <div className="adm2-kpi-grid mb-4">
          <KpiCard Icon={Ic.rev}     value={`$${sumCur.toFixed(0)}`} label={t('admin_revenue')}      accent="57,255,99"   delta={period === 'all' ? undefined : revDelta}    spark={revSpark} delay={0}    />
          <KpiCard Icon={Ic.box}     value={String(cur.length)}      label={t('admin_total_orders')} accent="151,136,196" delta={period === 'all' ? undefined : ordersDelta} spark={ordSpark} delay={0.05} />
          <KpiCard Icon={Ic.users}   value={String(uniqueUsers)}     label={t('admin_total_users')}  accent="111,154,184" delay={0.10} />
          <KpiCard Icon={Ic.pending} value={String(pendingCount)}    label={t('admin_pending')}      accent="224,115,74"  delay={0.15} />
        </div>

        {/* attention */}
        <AnimatePresence>
          {(pendingCount + openTickets + pendingRefW) > 0 && (
            <motion.div
              className="adm2-attention"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="section-title mb-2">⚡ Требует внимания</div>
              <div className="col gap-2">
                {pendingCount > 0 && (
                  <button className="adm2-att-row" onClick={() => navigate('/admin/orders')}>
                    <div className="adm2-att-dot" style={{ background: 'var(--orange)' }} />
                    <div className="adm2-att-body">
                      <div className="t-sm fw-bold">{pendingCount} {pendingCount === 1 ? 'заказ ждёт' : 'заказов ждут'} подтверждения оплаты</div>
                      <div className="t-xs t-muted">Перейти к заказам</div>
                    </div>
                    <Ic.arrow />
                  </button>
                )}
                {openTickets > 0 && (
                  <button className="adm2-att-row" onClick={() => navigate('/admin/support')}>
                    <div className="adm2-att-dot" style={{ background: 'var(--green)' }} />
                    <div className="adm2-att-body">
                      <div className="t-sm fw-bold">{openTickets} {openTickets === 1 ? 'открытое обращение' : 'открытых обращений'}</div>
                      <div className="t-xs t-muted">Ответить пользователям</div>
                    </div>
                    <Ic.arrow />
                  </button>
                )}
                {pendingRefW > 0 && (
                  <button className="adm2-att-row" onClick={() => navigate('/admin/referrals')}>
                    <div className="adm2-att-dot" style={{ background: 'var(--cyan)' }} />
                    <div className="adm2-att-body">
                      <div className="t-sm fw-bold">{pendingRefW} реф. выводов в обработке</div>
                      <div className="t-xs t-muted">Обработать выплаты</div>
                    </div>
                    <Ic.arrow />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* quick actions */}
        <div className="section-title mt-4 mb-3">{t('admin_quick')}</div>
        <div className="adm2-quick">
          {[
            { label: 'Заказы',       to: '/admin/orders',    accent: '151,136,196' },
            { label: 'Товары',       to: '/admin/products',  accent: '224,115,74'  },
            { label: 'Пользователи', to: '/admin/users',     accent: '57,255,99' },
            { label: 'Рассылка',     to: '/admin/broadcast', accent: '192,138,159' },
            { label: 'Реф. выводы',  to: '/admin/referrals', accent: '111,154,184' },
            { label: 'Пополнения',   to: '/admin/deposits',  accent: '57,255,99'   },
            { label: 'Настройки',    to: '/admin/settings',  accent: '118,163,116' },
          ].map((q, i) => (
            <motion.button
              key={q.to}
              className="adm2-quick-btn"
              style={{ ['--qa' as never]: q.accent }}
              onClick={() => navigate(q.to)}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + i * 0.03 }}
              whileTap={{ scale: 0.96 }}
            >
              {q.label}
            </motion.button>
          ))}
        </div>

        {/* top products */}
        {topProducts.length > 0 && (
          <>
            <div className="section-title mt-5 mb-3">🔥 Топ товары</div>
            <div className="col gap-2 mb-4">
              {topProducts.map((p, i) => {
                const max = topProducts[0].revenue
                const pct = (p.revenue / max) * 100
                return (
                  <motion.div
                    key={p.title}
                    className="adm2-top-row"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="adm2-top-rank">#{i + 1}</div>
                    <div className="adm2-top-body">
                      <div className="t-sm fw-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div className="adm2-top-bar"><div style={{ width: `${pct}%` }} /></div>
                    </div>
                    <div className="adm2-top-val">
                      <div className="t-sm fw-black">${p.revenue.toFixed(0)}</div>
                      <div className="t-xs t-muted">{p.count} шт</div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}

        {/* recent activity */}
        <div className="section-title mb-3">{t('admin_recent_activity')}</div>
        <div className="col gap-2">
          {recent.length === 0 && (
            <div className="t-xs t-muted text-center" style={{ padding: 20 }}>{t('admin_no_logs')}</div>
          )}
          {recent.map((log, i) => (
            <motion.div
              key={log.id}
              className="adm2-log"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className={`adm2-log-ic ${log.status === 'success' ? 'ok' : 'bad'}`}>
                {log.status === 'success'
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-sm fw-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  @{log.username} · {log.kind === 'buy' ? log.product ?? 'Покупка' : 'Депозит'}
                </div>
                <div className="t-xs t-muted">{new Date(log.ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="t-sm fw-black" style={{ color: log.kind === 'deposit' ? 'var(--green)' : 'var(--t-primary)' }}>
                {log.kind === 'deposit' ? '+' : ''}${log.amount.toFixed(2)}
              </div>
            </motion.div>
          ))}
        </div>

        <div style={{ height: 12 }} />
      </div>
    </PageTransition>
  )
}
