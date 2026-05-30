import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import type { PaymentLog } from '../store/types'
import { api } from '../store/api'
import { AdminSegmented, AdminEmpty } from './ui'

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
  const syncAdminData = useStore((s) => s.syncAdminData)
  const toast = useToast()
  const [filter, setFilter] = useState<LogFilter>('all')

  useEffect(() => {
    syncAdminData()
    if (api.isEnabled()) {
      api.adminLogs().then((res) => {
        if (Array.isArray(res)) useStore.setState({ logs: res as PaymentLog[] })
      })
    }
  }, [syncAdminData])

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
      <div className="adm-page">
        <AdminSegmented
          options={([
            { id: 'all' as LogFilter, label: t('admin_log_all') },
            { id: 'success' as LogFilter, label: t('admin_log_success') },
            { id: 'failed' as LogFilter, label: t('admin_log_failed') },
          ])}
          value={filter}
          onChange={setFilter}
        />

        <div className="adm-btn-row" style={{ margin: '12px 0 16px' }}>
          <button type="button" className="adm-btn" style={{ flex: 1 }} onClick={exportCSV}>{t('admin_export_csv')}</button>
          <button type="button" className="adm-btn" style={{ flex: 1 }} onClick={exportJSON}>{t('admin_export_json')}</button>
        </div>

        <div>
          {filtered.map((log, i) => {
            const ok = log.status === 'success'
            return (
              <motion.div
                key={log.id}
                className="adm-log"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
              >
                <span className="adm-task-dot" style={{ background: ok ? 'var(--adm-accent)' : 'var(--adm-danger)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    @{log.username} · {log.kind === 'buy' ? log.product ?? 'Buy' : 'Deposit'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--adm-muted)', marginTop: 2 }}>
                    {new Date(log.ts).toLocaleString()} · UID {log.uid}
                  </div>
                  {log.tx_hash && (
                    <div style={{ fontSize: 10, color: 'var(--adm-dim)', fontFamily: 'monospace', marginTop: 4, wordBreak: 'break-all' }}>
                      {log.tx_hash}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--adm-accent)' }}>
                    {log.kind === 'deposit' ? '+' : ''}${log.amount.toFixed(2)}
                  </div>
                  {log.network && (
                    <div style={{ fontSize: 10, color: 'var(--adm-muted)', textTransform: 'uppercase' }}>{log.network}</div>
                  )}
                </div>
              </motion.div>
            )
          })}
          {filtered.length === 0 && <AdminEmpty>{t('admin_no_logs')}</AdminEmpty>}
        </div>
      </div>
    </PageTransition>
  )
}
