import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import PageTransition from '../components/PageTransition'

type Filter = 'all' | 'success' | 'pending' | 'failed' | 'expired'
type Period = 'today' | 'week' | 'month' | 'all'

const Ic = {
  dl: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
}

const NETWORK_LABEL: Record<string, string> = {
  trc20: 'USDT TRC20', erc20: 'USDT ERC20', bep20: 'USDT BEP20',
  eth: 'ETH', sol: 'SOL', btc: 'BTC', ton: 'TON', usdc_eth: 'USDC ERC20', usdc_sol: 'USDC SOL',
}

const STATUS_LABEL: Record<string, string> = {
  success: 'Успешный', pending: 'Ожидание', failed: 'Отменён', expired: 'Истёк',
}
const STATUS_COLOR: Record<string, string> = {
  success: '#39ff63', pending: '#e8c98c', failed: '#e0734a', expired: '#9788c4',
}

function withinPeriod(ts: string, p: Period) {
  if (p === 'all') return true
  const diff = Date.now() - new Date(ts).getTime()
  const day = 86_400_000
  if (p === 'today') return diff < day
  if (p === 'week')  return diff < 7 * day
  return diff < 30 * day
}

const fmtDate = (ts: string) =>
  new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const downloadFile = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function AdminDeposits() {
  const logs   = useStore((s) => s.logs)
  const orders = useStore((s) => s.orders)
  const user   = useStore((s) => s.user)

  const [period, setPeriod] = useState<Period>('all')
  const [filter, setFilter] = useState<Filter>('all')
  const [exportOpen, setExportOpen] = useState(false)

  /* unified deposits: orders (live) + payment logs (mock/history) */
  type Dep = {
    id: string
    ts: string
    username: string
    uid: number | string
    amount: number
    network?: string
    status: 'success' | 'pending' | 'failed' | 'expired'
    tx_hash?: string
  }

  const deposits = useMemo<Dep[]>(() => {
    const fromOrders: Dep[] = orders
      .filter((o) => o.kind === 'deposit')
      .map((o) => ({
        id: o.id,
        ts: o.created,
        username: user?.username ?? user?.full_name ?? 'guest',
        uid: user?.uid ?? '—',
        amount: o.amount,
        network: o.provider,
        status:
          o.status === 'paid' || o.status === 'completed' ? 'success' :
          o.status === 'failed' ? 'failed' :
          o.status === 'expired' ? 'expired' : 'pending',
        tx_hash: o.txid,
      }))

    const fromLogs: Dep[] = logs
      .filter((l) => l.kind === 'deposit')
      .map((l) => ({
        id: `LOG-${l.id}`,
        ts: l.ts,
        username: l.username,
        uid: l.uid,
        amount: l.amount,
        network: l.network,
        status: l.status,
        tx_hash: l.tx_hash,
      }))

    return [...fromOrders, ...fromLogs]
      .filter((d) => withinPeriod(d.ts, period))
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  }, [orders, logs, user, period])

  const list = useMemo(
    () => filter === 'all' ? deposits : deposits.filter((d) => d.status === filter),
    [deposits, filter],
  )

  const sumSuccess = deposits.filter((d) => d.status === 'success').reduce((s, d) => s + d.amount, 0)
  const countSuccess = deposits.filter((d) => d.status === 'success').length
  const countPending = deposits.filter((d) => d.status === 'pending').length
  const countFailed  = deposits.filter((d) => d.status === 'failed').length
  const countExpired = deposits.filter((d) => d.status === 'expired').length

  const periodLabel: Record<Period, string> = {
    today: 'Сегодня', week: 'Неделя', month: 'Месяц', all: 'Всё время',
  }
  const filterLabel: Record<Filter, string> = {
    all: 'Все', success: 'Успешные', pending: 'Ожидание', failed: 'Отменённые', expired: 'Истёкшие',
  }

  const exportRows = () => list.map((d, i) => ({
    n: i + 1,
    id: d.id,
    date: fmtDate(d.ts),
    username: d.username,
    uid: d.uid,
    amount: d.amount.toFixed(2),
    currency: d.network ? NETWORK_LABEL[d.network] ?? d.network : '—',
    status: STATUS_LABEL[d.status] ?? d.status,
    tx: d.tx_hash ?? '',
  }))

  const handleCSV = () => {
    const rows = exportRows()
    const headers = ['№','ID','Дата','Пользователь','UID','Сумма ($)','Валюта/Сеть','Статус','TxHash']
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [headers.join(';')]
    for (const r of rows) lines.push([r.n, r.id, r.date, r.username, r.uid, r.amount, r.currency, r.status, r.tx].map(esc).join(';'))
    const totalSum = list.filter((d) => d.status === 'success').reduce((s, d) => s + d.amount, 0)
    lines.push('')
    lines.push(['','','','','','ИТОГО успешных:', list.filter((d) => d.status === 'success').length, totalSum.toFixed(2)].map(esc).join(';'))
    downloadFile('\uFEFF' + lines.join('\n'), `deposits_${filter}_${period}_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8')
    setExportOpen(false)
  }

  const handleTXT = () => {
    const rows = exportRows()
    const out: string[] = []
    out.push('═══════════════════════════════════════════')
    out.push(`  ОТЧЁТ ПО ПОПОЛНЕНИЯМ`)
    out.push(`  Период: ${periodLabel[period]} · Фильтр: ${filterLabel[filter]}`)
    out.push(`  Сформирован: ${fmtDate(new Date().toISOString())}`)
    out.push('═══════════════════════════════════════════')
    out.push('')
    rows.forEach((r) => {
      out.push(`#${r.n}  ID ${r.id}`)
      out.push(`  Дата:        ${r.date}`)
      out.push(`  Пользователь:@${r.username} (UID: ${r.uid})`)
      out.push(`  Сумма:       $${r.amount}`)
      out.push(`  Валюта:      ${r.currency}`)
      out.push(`  Статус:      ${r.status}`)
      if (r.tx) out.push(`  TxHash:      ${r.tx}`)
      out.push('-------------------------------------------')
    })
    const totalSum = list.filter((d) => d.status === 'success').reduce((s, d) => s + d.amount, 0)
    out.push('')
    out.push(`ВСЕГО ЗАПИСЕЙ:        ${list.length}`)
    out.push(`УСПЕШНЫХ:             ${list.filter((d) => d.status === 'success').length}`)
    out.push(`СУММА УСПЕШНЫХ:       $${totalSum.toFixed(2)}`)
    out.push('═══════════════════════════════════════════')
    downloadFile(out.join('\n'), `deposits_${filter}_${period}_${new Date().toISOString().slice(0,10)}.txt`, 'text/plain;charset=utf-8')
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
            <div className="adm2-hero-eyebrow">История</div>
            <div className="adm2-hero-title">Пополнения</div>
            <div className="adm2-hero-sub">
              {countSuccess} успешных · ${sumSuccess.toFixed(0)} · {countPending} в ожидании · {countFailed} отменено · {countExpired} истекло
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
                  <motion.span className="adm2-seg-pill" layoutId="dep-period-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }} />
                )}
                <span style={{ position: 'relative' }}>{p === 'today' ? 'Сегодня' : p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Всё'}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* status filter */}
        <div className="adm2-segment" style={{ marginTop: 12 }}>
          {(['all', 'success', 'pending', 'failed', 'expired'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`adm2-seg-btn${filter === f ? ' is-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {filter === f && (
                <motion.span className="adm2-seg-pill" layoutId="dep-filter-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }} />
              )}
              <span style={{ position: 'relative' }}>{filterLabel[f]}</span>
            </button>
          ))}
        </div>

        {/* export */}
        <div style={{ position: 'relative', marginTop: 12 }}>
          <button
            onClick={() => setExportOpen((v) => !v)}
            disabled={list.length === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 12,
              background: 'rgba(57,255,99,0.10)',
              border: '1px solid rgba(57,255,99,0.28)',
              color: '#39ff63', fontWeight: 700, fontSize: 13,
              cursor: list.length === 0 ? 'not-allowed' : 'pointer',
              opacity: list.length === 0 ? 0.45 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            <Ic.dl />
            <span>Скачать ({list.length})</span>
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
                <button className="adm2-att-row" style={{ width: '100%', textAlign: 'left' }} onClick={handleCSV}>
                  <div className="adm2-att-dot" style={{ background: '#39ff63' }} />
                  <div className="adm2-att-body">
                    <div className="t-sm fw-bold">Google Таблицы (CSV)</div>
                    <div className="t-xs t-muted">Откроется в Google Sheets / Excel</div>
                  </div>
                </button>
                <button className="adm2-att-row" style={{ width: '100%', textAlign: 'left', marginTop: 4 }} onClick={handleTXT}>
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

        {/* list */}
        <div className="col gap-2" style={{ marginTop: 16 }}>
          {list.length === 0 && (
            <div className="t-xs t-muted text-center" style={{ padding: 24 }}>Нет пополнений</div>
          )}
          {list.map((d, i) => (
            <motion.div
              key={d.id}
              className="adm2-att-row"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
            >
              <div className="adm2-att-dot" style={{ background: STATUS_COLOR[d.status] ?? '#888' }} />
              <div className="adm2-att-body" style={{ minWidth: 0 }}>
                <div className="t-sm fw-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  @{d.username} · ${d.amount.toFixed(2)}
                </div>
                <div className="t-xs t-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.network ? NETWORK_LABEL[d.network] ?? d.network : '—'} · {fmtDate(d.ts)}
                </div>
                {d.tx_hash && (
                  <div className="t-xs t-muted" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.tx_hash}
                  </div>
                )}
              </div>
              <div className="t-xs fw-bold" style={{ color: STATUS_COLOR[d.status], whiteSpace: 'nowrap' }}>
                {STATUS_LABEL[d.status] ?? d.status}
              </div>
            </motion.div>
          ))}
        </div>

        <div style={{ height: 20 }} />
      </div>
    </PageTransition>
  )
}