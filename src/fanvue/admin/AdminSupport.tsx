import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useTelegram } from '../hooks/useTelegram'
import { tgNotify, notifyUser, notifyAdmin } from '../utils/tgNotify'
import { CONFIG } from '../config'
import type { SupportMessage, SupportTicket } from '../store/types'
import OrderReceiptMessage from '../components/OrderReceiptMessage'

/* ─────────── tokens ─────────── */
const C = {
  bg: '#0a0b0d',
  panel: 'rgba(22,23,26,0.72)',
  panelSolid: '#141518',
  panelHi: '#1c1d21',
  line: 'rgba(255,255,255,0.06)',
  lineHi: 'rgba(255,255,255,0.12)',
  text: '#f4f4f5',
  soft: 'rgba(255,255,255,0.72)',
  muted: 'rgba(255,255,255,0.42)',
  dim: 'rgba(255,255,255,0.28)',
  brand: '#3dff66',
  brandDim: 'rgba(61,255,102,0.14)',
  red: '#ff5266',
  amber: '#ffb020',
  cyan: '#5cd0ff',
}
const MONO = 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace'

interface ChatGroup {
  uid: number
  username: string
  full_name: string
  photo_url?: string
  messages: SupportMessage[]
  last: SupportMessage
  unread: number
  activeTicket?: SupportTicket
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/* ─────────── icons ─────────── */
const I = {
  back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>,
  send: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l14-7-4 16-4-7-6-2z"/></svg>,
  close: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  reply: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v2"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>,
  check: <svg width="12" height="9" viewBox="0 0 12 9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M1 5 L4.2 8 L11 1"/></svg>,
  check2: <svg width="17" height="9" viewBox="0 0 17 9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M1 5 L4.2 8 L11 1"/><path d="M6 5 L9.2 8 L16 1"/></svg>,
  info: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>,
  bolt: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>,
  attach: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5l-8.5 8.5a5.5 5.5 0 0 1-7.78-7.78l9-9a3.5 3.5 0 1 1 4.95 4.95l-9 9a1.5 1.5 0 0 1-2.12-2.12l8.5-8.5"/></svg>,
}

export default function AdminSupport() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const messages = useStore((s) => s.supportMessages)
  const tickets = useStore((s) => s.supportTickets)
  const presence = useStore((s) => s.adminPresence)
  const userTyping = useStore((s) => s.userTyping)
  const user = useStore((s) => s.user)
  const addMsg = useStore((s) => s.addSupportMessage)
  const deleteMsg = useStore((s) => s.deleteSupportMessage)
  const markRead = useStore((s) => s.markUserMessagesReadByAdmin)
  const setAdminPresence = useStore((s) => s.setAdminPresence)
  const closeTicket = useStore((s) => s.closeSupportTicket)
  const updateBalance = useStore((s) => s.updateBalance)
  const orders = useStore((s) => s.orders)
  const setOrderStatus = useStore((s) => s.setOrderStatus)
  const { haptic } = useTelegram()

