import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { useT } from '../i18n'
import PageTransition from '../components/PageTransition'
import { api } from '../store/api'
import {
  AdminSection,
  AdminStat,
  AdminSegmented,
  AdminTask,
  AdminCard,
  AdminToggle,
  AdminEmpty,
} from './ui'

type Period = 'today' | 'week' | 'month' | 'all'

function withinPeriod(ts: string, period: Period) {
  if (period === 'all') return true
  const d = new Date(ts).getTime()
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  if (period === 'today') return now - d < day
  if (period === 'week') return now - d < 7 * day
  return now - d < 30 * day
}

function prevPeriod(ts: string, period: Period) {
  if (period === 'all') return false
  const d = new Date(ts).getTime()
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const span = period === 'today' ? day : period === 'week' ? 7 * day : 30 * day
  return now - d >= span && now - d < 2 * span
}

const QUICK = [
  { label: 'Заказы', path: '/admin/orders' },
  { label: 'Товары', path: '/admin/products' },
  { label: 'Клиенты', path: '/admin/users' },
  { label: 'Чат', path: '/admin/support' },
  { label: 'Рассылка', path: '/admin/broadcast' },
  { label: 'Настройки', path: '/admin/settings' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const lang = useStore((s) => s.lang)
  const orders = useStore((s) => s.orders)
  const logs = useStore((s) => s.logs)
  const tickets = useStore((s) => s.supportTickets)
  const supportMessages = useStore((s) => s.supportMessages)
  const refW = useStore((s) => s.refWithdrawals)
  const maintenance = useStore((s) => s.maintenance)
  const toggleMaintenance = useStore((s) => s.toggleMaintenance)
  const syncAdminData = useStore((s) => s.syncAdminData)

  const [period, setPeriod] = useState<Period>('today')
  const [totalUsers, setTotalUsers] = useState<number | null>(null)
  const [pendingServer, setPendingServer] = useState<number | null>(null)

  useEffect(() => {
    syncAdminData()
    if (api.isEnabled()) {
      api.adminStats().then((res) => {
        if (res && typeof res === 'object') {
          const r = res as { totalUsers?: number; pendingOrders?: number; logs?: unknown }
          if (r.totalUsers != null) setTotalUsers(Number(r.totalUsers))
          if (r.pendingOrders != null) setPendingServer(Number(r.pendingOrders))
          if (Array.isArray(r.logs)) useStore.setState({ logs: r.logs as typeof logs })
        }
      })
    }
  }, [syncAdminData])

  const buys = useMemo(
    () => orders.filter((o) => o.kind === 'buy' && (o.status === 'completed' || o.status === 'paid')),
    [orders],
  )
  const cur = buys.filter((o) => withinPeriod(o.created, period))
  const prv = buys.filter((o) => prevPeriod(o.created, period))
  const sumCur = cur.reduce((s, o) => s + o.amount, 0)
  const sumPrv = prv.reduce((s, o) => s + o.amount, 0)
  const revDelta = sumPrv === 0 ? (sumCur > 0 ? 100 : 0) : ((sumCur - sumPrv) / sumPrv) * 100

  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const uniqueUsers = totalUsers ?? new Set(logs.map((l) => l.uid)).size

  const openTickets = tickets.filter((tk) => {
    if (tk.status === 'closed') return false
    const ticketMsgs = supportMessages.filter(
      (m) => m.ticket_id === tk.id && (m.kind === 'text' || m.kind === 'image' || m.kind === 'file' || !m.kind),
    )
    return !ticketMsgs.some((m) => m.sender === 'admin') || ticketMsgs.some((m) => m.sender === 'user' && !m.read_by_admin)
  }).length
  const pendingRefW = refW.filter((w) => w.status === 'pending').length

  const periodLabels: { id: Period; label: string }[] = [
    { id: 'today', label: lang === 'ru' ? 'Сегодня' : 'Today' },
    { id: 'week', label: lang === 'ru' ? 'Неделя' : 'Week' },
    { id: 'month', label: lang === 'ru' ? 'Месяц' : 'Month' },
    { id: 'all', label: lang === 'ru' ? 'Всё' : 'All' },
  ]

  const recent = logs.slice(0, 8)
  const attention = pendingCount + openTickets + pendingRefW

  const downloadSales = () => {
    const rows = cur.map((o, i) =>
      [i + 1, o.id, o.amount.toFixed(2), o.status, o.created].join(';'),
    )
    const blob = new Blob(['\uFEFF' + '№;ID;Сумма;Статус;Дата\n' + rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sales_${period}.csv`
    a.click()
  }

  return (
    <PageTransition>
      <div className="adm-page">
        <AdminSection>
          <AdminCard>
            <AdminToggle
              on={maintenance}
              onToggle={toggleMaintenance}
              label={maintenance ? (lang === 'ru' ? 'Магазин закрыт' : 'Shop closed') : (lang === 'ru' ? 'Магазин открыт' : 'Shop open')}
              description={
                maintenance
                  ? (lang === 'ru' ? 'Покупатели видят экран техработ' : 'Buyers see maintenance screen')
                  : (lang === 'ru' ? 'Покупки доступны' : 'Purchases enabled')
              }
            />
          </AdminCard>
        </AdminSection>

        <AdminSection label={lang === 'ru' ? 'Период' : 'Period'}>
          <AdminSegmented options={periodLabels} value={period} onChange={setPeriod} />
        </AdminSection>

        <AdminSection label={lang === 'ru' ? 'Показатели' : 'Metrics'}>
          <div className="adm-stats">
            <AdminStat
              label={lang === 'ru' ? 'Выручка' : 'Revenue'}
              value={`$${sumCur.toFixed(0)}`}
              trend={period !== 'all' ? { pct: revDelta } : undefined}
            />
            <AdminStat
              label={lang === 'ru' ? 'Продажи' : 'Sales'}
              value={String(cur.length)}
              hint={lang === 'ru' ? 'оплаченных заказов' : 'paid orders'}
            />
            <AdminStat label={lang === 'ru' ? 'Клиенты' : 'Clients'} value={String(uniqueUsers)} />
            <AdminStat
              label={lang === 'ru' ? 'В ожидании' : 'Pending'}
              value={String(pendingServer ?? pendingCount)}
              hint={lang === 'ru' ? 'неподтверждённых' : 'unconfirmed'}
            />
          </div>
        </AdminSection>

        {attention > 0 && (
          <AdminSection label={lang === 'ru' ? 'Срочно' : 'Urgent'}>
            {pendingCount > 0 && (
              <AdminTask
                title={lang === 'ru' ? 'Подтвердить оплату' : 'Confirm payment'}
                subtitle={`${pendingCount} ${lang === 'ru' ? 'заказов' : 'orders'}`}
                dotColor="#a78bfa"
                onClick={() => navigate('/admin/orders')}
              />
            )}
            {openTickets > 0 && (
              <AdminTask
                title={lang === 'ru' ? 'Ответить в чате' : 'Reply in chat'}
                subtitle={`${openTickets} ${lang === 'ru' ? 'диалогов' : 'chats'}`}
                dotColor="var(--adm-accent)"
                onClick={() => navigate('/admin/support')}
              />
            )}
            {pendingRefW > 0 && (
              <AdminTask
                title={lang === 'ru' ? 'Реф. выводы' : 'Ref withdrawals'}
                subtitle={`${pendingRefW} ${lang === 'ru' ? 'заявок' : 'requests'}`}
                dotColor="var(--adm-warn)"
                onClick={() => navigate('/admin/referrals')}
              />
            )}
          </AdminSection>
        )}

        <AdminSection label={lang === 'ru' ? 'Разделы' : 'Sections'}>
          <div className="adm-grid-3">
            {QUICK.map((q) => (
              <motion.button
                key={q.path}
                type="button"
                className="adm-grid-btn"
                onClick={() => navigate(q.path)}
                whileTap={{ scale: 0.97 }}
              >
                {q.label}
              </motion.button>
            ))}
          </div>
        </AdminSection>

        <AdminSection
          label={lang === 'ru' ? 'Экспорт' : 'Export'}
        >
          <div className="adm-btn-row">
            <button type="button" className="adm-btn adm-btn--primary" onClick={downloadSales} disabled={cur.length === 0}>
              {lang === 'ru' ? 'Скачать продажи CSV' : 'Download sales CSV'}
            </button>
            <button type="button" className="adm-btn" onClick={() => navigate('/admin/logs')}>
              {lang === 'ru' ? 'Все логи' : 'All logs'}
            </button>
          </div>
        </AdminSection>

        <AdminSection label={lang === 'ru' ? 'Последние оплаты' : 'Recent payments'}>
          {recent.length === 0 ? (
            <AdminEmpty>
              {lang === 'ru' ? 'Пока нет оплат за выбранный период.' : 'No payments for this period yet.'}
            </AdminEmpty>
          ) : (
            recent.map((log) => (
              <div key={log.id} className="adm-log">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    @{log.username || '—'} · {log.kind === 'buy' ? log.product ?? 'Buy' : 'Deposit'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--adm-muted)', marginTop: 2 }}>
                    {new Date(log.ts).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: log.status === 'success' ? 'var(--adm-accent)' : 'var(--adm-danger)' }}>
                  {log.kind === 'deposit' ? '+' : ''}${log.amount.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </AdminSection>
      </div>
    </PageTransition>
  )
}
