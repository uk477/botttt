import { useMemo, useEffect, useState } from 'react'
import { useStore } from '../store'
import { api } from '../store/api'
import PageTransition from '../components/PageTransition'
import { AdminSegmented, AdminEmpty, AdminStat } from './ui'
import { isRealPaidBuy } from '../utils/orderFilters'

type Period = 'today' | 'week' | 'month' | 'all'

function withinPeriod(ts: string, p: Period) {
  if (p === 'all') return true
  const diff = Date.now() - new Date(ts).getTime()
  const day = 86_400_000
  if (p === 'today') return diff < day
  if (p === 'week') return diff < 7 * day
  return diff < 30 * day
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function AdminSales() {
  const lang = useStore((s) => s.lang)
  const orders = useStore((s) => s.orders)
  const adminUserByUid = useStore((s) => s.adminUserByUid)
  const syncAdminData = useStore((s) => s.syncAdminData)
  const [period, setPeriod] = useState<Period>('month')
  const [syncing, setSyncing] = useState(false)

  const refresh = async () => {
    setSyncing(true)
    await syncAdminData()
    setSyncing(false)
  }

  useEffect(() => {
    void refresh()
    if (!api.isEnabled()) return
    const id = window.setInterval(() => void refresh(), 25_000)
    return () => window.clearInterval(id)
  }, [])

  const paidBuys = useMemo(
    () => orders.filter(isRealPaidBuy).filter((o) => withinPeriod(o.created, period)),
    [orders, period],
  )

  const total = paidBuys.reduce((s, o) => s + o.amount, 0)

  const periodLabels: { id: Period; label: string }[] = [
    { id: 'today', label: lang === 'ru' ? 'Сегодня' : 'Today' },
    { id: 'week', label: lang === 'ru' ? 'Неделя' : 'Week' },
    { id: 'month', label: lang === 'ru' ? 'Месяц' : 'Month' },
    { id: 'all', label: lang === 'ru' ? 'Всё' : 'All' },
  ]

  return (
    <PageTransition>
      <div className="adm-page">
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
          {lang === 'ru'
            ? 'Только оплаченные покупки лотов (крипта подтверждена или списание с баланса). Без «ожидания» и без незавершённых счетов.'
            : 'Paid lot purchases only (crypto confirmed or balance debit). No pending or abandoned checkouts.'}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            disabled={syncing}
            onClick={() => void refresh()}
          >
            {syncing
              ? (lang === 'ru' ? 'Обновление…' : 'Refreshing…')
              : (lang === 'ru' ? 'Обновить' : 'Refresh')}
          </button>
        </div>

        <AdminSegmented options={periodLabels} value={period} onChange={setPeriod} />

        <div className="adm-stats" style={{ marginTop: 16, marginBottom: 16 }}>
          <AdminStat label={lang === 'ru' ? 'Продаж' : 'Sales'} value={String(paidBuys.length)} />
          <AdminStat label={lang === 'ru' ? 'Сумма' : 'Total'} value={`$${total.toFixed(2)}`} />
        </div>

        {paidBuys.length === 0 ? (
          <AdminEmpty>
            {lang === 'ru' ? 'Нет оплаченных покупок за период.' : 'No paid purchases in this period.'}
          </AdminEmpty>
        ) : (
          paidBuys.map((o) => {
            const uid = o.uid ?? 0
            const u = uid ? adminUserByUid[uid] : undefined
            const who = u?.username ? `@${u.username}` : u?.full_name || (uid ? `UID ${uid}` : '—')
            return (
              <div key={o.id} className="adm-log" style={{ marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {o.product_title || (lang === 'ru' ? 'Покупка' : 'Purchase')} · {who}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--adm-muted)', marginTop: 2 }}>
                    {fmt(o.created)} · {o.status === 'completed' ? '✓ выдан' : 'оплачен'} · #{o.id.slice(-8)}
                  </div>
                  {o.txid && (
                    <div style={{ fontSize: 10, color: 'var(--adm-muted)', marginTop: 2, wordBreak: 'break-all' }}>
                      TX: {o.txid.slice(0, 24)}…
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--adm-accent)' }}>
                  ${o.amount.toFixed(2)}
                </div>
              </div>
            )
          })
        )}
      </div>
    </PageTransition>
  )
}