  const [openUid, setOpenUid] = useState<number | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [replyTo, setReplyTo] = useState<SupportMessage | null>(null)
  const [actionMsg, setActionMsg] = useState<SupportMessage | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [balanceInput, setBalanceInput] = useState('')
  const [balanceSent, setBalanceSent] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const realUid = user?.uid ?? 0
  const realName = user?.username ?? ''
  const realFull = user?.full_name ?? 'User'
  const realPhoto = user?.photo_url

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.kind !== 'system' || m.text.startsWith('ticket_')),
    [messages],
  )

  const lastMsg = visibleMessages[visibleMessages.length - 1]
  const unreadCount = messages.filter((m) => m.sender === 'user' && !m.read_by_admin).length
  const activeTicket = tickets.find((tk) => tk.status !== 'closed')

  const groups: ChatGroup[] = messages.length > 0 && lastMsg ? [{
    uid: realUid, username: realName, full_name: realFull, photo_url: realPhoto,
    messages, last: lastMsg, unread: unreadCount, activeTicket,
  }] : []

  useEffect(() => {
    if (openUid && unreadCount > 0) {
      const id = setTimeout(() => markRead(), 300)
      return () => clearTimeout(id)
    }
  }, [openUid, unreadCount, markRead])

  useEffect(() => {
    if (!openUid) return
    const jump = () => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight + 9999
    }
    jump()
    const r1 = requestAnimationFrame(() => { jump(); requestAnimationFrame(jump) })
    const timers = [50, 150, 300, 600].map((d) => setTimeout(jump, d))
    // следим за ростом контента (анимации появления, лениво посчитанная высота)
    const el = scrollRef.current
    let ro: ResizeObserver | null = null
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { el.scrollTop = el.scrollHeight + 9999 })
      Array.from(el.children).forEach((c) => ro!.observe(c as Element))
      // отключаем наблюдатель через секунду — дальше скроллим только при новых сообщениях
      setTimeout(() => ro?.disconnect(), 900)
    }
    return () => {
      cancelAnimationFrame(r1)
      timers.forEach(clearTimeout)
      ro?.disconnect()
    }
  }, [openUid, messages.length])

  useEffect(() => {
    if (!actionMsg) return
    const close = () => setActionMsg(null)
    const id = setTimeout(() => document.addEventListener('click', close, { once: true }), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', close) }
  }, [actionMsg])

  /* ── Реальное присутствие админа ──
     online = true пока экран открыт и вкладка видима;
     при уходе/скрытии — online=false и lastSeen=now (heartbeat каждые 25с). */
  useEffect(() => {
    const mark = (online: boolean) =>
      setAdminPresence({ online, lastSeen: new Date().toISOString() })
    const onVis = () => mark(document.visibilityState === 'visible')
    onVis()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', () => mark(true))
    window.addEventListener('blur', () => mark(false))
    const beat = window.setInterval(() => {
      if (document.visibilityState === 'visible') mark(true)
    }, 25_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(beat)
      mark(false)
    }
  }, [setAdminPresence])

  const chatUser = groups.find((g) => g.uid === openUid)

  const chatOrderId = (() => {
    // Сначала ищем по order_receipt (надёжно), затем по #ID в тексте
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.kind === 'order_receipt' && m.order_receipt?.orderId) return m.order_receipt.orderId
    }
    for (const m of messages) {
      const match = m.text.match(/#([\w-]+)/)
      if (match) return match[1]
    }
    return null
  })()
  const chatOrder = chatOrderId ? orders.find((o) => o.id === chatOrderId) : null

  const send = () => {
    const trimmed = reply.trim()
    if (!trimmed) return

    // slash-команды
    if (trimmed.startsWith('/')) {
      const [cmd, ...rest] = trimmed.slice(1).split(/\s+/)
      if (cmd === 'close' && activeTicket) { handleCloseTicket(); setReply(''); return }
      if (cmd === 'balance') {
        const amt = parseFloat(rest[0] ?? '')
        if (amt > 0) {
          updateBalance(amt); haptic('success')
          addMsg({
            id: Date.now(), sender: 'admin', kind: 'text',
            text: lang === 'ru' ? `💸 Начислено $${amt.toFixed(2)} на баланс.` : `💸 $${amt.toFixed(2)} credited.`,
            created: new Date().toISOString(), ticket_id: activeTicket?.id,
          })
          setReply(''); return
        }
      }
      if (cmd === 'delivered' && chatOrder) { handleMarkDelivered(); setReply(''); return }
    }

    haptic('success')
    addMsg({
      id: Date.now(), sender: 'admin', kind: 'text', text: trimmed,
      created: new Date().toISOString(), reply_to: replyTo?.id, ticket_id: activeTicket?.id,
    })
    setReply(''); setReplyTo(null)
    if (openUid) {
      notifyUser(openUid, `💬 Вам пришло сообщение от поддержки ${CONFIG.brandName}\n\n${trimmed}\n\nОткройте приложение для ответа.`)
    }
    notifyAdmin(`💬 Ответ в поддержку\n👤 UID: ${openUid ?? '—'}\n\n${trimmed}`)
  }

  const insertCanned = (txt: string) => {
    setReply((r) => (r ? r + ' ' + txt : txt))
    inputRef.current?.focus()
  }

  const handleDelete = (m: SupportMessage, mode: 'user' | 'all') => {
    haptic('light'); deleteMsg(m.id, mode); setActionMsg(null)
  }
  const handleReply = (m: SupportMessage) => { setReplyTo(m); setActionMsg(null); inputRef.current?.focus() }

  const handleCloseTicket = () => {
    if (!activeTicket) return
    haptic('success'); closeTicket(activeTicket.id, 'admin'); setConfirmClose(false)
    if (openUid) {
      notifyUser(openUid, lang === 'ru'
        ? `✅ Ваше обращение ${activeTicket.id} закрыто. Если нужна помощь — напишите снова.`
        : `✅ Your ticket ${activeTicket.id} has been closed. Reach out anytime if you need more help.`)
    }
    notifyAdmin(`✅ Тикет ${activeTicket.id} закрыт · UID: ${openUid ?? '—'}`)
  }
  const handleIssueBalance = () => {
    const amt = parseFloat(balanceInput)
    if (!amt || amt <= 0) return
    updateBalance(amt); haptic('success')
    setBalanceSent(true); setBalanceInput('')
    setTimeout(() => setBalanceSent(false), 2200)
  }
  const handleMarkDelivered = () => {
    if (!chatOrder) return
    haptic('success')
    setOrderStatus(chatOrder.id, 'completed')
    if (openUid) {
      notifyUser(openUid, `🎉 Ваш заказ выдан!\n\n📦 ${chatOrder.product_title ?? chatOrder.id}\n💵 $${chatOrder.amount.toFixed(2)}\n🆔 #${chatOrder.id}\n\nОткройте приложение для получения.`)
    }
    notifyAdmin(`📦 Заказ выдан\n🆔 ${chatOrder.id}\n👤 UID: ${openUid ?? '—'}\n💵 $${chatOrder.amount.toFixed(2)}`)
  }

  /* ─────────── canned replies ─────────── */
  const canned = lang === 'ru' ? [
    'Здравствуйте! Подключаюсь к вашему вопросу 👋',
    'Уточните, пожалуйста, ID заказа.',
    'Проверяю информацию, одну минуту.',
    'Готово ✅',
  ] : [
    'Hi! Looking into your case 👋',
    'Could you share the order ID?',
    'Checking, one moment.',
    'Done ✅',
  ]

  /* ─────────── Avatar ─────────── */
  const Avatar = ({ size = 40, photo, name, ring }: { size?: number; photo?: string; name: string; ring?: boolean }) => (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {photo ? (
        <img src={photo} alt={name}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover',
            border: ring ? `2px solid ${C.brand}` : `1px solid ${C.line}`,
            boxShadow: ring ? `0 0 0 3px rgba(61,255,102,0.18)` : 'none' }} />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: 'linear-gradient(135deg,#3dff66,#1a8a3a)', color: '#0a0a0b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.4, fontWeight: 800, letterSpacing: -0.5,
          border: ring ? `2px solid ${C.brand}` : 'none',
          boxShadow: ring ? `0 0 0 3px rgba(61,255,102,0.18)` : 'none',
        }}>{name[0]?.toUpperCase()}</div>
      )}
      {ring && (
        <span style={{
          position: 'absolute', right: -1, bottom: -1, width: 11, height: 11,
          borderRadius: '50%', background: C.brand, border: `2px solid ${C.bg}`,
          boxShadow: `0 0 6px ${C.brand}`,
        }} />
      )}
    </div>
  )

  return (
    <PageTransition>
      <div className="page" style={{ paddingBottom: 0, background: C.bg }}>
        <AnimatePresence mode="wait">

          {/* ═════════════ LIST ═════════════ */}
          {!openUid && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Top status strip */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 0 14px',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: MONO, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Fanvue · Care console
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>
                    {lang === 'ru' ? 'Входящие' : 'Inbox'}
                    <span style={{ marginLeft: 8, fontSize: 12, color: C.muted, fontFamily: MONO, fontWeight: 500 }}>
                      {groups.length}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '7px 11px', borderRadius: 999,
                    background: 'rgba(61,255,102,0.08)',
                    border: `1px solid rgba(61,255,102,0.25)`,
                    fontSize: 11, fontWeight: 600, color: C.brand,
                    fontFamily: MONO, letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}
                  title={lang === 'ru' ? 'Клиенты видят, что вы в сети' : 'Clients see you online'}
                >
                  <motion.span
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: C.brand, boxShadow: `0 0 8px ${C.brand}`,
                    }} />
                  live
                </div>
              </div>

              {groups.length === 0 ? (
                <div style={{
                  marginTop: 30, padding: 40, textAlign: 'center',
                  border: `1px dashed ${C.line}`, borderRadius: 18, color: C.muted,
                }}>
                  <div style={{ fontSize: 32, opacity: 0.4 }}>◌</div>
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    {lang === 'ru' ? 'Тишина. Ни одного открытого диалога.' : 'All quiet. No open conversations.'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groups.map((g, i) => (
                    <motion.button
                      key={g.uid}
                      onClick={() => { setOpenUid(g.uid); haptic('light') }}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileTap={{ scale: 0.985 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                        padding: '12px 14px',
                        background: g.unread > 0
                          ? 'linear-gradient(180deg, rgba(61,255,102,0.06), rgba(61,255,102,0.02))'
                          : C.panel,
                        border: `1px solid ${g.unread > 0 ? 'rgba(61,255,102,0.28)' : C.line}`,
                        borderRadius: 16,
                        backdropFilter: 'blur(20px)',
                      }}
                    >
                      <Avatar size={44} photo={g.photo_url} name={g.full_name} ring={g.unread > 0} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {g.full_name}
                          </div>
                          <div style={{ fontSize: 10.5, color: C.muted, fontFamily: MONO, flexShrink: 0, marginLeft: 8 }}>
                            {fmtTime(g.last.created)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                          <div style={{ fontSize: 12.5, color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {g.last.sender === 'admin' && <span style={{ color: C.muted, marginRight: 4 }}>↳</span>}
                            {g.last.deleted_for === 'all' ? <em style={{ color: C.muted }}>· удалено ·</em> : (g.last.text || '📎 attachment')}
                          </div>
                          {g.unread > 0 && (
                            <span style={{
                              minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10,
                              background: C.brand, color: '#0a0a0b', fontSize: 11, fontWeight: 800,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8,
                              boxShadow: `0 0 12px rgba(61,255,102,0.4)`,
                            }}>{g.unread}</span>
                          )}
                        </div>
                        {g.activeTicket && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                            padding: '3px 8px', borderRadius: 6,
                            background: 'rgba(61,255,102,0.1)', color: C.brand,
                            fontSize: 10, fontWeight: 700, fontFamily: MONO, letterSpacing: '0.04em',
                          }}>
                            {I.bolt}
                            {g.activeTicket.id} · {g.activeTicket.category}
                          </div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ═════════════ CHAT ═════════════ */}
          {openUid && chatUser && (
            <motion.div key="chat"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px - 48px - 32px)', minHeight: 0 }}
            >
              {/* ── Cockpit header ── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', marginBottom: 8,
                background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
                backdropFilter: 'blur(20px)',
              }}>
                <button onClick={() => setOpenUid(null)}
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: C.panelHi, border: `1px solid ${C.line}`,
                    color: C.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{I.back}</button>

                <button onClick={() => setInfoOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent' }}>
                  <Avatar size={36} photo={chatUser.photo_url} name={chatUser.full_name} ring={presence.online} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {chatUser.full_name}
                    </div>
                    <div style={{ fontSize: 10.5, color: userTyping ? C.brand : C.muted, fontFamily: MONO, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {userTyping
                        ? (lang === 'ru' ? '● печатает…' : '● typing…')
                        : (chatUser.username ? '@' + chatUser.username : 'ID ' + chatUser.uid)}
                    </div>
                  </div>
                </button>

                <button onClick={() => setInfoOpen(true)}
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: C.panelHi, border: `1px solid ${C.line}`,
                    color: C.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{I.info}</button>
              </div>

              {/* ── Context strip: ticket / balance / order ── */}
              <div style={{
                display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8,
                padding: '2px 0', scrollbarWidth: 'none',
              }}>
                {activeTicket ? (
                  <button
                    onClick={() => { haptic('light'); setConfirmClose(true) }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                      padding: '7px 11px', borderRadius: 10,
                      background: 'rgba(61,255,102,0.08)', border: `1px solid rgba(61,255,102,0.22)`,
                      color: C.brand, fontSize: 11, fontWeight: 700, fontFamily: MONO,
                    }}>
                    ● {activeTicket.id} · {activeTicket.category}
                    <span style={{ color: C.red, marginLeft: 4 }}>{I.close}</span>
                  </button>
                ) : (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    padding: '7px 11px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.line}`,
                    color: C.muted, fontSize: 11, fontWeight: 600, fontFamily: MONO,
                  }}>
                    ○ {lang === 'ru' ? 'нет тикета' : 'no ticket'}
                  </span>
                )}

                {user && (
                  <span style={{
                    flexShrink: 0, padding: '7px 11px', borderRadius: 10,
                    background: C.panel, border: `1px solid ${C.line}`,
                    fontSize: 11, fontWeight: 700, fontFamily: MONO, color: C.text,
                  }}>
                    💰 ${user.balance.toFixed(2)}
                    <span style={{ color: C.muted, fontWeight: 500, marginLeft: 6 }}>
                      / ${user.spent.toFixed(2)} spent
                    </span>
                  </span>
                )}

                {chatOrder && (
                  <button
                    onClick={() => chatOrder.status === 'paid' && handleMarkDelivered()}
                    disabled={chatOrder.status !== 'paid'}
                    style={{
                      flexShrink: 0, padding: '7px 11px', borderRadius: 10,
                      background: chatOrder.status === 'completed'
                        ? 'rgba(61,255,102,0.08)'
                        : 'rgba(255,176,32,0.1)',
                      border: `1px solid ${chatOrder.status === 'completed' ? 'rgba(61,255,102,0.25)' : 'rgba(255,176,32,0.3)'}`,
                      color: chatOrder.status === 'completed' ? C.brand : C.amber,
                      fontSize: 11, fontWeight: 700, fontFamily: MONO,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                    📦 #{chatOrder.id.slice(-6)} · ${chatOrder.amount.toFixed(2)}
                    {chatOrder.status === 'paid' && (
                      <span style={{ color: C.brand, fontSize: 9, padding: '2px 5px', background: 'rgba(61,255,102,0.15)', borderRadius: 4 }}>
                        {lang === 'ru' ? 'ВЫДАТЬ' : 'DELIVER'}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* ── Messages ── */}
              <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 2px 12px' }}>
                <AnimatePresence initial={false}>
                  {visibleMessages.map((m, i) => {
                    const right = m.sender === 'admin'
                    const isSystem = m.kind === 'system'
                    const deletedForUser = m.deleted_for === 'user'
                    const replyMsg = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null
                    const prev = visibleMessages[i - 1]
                    const next = visibleMessages[i + 1]
                    const isLast = !next || next.sender !== m.sender || next.kind === 'system'
                    const isFirst = !prev || prev.sender !== m.sender || prev.kind === 'system'

                    if (isSystem) {
                      const [type, id, reason] = m.text.split(':')
                      // user-facing action card — don't render on admin
                      if (type === 'post_delivery_actions') return null
                      if (type === 'post_delivery_resolved') {
                        const choice = reason
                        const label = choice === 'close'
                          ? (lang === 'ru' ? `Пользователь закрыл обращение по #${(id ?? '').slice(-6)}` : `User closed ticket for #${(id ?? '').slice(-6)}`)
                          : (lang === 'ru' ? `Пользователь продолжает диалог по #${(id ?? '').slice(-6)}` : `User wants to keep chatting about #${(id ?? '').slice(-6)}`)
                        return (
                          <motion.div key={m.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}
                          >
                            <div style={{
                              fontSize: 10.5, color: C.muted, padding: '4px 11px',
                              background: 'rgba(255,255,255,0.03)',
                              borderRadius: 999, border: `1px solid ${C.line}`,
                              fontWeight: 600, fontFamily: MONO, letterSpacing: '0.02em',
                            }}>{label}</div>
                          </motion.div>
                        )
                      }
                      const tk = tickets.find((x) => x.id === id)
                      const label = type === 'ticket_opened'
                        ? (lang === 'ru'
                            ? `Открыто ${id}${tk?.category ? ' · ' + tk.category : ''}${tk?.summary ? ' · ' + tk.summary : ''}`
                            : `Opened ${id}${tk?.category ? ' · ' + tk.category : ''}${tk?.summary ? ' · ' + tk.summary : ''}`)
                        : (lang === 'ru'
                            ? `Закрыто ${id}${reason ? ' · ' + reason : ''}`
                            : `Closed ${id}${reason ? ' · ' + reason : ''}`)
                      const accent = type === 'ticket_opened'
                      return (
                        <motion.div key={m.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}
                        >
                          <div style={{
                            fontSize: 10.5, color: accent ? C.brand : C.muted, padding: '4px 11px',
                            background: accent ? 'rgba(61,255,102,0.06)' : 'rgba(255,255,255,0.03)',
                            borderRadius: 999, border: `1px solid ${accent ? 'rgba(61,255,102,0.2)' : C.line}`,
                            fontWeight: 600, fontFamily: MONO, letterSpacing: '0.02em',
                          }}>{label}</div>
                        </motion.div>
                      )
                    }

                    if (m.kind === 'order_receipt' && m.order_receipt) {
                      return (
                        <motion.div key={m.id}
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.14 }}
                          style={{ display: 'flex', justifyContent: 'center', padding: '8px 4px' }}
                        >
                          <OrderReceiptMessage payload={m.order_receipt} />
                        </motion.div>
                      )
                    }

                    const R = 16, S = 5
                    const radius = right
                      ? `${R}px ${isFirst ? R : S}px ${isLast ? S : S}px ${R}px`
                      : `${isFirst ? R : S}px ${R}px ${R}px ${isLast ? S : S}px`

                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.14 }}
                        style={{ display: 'flex', justifyContent: right ? 'flex-end' : 'flex-start', marginTop: isFirst ? 10 : 2 }}
                      >
                        <div
                          onClick={(e) => { e.stopPropagation(); setActionMsg(m) }}
                          style={{
                            position: 'relative', maxWidth: '82%',
                            padding: '7px 11px',
                            borderRadius: radius,
                            background: right
                              ? 'linear-gradient(180deg,#3dff66,#28e052)'
                              : C.panelHi,
                            color: right ? '#0a0a0b' : C.text,
                            border: deletedForUser ? `1px dashed ${C.muted}` : (right ? 'none' : `1px solid ${C.line}`),
                            opacity: deletedForUser ? 0.55 : 1,
                            cursor: 'pointer',
                            fontSize: 14, lineHeight: 1.35,
                            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                            fontWeight: right ? 500 : 450,
                          }}
                        >
                          {replyMsg && (
                            <div style={{
                              borderLeft: `2px solid ${right ? 'rgba(10,10,11,0.5)' : C.brand}`,
                              padding: '3px 8px', marginBottom: 5,
                              fontSize: 11, opacity: 0.78,
                              background: right ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)',
                              borderRadius: 5,
                            }}>
                              <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 1 }}>
                                {replyMsg.sender === 'admin' ? 'You' : chatUser.full_name}
                              </div>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {replyMsg.deleted_for ? '⌀ deleted' : replyMsg.text || '📎'}
                              </div>
                            </div>
                          )}
                          {deletedForUser && (
                            <div style={{ fontSize: 10, fontStyle: 'italic', marginBottom: 4, color: C.muted }}>
                              {lang === 'ru' ? '⌀ удалено пользователем' : '⌀ deleted by user'}
                            </div>
                          )}
                          {m.attachments && m.attachments.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: m.text ? 6 : 0 }}>
                              {m.attachments.map((a) => (
                                a.mime.startsWith('image/') ? (
                                  <img key={a.id} src={a.dataUrl} alt={a.name}
                                    style={{ maxWidth: 220, borderRadius: 10, display: 'block' }} />
                                ) : (
                                  <a key={a.id} href={a.dataUrl} download={a.name}
                                    style={{ fontSize: 12, textDecoration: 'underline', color: 'inherit' }}>
                                    📎 {a.name}
                                  </a>
                                )
                              ))}
                            </div>
                          )}
                          {m.text && <span>{m.text}</span>}

                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            marginLeft: 8, fontSize: 9.5, fontFamily: MONO,
                            color: right ? 'rgba(10,10,11,0.55)' : C.muted,
                            fontWeight: 500, verticalAlign: 'baseline',
                            float: m.text ? 'right' : 'none',
                            position: 'relative', top: 4,
                          }}>
                            {fmtTime(m.created)}
                            {right && (m.read_by_user ? I.check2 : I.check)}
                          </span>

                          {/* Action sheet */}
                          <AnimatePresence>
                            {actionMsg?.id === m.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute', top: '100%', marginTop: 6,
                                  [right ? 'right' : 'left']: 0,
                                  background: '#1a1b1f', border: `1px solid ${C.lineHi}`,
                                  borderRadius: 12, padding: 4, zIndex: 10, minWidth: 168,
                                  boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                                  color: C.text, fontWeight: 500,
                                }}
                              >
                                <button onClick={() => handleReply(m)} style={menuBtn}>
                                  <span style={{ color: C.brand }}>{I.reply}</span>
                                  {lang === 'ru' ? 'Ответить' : 'Reply'}
                                </button>
                                <button onClick={() => { navigator.clipboard?.writeText(m.text); setActionMsg(null); haptic('light') }} style={menuBtn}>
                                  <span style={{ color: C.cyan }}>{I.copy}</span>
                                  {lang === 'ru' ? 'Копировать' : 'Copy'}
                                </button>
                                <button onClick={() => handleDelete(m, 'all')} style={{ ...menuBtn, color: C.red }}>
                                  <span>{I.trash}</span>
                                  {lang === 'ru' ? 'Удалить' : 'Delete'}
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>

                {userTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 8 }}>
                    <div style={{
                      padding: '10px 14px', background: C.panelHi, border: `1px solid ${C.line}`,
                      borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 4,
                    }}>
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                          style={{ width: 6, height: 6, borderRadius: '50%', background: C.brand, display: 'inline-block' }} />
                      ))}
                    </div>
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* ── Canned-reply chips ── */}
              <div style={{
                display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 0 8px',
                scrollbarWidth: 'none',
              }}>
                {canned.map((c, i) => (
                  <button key={i} onClick={() => { haptic('light'); insertCanned(c) }}
                    style={{
                      flexShrink: 0, padding: '6px 11px', borderRadius: 999,
                      background: C.panel, border: `1px solid ${C.line}`,
                      color: C.soft, fontSize: 11.5, fontWeight: 500,
                      backdropFilter: 'blur(20px)', whiteSpace: 'nowrap',
                    }}>
                    {c.length > 38 ? c.slice(0, 36) + '…' : c}
                  </button>
                ))}
              </div>

              {/* ── Reply preview ── */}
              <AnimatePresence>
                {replyTo && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{
                      background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
                      padding: '7px 10px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6,
                      backdropFilter: 'blur(20px)',
                    }}>
                    <div style={{ width: 3, height: 30, background: C.brand, borderRadius: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10.5, color: C.brand, fontWeight: 700, fontFamily: MONO }}>
                        ↩ {replyTo.sender === 'admin' ? 'You' : chatUser.full_name}
                      </div>
                      <div style={{ fontSize: 12, color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {replyTo.text || '📎 attachment'}
                      </div>
                    </div>
                    <button onClick={() => setReplyTo(null)} style={{ color: C.muted, padding: 4 }}>{I.close}</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Input bar ── */}
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 8,
                padding: '8px 8px 8px 12px',
                background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18,
                backdropFilter: 'blur(20px)',
                marginTop: 'auto', marginBottom: 4,
              }}>
                <textarea
                  ref={inputRef}
                  placeholder={lang === 'ru' ? 'Сообщение  ·  /close /balance /delivered' : 'Message  ·  /close /balance /delivered'}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  rows={1}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: C.text, fontSize: 14, fontFamily: 'inherit', resize: 'none',
                    minHeight: 36, maxHeight: 110, padding: '8px 0',
                    lineHeight: 1.4,
                  }}
                />
                <motion.button
                  onClick={send} disabled={!reply.trim()} whileTap={{ scale: 0.92 }}
                  style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: reply.trim() ? 'linear-gradient(135deg,#3dff66,#28e052)' : C.panelHi,
                    color: reply.trim() ? '#0a0a0b' : C.muted,
                    border: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: reply.trim() ? `0 6px 18px rgba(61,255,102,0.35)` : 'none',
                    transition: 'all 160ms ease',
                  }}>
                  {I.send}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═════════════ INFO DRAWER ═════════════ */}
        <AnimatePresence>
          {infoOpen && chatUser && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setInfoOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
            >
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%', maxHeight: '85dvh', overflowY: 'auto',
                  background: '#101114', borderTop: `1px solid ${C.lineHi}`,
                  borderRadius: '24px 24px 0 0', padding: '14px 18px 28px',
                }}
              >
                <div style={{ width: 36, height: 4, background: C.lineHi, borderRadius: 99, margin: '0 auto 16px' }} />

                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
                  <Avatar size={56} photo={realPhoto} name={realFull} ring={presence.online} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>{realFull}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, fontFamily: MONO, marginTop: 2 }}>
                      {realName ? '@' + realName + ' · ' : ''}ID {realUid}
                    </div>
                  </div>
                </div>

                {user && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 18 }}>
                    <StatTile label="balance" value={`$${user.balance.toFixed(0)}`} color={C.brand} />
                    <StatTile label="spent" value={`$${user.spent.toFixed(0)}`} color={C.amber} />
                    <StatTile label="orders" value={String(user.purchases)} color={C.cyan} />
                    <StatTile label="refs" value={String(user.ref_count)} color={C.text} />
                  </div>
                )}

                {/* Issue balance */}
                <div style={{
                  background: C.panelSolid, border: `1px solid ${C.line}`, borderRadius: 14,
                  padding: 14, marginBottom: 14,
                }}>
                  <div style={{ fontSize: 10.5, color: C.muted, fontFamily: MONO, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    {lang === 'ru' ? 'Начислить баланс' : 'Issue balance'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" inputMode="decimal" placeholder="$0.00"
                      value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)}
                      style={{
                        flex: 1, background: '#0c0d10', border: `1px solid ${C.line}`,
                        borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 15,
                        outline: 'none', fontFamily: MONO,
                      }} />
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={handleIssueBalance} disabled={!balanceInput || balanceSent}
                      style={{
                        padding: '0 18px', borderRadius: 10,
                        background: balanceSent ? C.brandDim : 'linear-gradient(135deg,#3dff66,#28e052)',
                        color: balanceSent ? C.brand : '#0a0a0b', fontWeight: 700, fontSize: 13,
                        border: 'none', flexShrink: 0,
                      }}>
                      {balanceSent ? '✓' : (lang === 'ru' ? 'Зачислить' : 'Add')}
                    </motion.button>
                  </div>
                </div>

                {/* Ticket history */}
                {tickets.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10.5, color: C.muted, fontFamily: MONO, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                      {lang === 'ru' ? 'История обращений' : 'Tickets'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {tickets.slice(0, 10).map((tk) => (
                        <div key={tk.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', background: C.panelSolid,
                          border: `1px solid ${C.line}`, borderRadius: 10,
                        }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO }}>{tk.id}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{tk.category} · {fmtDate(tk.opened)}</div>
                          </div>
                          <span style={{
                            fontSize: 9.5, padding: '3px 8px', borderRadius: 999, fontFamily: MONO, fontWeight: 700,
                            background: tk.status === 'closed' ? 'rgba(255,255,255,0.06)' : 'rgba(61,255,102,0.12)',
                            color: tk.status === 'closed' ? C.muted : C.brand,
                            letterSpacing: '0.04em', textTransform: 'uppercase',
                          }}>{tk.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═════════════ CONFIRM CLOSE ═════════════ */}
        <AnimatePresence>
          {confirmClose && activeTicket && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmClose(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1100, padding: 24, backdropFilter: 'blur(8px)',
              }}
            >
              <motion.div
                initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#141518', border: `1px solid ${C.lineHi}`,
                  borderRadius: 20, padding: 22, maxWidth: 340, width: '100%',
                }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
                  {lang === 'ru' ? 'Закрыть обращение?' : 'Close ticket?'}
                </div>
                <div style={{ fontSize: 13, color: C.soft, lineHeight: 1.4, marginBottom: 18 }}>
                  {lang === 'ru'
                    ? `${activeTicket.id} будет помечено как решённое. История чата сохранится.`
                    : `${activeTicket.id} will be marked resolved. Chat history is preserved.`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmClose(false)}
                    style={{
                      flex: 1, padding: '11px', borderRadius: 12,
                      background: C.panelHi, border: `1px solid ${C.line}`, color: C.text, fontWeight: 600, fontSize: 13,
                    }}>
                    {lang === 'ru' ? 'Отмена' : 'Cancel'}
                  </button>
                  <button onClick={handleCloseTicket}
                    style={{
                      flex: 1, padding: '11px', borderRadius: 12,
                      background: C.red, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none',
                      boxShadow: `0 6px 18px rgba(255,82,102,0.35)`,
                    }}>
                    {lang === 'ru' ? 'Закрыть' : 'Close'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  )
}

/* ─────────── small components ─────────── */
function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: C.panelSolid, border: `1px solid ${C.line}`, borderRadius: 12,
      padding: '10px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 17, fontWeight: 800, color, letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: 9.5, color: C.muted, fontFamily: MONO, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

const menuBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 12px', textAlign: 'left',
  background: 'transparent', color: C.text,
  fontSize: 13, fontWeight: 500, borderRadius: 8,
  border: 'none', cursor: 'pointer', width: '100%',
}
