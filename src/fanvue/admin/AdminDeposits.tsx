import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import PageTransition from '../components/PageTransition'
import { AdminSegmented, AdminStat, AdminEmpty } from './ui'

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
  const lang   = useStore((s) => s.lang)
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

  const periodOpts = [
    { id: 'today' as Period, label: lang === 'ru' ? 'Сегодня' : 'Today' },
    { id: 'week' as Period, label: lang === 'ru' ? 'Неделя' : 'Week' },
    { id: 'month' as Period, label: lang === 'ru' ? 'Месяц' : 'Month' },
    { id: 'all' as Period, label: lang === 'ru' ? 'Всё' : 'All' },
  ]
  const filterOpts = (['all', 'success', 'pending', 'failed', 'expired'] as Filter[]).map((f) => ({
    id: f,
    label: filterLabel[f],
  }))

  return (
    <PageTransition>
      <div className="adm-page">
        <div className="adm-stats" style={{ marginBottom: 12 }}>
          <AdminStat label={lang === 'ru' ? 'Успешных' : 'Success'} value={String(countSuccess)} hint={`$${sumSuccess.toFixed(0)}`} />
          <AdminStat label={lang === 'ru' ? 'Ожидание' : 'Pending'} value={String(countPending)} />
        </div>

        <AdminSegmented options={periodOpts} value={period} onChange={setPeriod} />
        <div style={{ marginTop: 8 }}>
          <AdminSegmented options={filterOpts} value={filter} onChange={setFilter} />
        </div>

        <div style={{ position: 'relative', marginTop: 14 }}>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={() => setExportOpen((v) => !v)}
            disabled={list.length === 0}
            style={{ opacity: list.length === 0 ? 0.45 : 1 }}
          >
            <Ic.dl />
            {lang === 'ru' ? 'Скачать' : 'Export'} ({list.length})
          </button>
          <AnimatePresence>
            {exportOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="adm-card"
                style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, minWidth: 220, padding: 6 }}
              >
                <button type="button" className="adm-task" onClick={handleCSV}>
                  <span className="adm-task-dot" style={{ background: 'var(--adm-accent)' }} />
                  <div className="adm-task-meta">
                    <div className="adm-task-title">CSV</div>
                    <div className="adm-task-sub">Google Sheets / Excel</div>
                  </div>
                </button>
                <button type="button" className="adm-task" style={{ marginTop: 6 }} onClick={handleTXT}>
                  <span className="adm-task-dot" style={{ background: 'var(--adm-warn)' }} />
                  <div className="adm-task-meta">
                    <div className="adm-task-title">TXT</div>
                    <div className="adm-task-sub">{lang === 'ru' ? 'Текстовый отчёт' : 'Text report'}</div>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ marginTop: 14 }}>
          {list.length === 0 && (
            <AdminEmpty>{lang === 'ru' ? 'Нет пополнений' : 'No deposits'}</AdminEmpty>
          )}
          {list.map((d, i) => (
            <motion.div
              key={d.id}
              className="adm-log"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
            >
              <span className="adm-task-dot" style={{ background: STATUS_COLOR[d.status] ?? '#888' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{d.username} · ${d.amount.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--adm-muted)', marginTop: 2 }}>
                  {d.network ? NETWORK_LABEL[d.network] ?? d.network : '—'} · {fmtDate(d.ts)}
                </div>
                {d.tx_hash && (
                  <div style={{ fontSize: 10, color: 'var(--adm-dim)', fontFamily: 'monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.tx_hash}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[d.status], whiteSpace: 'nowrap' }}>
                {STATUS_LABEL[d.status] ?? d.status}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}