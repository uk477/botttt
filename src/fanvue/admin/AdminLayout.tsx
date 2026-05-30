import { useEffect, useMemo, useState, useCallback } from 'react'
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { useT } from '../i18n'
import { api } from '../store/api'
import './admin.css'
import { AdminEmpty } from './ui'

const I = {
  dash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  orders: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>,
  products: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  support: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  more: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>,
  back: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  refresh: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>,
  close: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
}

const TABS = [
  { path: '/admin', Icon: I.dash, key: 'admin_dashboard' as const },
  { path: '/admin/orders', Icon: I.orders, key: 'admin_orders' as const },
  { path: '/admin/products', Icon: I.products, key: 'admin_products' as const },
  { path: '/admin/support', Icon: I.support, key: 'admin_support' as const },
  { path: '/admin/more', Icon: I.more, key: 'admin_more' as const },
]

const QUICK = [
  { path: '/admin', label: 'Обзор' },
  { path: '/admin/orders', label: 'Заказы' },
  { path: '/admin/deposits', label: 'Пополнения' },
  { path: '/admin/products', label: 'Товары' },
  { path: '/admin/users', label: 'Клиенты' },
  { path: '/admin/support', label: 'Поддержка' },
  { path: '/admin/broadcast', label: 'Рассылка' },
  { path: '/admin/referrals', label: 'Реф. выводы' },
  { path: '/admin/settings', label: 'Кошельки и магазин' },
  { path: '/admin/customize', label: 'Ссылки и тексты' },
  { path: '/admin/photos', label: 'Медиа' },
  { path: '/admin/logs', label: 'Логи оплат' },
]

