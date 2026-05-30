import { useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { useT } from '../i18n'

/* ─────────────── icons ─────────────── */
const I = {
  dash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  orders: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><path d="M9 12h6M9 16h4"/></svg>,
  products: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  support: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  more: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>,
  back: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
  bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  exit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  close: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  dot: () => <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>,
}

const TABS = [
  { path: '/admin',          Icon: I.dash,     key: 'admin_dashboard' as const, accent: '57,255,99' },
  { path: '/admin/orders',   Icon: I.orders,   key: 'admin_orders'    as const, accent: '151,136,196' },
  { path: '/admin/products', Icon: I.products, key: 'admin_products'  as const, accent: '224,115,74'  },
  { path: '/admin/support',  Icon: I.support,  key: 'admin_support'   as const, accent: '118,163,116' },
  { path: '/admin/more',     Icon: I.more,     key: 'admin_more'      as const, accent: '111,154,184' },
]

const QUICK = [
  { path: '/admin',           label: 'Дашборд' },
  { path: '/admin/orders',    label: 'Заказы'  },
  { path: '/admin/products',  label: 'Товары'  },
  { path: '/admin/users',     label: 'Пользователи' },
  { path: '/admin/support',   label: 'Поддержка' },
  { path: '/admin/broadcast', label: 'Рассылка' },
  { path: '/admin/referrals', label: 'Реф. выводы' },
  { path: '/admin/deposits',  label: 'Пополнения' },
  { path: '/admin/logs',      label: 'Логи' },
  { path: '/admin/photos',    label: 'Фото' },
  { path: '/admin/settings',  label: 'Настройки' },
  { path: '/admin/customize', label: 'Кастомизация' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin  = useStore((s) => s.isAdmin)
  const isAdminCheckDone = useStore((s) => s.isAdminCheckDone)
  const orders   = useStore((s) => s.orders)
  const tickets  = useStore((s) => s.supportTickets)
  const refW     = useStore((s) => s.refWithdrawals)
  const supportMessages = useStore((s) => s.supportMessages)
  const t        = useT()

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen]     = useState(false)
  const [q, setQ]                     = useState('')

  if (!isAdminCheckDone()) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'rgba(255,255,255,0.5)', fontSize: 13, letterSpacing: '0.15em' }}>
        Verifying access…
      </div>
    )
  }
  if (!isAdmin()) return <Navigate to="/" replace />

  const active = (path: string) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)

  /* attention data */
  const pendingOrders  = orders.filter((o) => o.status === 'pending').length
  const openTickets    = tickets.filter((tk) => {
    if (tk.status === 'closed') return false
    const ticketMsgs = supportMessages.filter(
      (m) => m.ticket_id === tk.id &&
        (m.kind === 'text' || m.kind === 'image' || m.kind === 'file' || !m.kind),
    )
    const hasAdminReply = ticketMsgs.some((m) => m.sender === 'admin')
    const hasUnreadUserMsg = ticketMsgs.some((m) => m.sender === 'user' && !m.read_by_admin)
    // fresh ticket without admin reply, or any unread user message
    return !hasAdminReply || hasUnreadUserMsg
  }).length
  const pendingRefW    = refW.filter((w) => w.status === 'pending').length
  const attentionTotal = pendingOrders + openTickets + pendingRefW

  const currentTab = TABS.find((tb) => active(tb.path)) ?? TABS[0]
  const pageTitle  = useMemo(() => t(currentTab.key), [currentTab, t])

  /* Cmd/Ctrl+K palette */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
      if (e.key === 'Escape') { setPaletteOpen(false); setNotifOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filteredQuick = QUICK.filter((it) => it.label.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="admin-shell adm2">
      {/* aurora background */}
      <div className="adm2-aurora" aria-hidden>
        <span className="adm2-aurora-1" />
        <span className="adm2-aurora-2" />
        <span className="adm2-aurora-3" />
      </div>

      {/* TOPBAR */}
      <div className="adm2-topbar">
        <button
          className="adm2-iconbtn"
          onClick={() => {
            if (location.pathname === '/admin') navigate('/')
            else navigate(-1)
          }}
          aria-label="Назад"
        >
          <I.back />
        </button>

        <div className="adm2-title">
          <span className="adm2-badge">ADMIN</span>
        </div>

        <div className="adm2-actions">
          <button
            className="adm2-iconbtn"
            onClick={() => setPaletteOpen(true)}
            aria-label="Поиск"
          >
            <I.search />
          </button>

          <button
            className="adm2-iconbtn adm2-iconbtn--rel"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Уведомления"
          >
            <I.bell />
            {attentionTotal > 0 && (
              <motion.span
                className="adm2-pulse"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              >
                {attentionTotal > 9 ? '9+' : attentionTotal}
              </motion.span>
            )}
          </button>

          <button className="adm2-iconbtn adm2-iconbtn--danger" onClick={() => navigate('/')} aria-label="Выйти">
            <I.exit />
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="scroll-area adm2-scroll">
        <Outlet />
      </div>

      {/* BOTTOM NAV */}
      <nav className="nav admin-nav adm2-nav">
        {TABS.map((tab) => {
          const isActive = active(tab.path)
          return (
            <button
              key={tab.path}
              className={`nav-item adm2-nav-item${isActive ? ' is-active' : ''}`}
              onClick={() => navigate(tab.path)}
              style={{ ['--tab-accent' as never]: tab.accent }}
            >
              {isActive && (
                <motion.div
                  className="adm2-nav-glow"
                  layoutId="adm2-glow"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`nav-icon${isActive ? ' active' : ''}`}><tab.Icon /></span>
              <span className={`nav-label${isActive ? ' active' : ''}`}>{t(tab.key)}</span>
            </button>
          )
        })}
      </nav>

      {/* COMMAND PALETTE */}
      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            className="adm2-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
          >
            <motion.div
              className="adm2-palette"
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="adm2-pal-input">
                <I.search />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Куда перейти? (Cmd+K)"
                />
                <span className="adm2-kbd">ESC</span>
              </div>
              <div className="adm2-pal-list">
                {filteredQuick.length === 0 && (
                  <div className="adm2-pal-empty">Ничего не найдено</div>
                )}
                {filteredQuick.map((it) => (
                  <button
                    key={it.path}
                    className="adm2-pal-item"
                    onClick={() => { navigate(it.path); setPaletteOpen(false); setQ('') }}
                  >
                    <span>{it.label}</span>
                    <span className="adm2-pal-path">{it.path}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTIFICATIONS POPOVER */}
      <AnimatePresence>
        {notifOpen && (
          <motion.div
            className="adm2-overlay adm2-overlay--right"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setNotifOpen(false)}
          >
            <motion.div
              className="adm2-notif"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="adm2-notif-head">
                <div className="t-md fw-black">Требует внимания</div>
                <button className="adm2-iconbtn" onClick={() => setNotifOpen(false)}><I.close /></button>
              </div>
              {attentionTotal === 0 && (
                <div className="adm2-notif-empty">
                  <div style={{ fontSize: 30 }}>✨</div>
                  Всё чисто. Можно отдохнуть.
                </div>
              )}
              {pendingOrders > 0 && (
                <button className="adm2-notif-row" onClick={() => { navigate('/admin/orders'); setNotifOpen(false) }}>
                  <span className="adm2-notif-ic" style={{ color: 'var(--purple)' }}><I.orders /></span>
                  <div className="adm2-notif-body">
                    <div className="fw-bold t-sm">Заказы в ожидании оплаты</div>
                    <div className="t-xs t-muted">Проверьте и подтвердите</div>
                  </div>
                  <span className="adm2-notif-count">{pendingOrders}</span>
                </button>
              )}
              {openTickets > 0 && (
                <button className="adm2-notif-row" onClick={() => { navigate('/admin/support'); setNotifOpen(false) }}>
                  <span className="adm2-notif-ic" style={{ color: 'var(--green)' }}><I.support /></span>
                  <div className="adm2-notif-body">
                    <div className="fw-bold t-sm">Открытые обращения</div>
                    <div className="t-xs t-muted">Ответьте пользователям</div>
                  </div>
                  <span className="adm2-notif-count">{openTickets}</span>
                </button>
              )}
              {pendingRefW > 0 && (
                <button className="adm2-notif-row" onClick={() => { navigate('/admin/referrals'); setNotifOpen(false) }}>
                  <span className="adm2-notif-ic" style={{ color: 'var(--cyan)' }}><I.dot /></span>
                  <div className="adm2-notif-body">
                    <div className="fw-bold t-sm">Реф. выводы</div>
                    <div className="t-xs t-muted">Ожидают обработки</div>
                  </div>
                  <span className="adm2-notif-count">{pendingRefW}</span>
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
