import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import type { PaymentLog } from '../store/types'

type LogFilter = 'all' | 'success' | 'failed'

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

function toCSV(logs: PaymentLog[]): string {
  const headers = ['id', 'timestamp', 'uid', 'username', 'kind', 'amount', 'network', 'status', 'tx_hash', 'product']
  const rows = logs.map((l) => [
    l.id, l.ts, l.uid, l.username, l.kind, l.amount.toFixed(2),
    l.network ?? '', l.status, l.tx_hash ?? '', (l.product ?? '').replace(/,/g, ' '),
  ].join(','))
  return [headers.join(','), ...rows].join('\n')
}

export default function AdminLogs() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const logs = useStore((s) => s.logs)
  const toast = useToast()
  const [filter, setFilter] = useState<LogFilter>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return logs
    return logs.filter((l) => l.status === filter || (filter === 'failed' && l.status === 'expired'))
  }, [logs, filter])

  const exportCSV = () => {
    downloadFile(`payment-logs-${Date.now()}.csv`, toCSV(filtered), 'text/csv')
    toast.show('CSV ' + (lang === 'ru' ? 'скачан' : 'downloaded'), 'success')
  }

  const exportJSON = () => {
    downloadFile(`payment-logs-${Date.now()}.json`, JSON.stringify(filtered, null, 2), 'application/json')
    toast.show('JSON ' + (lang === 'ru' ? 'скачан' : 'downloaded'), 'success')
  }

  return (
    <PageTransition>
      <div className="page">
        {/* Filters */}
        <div className="chip-row mb-4">
          {(['all', 'success', 'failed'] as LogFilter[]).map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' && t('admin_log_all')}
              {f === 'success' && t('admin_log_success')}
              {f === 'failed' && t('admin_log_failed')}
            </button>
          ))}
        </div>

        {/* Export */}
        <div className="row gap-2 mb-5">
          <motion.button
            className="btn btn-secondary btn-sm"
            style={{ flex: 1 }}
            onClick={exportCSV}
            whileTap={{ scale: 0.97 }}
          >
            📄 {t('admin_export_csv')}
          </motion.button>
          <motion.button
            className="btn btn-secondary btn-sm"
            style={{ flex: 1 }}
            onClick={exportJSON}
            whileTap={{ scale: 0.97 }}
          >
            🗂 {t('admin_export_json')}
          </motion.button>
        </div>

        {/* Logs */}
        <div className="col gap-2">
          {filtered.map((log, i) => {
            const ok = log.status === 'success'
            return (
              <motion.div
                key={log.id}
                className="card"
                style={{ padding: '12px 14px' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
              >
                <div className="row gap-3 mb-1">
                  <span style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: ok ? 'var(--green)' : 'var(--red)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, flexShrink: 0,
                  }}>
                    {ok ? '✓' : '✕'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-sm fw-bold">
                      @{log.username} · {log.kind === 'buy' ? log.product ?? 'Buy' : 'Deposit'}
                    </div>
                    <div className="t-xs t-muted">
                      {new Date(log.ts).toLocaleString()} · UID {log.uid}
                    </div>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end' }}>
                    <div className="t-sm fw-black" style={{ color: log.kind === 'deposit' ? 'var(--green)' : 'var(--t-primary)' }}>
                      {log.kind === 'deposit' ? '+' : ''}${log.amount.toFixed(2)}
                    </div>
                    {log.network && (
                      <div className="t-xs t-muted" style={{ textTransform: 'uppercase' }}>{log.network}</div>
                    )}
                  </div>
                </div>
                {log.tx_hash && (
                  <div className="t-xs t-muted" style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 4 }}>
                    tx: {log.tx_hash}
                  </div>
                )}
              </motion.div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center t-muted" style={{ padding: 40 }}>
              {t('admin_no_logs')}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