const ROUTE_TITLE: Record<string, string> = {
  '/admin': 'Обзор',
  '/admin/orders': 'Заказы',
  '/admin/products': 'Товары',
  '/admin/users': 'Клиенты',
  '/admin/support': 'Чат поддержки',
  '/admin/settings': 'Магазин и кошельки',
  '/admin/logs': 'Логи',
  '/admin/broadcast': 'Рассылка',
  '/admin/photos': 'Медиа',
  '/admin/more': 'Ещё',
  '/admin/referrals': 'Реф. выводы',
  '/admin/deposits': 'Пополнения',
  '/admin/customize': 'Контент и ссылки',
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = useStore((s) => s.isAdmin)
  const isAdminCheckDone = useStore((s) => s.isAdminCheckDone)
  const adminOk = useStore((s) => s._adminVerified)
  const maintenance = useStore((s) => s.maintenance)
  const syncAdminData = useStore((s) => s.syncAdminData)
  const orders = useStore((s) => s.orders)
  const tickets = useStore((s) => s.supportTickets)
  const refW = useStore((s) => s.refWithdrawals)
  const supportMessages = useStore((s) => s.supportMessages)
  const t = useT()
  const lang = useStore((s) => s.lang)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [q, setQ] = useState('')
  const [syncing, setSyncing] = useState(false)

  const active = (path: string) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)

  const pendingOrders = orders.filter((o) => o.status === 'pending').length
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
  const attentionTotal = pendingOrders + openTickets + pendingRefW

  const pageTitle = useMemo(() => {
    const exact = ROUTE_TITLE[location.pathname]
    if (exact) return exact
    const tab = TABS.find((tb) => active(tb.path))
    return tab ? t(tab.key) : 'Админ'
  }, [location.pathname, t])

  const doSync = useCallback(async () => {
    setSyncing(true)
    await syncAdminData()
    setSyncing(false)
  }, [syncAdminData])

  useEffect(() => {
    if (adminOk && api.isEnabled()) doSync()
  }, [adminOk, doSync])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setNotifOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!isAdminCheckDone()) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--adm-muted)', fontSize: 13 }}>
        {lang === 'ru' ? 'Проверка доступа…' : 'Checking access…'}
      </div>
    )
  }
  if (!isAdmin()) return <Navigate to="/" replace />

  const filteredQuick = QUICK.filter((it) => it.label.toLowerCase().includes(q.trim().toLowerCase()))
  const apiOn = api.isEnabled()

  return (
    <div className="admin-shell adm3">
      <header className="adm3-topbar">
        <button
          type="button"
          className="adm3-iconbtn"
          onClick={() => (location.pathname === '/admin' ? navigate('/') : navigate(-1))}
          aria-label={lang === 'ru' ? 'Назад' : 'Back'}
        >
          <I.back />
        </button>

        <div className="adm3-topbar-title">
          <h1>{pageTitle}</h1>
          <span>{lang === 'ru' ? 'Панель управления' : 'Control panel'}</span>
        </div>

        <div className="adm3-chips">
          <span className={`adm3-chip ${maintenance ? 'adm3-chip--off' : 'adm3-chip--ok'}`}>
            {maintenance ? (lang === 'ru' ? 'Закрыт' : 'Closed') : (lang === 'ru' ? 'Открыт' : 'Open')}
          </span>
          <span className={`adm3-chip ${apiOn ? 'adm3-chip--ok' : ''}`}>
            {apiOn ? (lang === 'ru' ? 'Сервер' : 'Server') : (lang === 'ru' ? 'Локально' : 'Local')}
          </span>
        </div>

        <button type="button" className="adm3-iconbtn" onClick={() => setPaletteOpen(true)} aria-label="Поиск">
          <I.search />
        </button>
        <button
          type="button"
          className="adm3-iconbtn"
          onClick={doSync}
          disabled={syncing}
          aria-label={lang === 'ru' ? 'Обновить' : 'Refresh'}
          style={{ opacity: syncing ? 0.5 : 1 }}
        >
          <I.refresh />
        </button>
        <button
          type="button"
          className="adm3-iconbtn adm3-iconbtn--badge"
          onClick={() => setNotifOpen((v) => !v)}
          aria-label={lang === 'ru' ? 'Задачи' : 'Tasks'}
        >
          <I.bell />
          {attentionTotal > 0 && (
            <span className="adm3-badge-count">{attentionTotal > 9 ? '9+' : attentionTotal}</span>
          )}
        </button>
        <button type="button" className="adm3-iconbtn" onClick={() => navigate('/')} aria-label={lang === 'ru' ? 'В магазин' : 'To shop'}>
          <I.close />
        </button>
      </header>

      <div className="scroll-area adm3-scroll">
        <Outlet />
      </div>

      <nav className="nav admin-nav adm3-nav">
        {TABS.map((tab) => {
          const isActive = active(tab.path)
          const badge =
            tab.path === '/admin/orders' ? pendingOrders :
            tab.path === '/admin/support' ? openTickets :
            tab.path === '/admin/more' ? pendingRefW : 0
          return (
            <button
              key={tab.path}
              type="button"
              className={`nav-item${isActive ? ' is-active' : ''}`}
              onClick={() => navigate(tab.path)}
              style={{ position: 'relative' }}
            >
              <span className={`nav-icon${isActive ? ' active' : ''}`}><tab.Icon /></span>
              <span className={`nav-label${isActive ? ' active' : ''}`}>{t(tab.key)}</span>
              {badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: '22%',
                    minWidth: 14,
                    height: 14,
                    borderRadius: 7,
                    background: 'var(--adm-danger)',
                    color: '#fff',
                    fontSize: 8,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            className="adm3-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
          >
            <motion.div
              className="adm3-panel"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="adm3-pal-input">
                <I.search />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={lang === 'ru' ? 'Перейти в раздел…' : 'Go to section…'}
                />
                <span style={{ fontSize: 10, color: 'var(--adm-dim)' }}>⌘K</span>
              </div>
              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {filteredQuick.map((it) => (
                  <button
                    key={it.path}
                    type="button"
                    className="adm3-pal-item"
                    onClick={() => {
                      navigate(it.path)
                      setPaletteOpen(false)
                      setQ('')
                    }}
                  >
                    <span>{it.label}</span>
                    <span className="adm3-pal-path">{it.path}</span>
                  </button>
                ))}
                {filteredQuick.length === 0 && (
                  <div className="adm-empty">{lang === 'ru' ? 'Ничего не найдено' : 'Nothing found'}</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notifOpen && (
          <motion.div
            className="adm3-overlay adm3-overlay--side"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNotifOpen(false)}
          >
            <motion.div
              className="adm3-panel adm3-panel-side"
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                {lang === 'ru' ? 'Нужно сделать' : 'To do'}
              </div>
              {attentionTotal === 0 && (
                <AdminEmpty>{lang === 'ru' ? 'Всё обработано.' : 'All clear.'}</AdminEmpty>
              )}
              {pendingOrders > 0 && (
                <button type="button" className="adm-task" style={{ marginBottom: 6 }} onClick={() => { navigate('/admin/orders'); setNotifOpen(false) }}>
                  <span className="adm-task-dot" style={{ background: '#a78bfa' }} />
                  <div className="adm-task-meta">
                    <div className="adm-task-title">{lang === 'ru' ? 'Ожидают оплаты' : 'Pending payment'}</div>
                    <div className="adm-task-sub">{pendingOrders} {lang === 'ru' ? 'заказов' : 'orders'}</div>
                  </div>
                </button>
              )}
              {openTickets > 0 && (
                <button type="button" className="adm-task" style={{ marginBottom: 6 }} onClick={() => { navigate('/admin/support'); setNotifOpen(false) }}>
                  <span className="adm-task-dot" style={{ background: 'var(--adm-accent)' }} />
                  <div className="adm-task-meta">
                    <div className="adm-task-title">{lang === 'ru' ? 'Поддержка' : 'Support'}</div>
                    <div className="adm-task-sub">{openTickets} {lang === 'ru' ? 'диалогов' : 'chats'}</div>
                  </div>
                </button>
              )}
              {pendingRefW > 0 && (
                <button type="button" className="adm-task" onClick={() => { navigate('/admin/referrals'); setNotifOpen(false) }}>
                  <span className="adm-task-dot" style={{ background: 'var(--adm-warn)' }} />
                  <div className="adm-task-meta">
                    <div className="adm-task-title">{lang === 'ru' ? 'Реф. выводы' : 'Ref payouts'}</div>
                    <div className="adm-task-sub">{pendingRefW} {lang === 'ru' ? 'заявок' : 'requests'}</div>
                  </div>
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
