import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import SearchBar from '../components/SearchBar'
import { api } from '../store/api'

interface UserRow {
  uid: number
  username: string
  full_name: string
  balance: number
  ref_balance: number
  ref_earned: number
  ref_count: number
  spent: number
  purchases: number
  last_seen: string
  isReal?: boolean
}

const MOCK_USERS: UserRow[] = [
  { uid: 7891011, username: 'alex_m',  full_name: 'Alex M.',  balance: 45.00, ref_balance: 5.00,  ref_earned: 5.00,  ref_count: 1, spent: 87.95,  purchases: 4, last_seen: '2024-04-22T14:22:00Z' },
  { uid: 5556677, username: 'maria_k', full_name: 'Maria K.', balance: 20.00, ref_balance: 15.00, ref_earned: 15.00, ref_count: 3, spent: 165.40, purchases: 7, last_seen: '2024-04-22T13:18:00Z' },
  { uid: 9988776, username: 'bob_x',   full_name: 'Bob X.',   balance: 0.00,  ref_balance: 0.00,  ref_earned: 0.00,  ref_count: 0, spent: 45.99,  purchases: 2, last_seen: '2024-04-22T12:01:00Z' },
  { uid: 1122334, username: 'jane_d',  full_name: 'Jane D.',  balance: 88.50, ref_balance: 30.00, ref_earned: 30.00, ref_count: 6, spent: 234.50, purchases: 9, last_seen: '2024-04-22T10:45:00Z' },
  { uid: 4455667, username: 'mike_r',  full_name: 'Mike R.',  balance: 0.00,  ref_balance: 0.00,  ref_earned: 0.00,  ref_count: 0, spent: 0,      purchases: 0, last_seen: '2024-04-21T22:33:00Z' },
  { uid: 7766554, username: 'lisa_p',  full_name: 'Lisa P.',  balance: 12.00, ref_balance: 10.00, ref_earned: 10.00, ref_count: 2, spent: 56.99,  purchases: 3, last_seen: '2024-04-21T18:00:00Z' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminUsers() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const storeUser = useStore((s) => s.user)
  const updateBalance = useStore((s) => s.updateBalance)
  const refreshUser = useStore((s) => s.refreshUser)
  const creditRefBalance = useStore((s) => s.creditRefBalance)
  const toast = useToast()
  const { haptic } = useTelegram()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [balAmt, setBalAmt] = useState('')
  const [refAmt, setRefAmt] = useState('')

  const realUser: UserRow | null = storeUser ? {
    uid: storeUser.uid,
    username: storeUser.username,
    full_name: storeUser.full_name,
    balance: storeUser.balance,
    ref_balance: storeUser.ref_balance,
    ref_earned: storeUser.ref_earned,
    ref_count: storeUser.ref_count,
    spent: storeUser.spent,
    purchases: storeUser.purchases,
    last_seen: new Date().toISOString(),
    isReal: true,
  } : null

  const allUsers: UserRow[] = realUser
    ? [realUser, ...MOCK_USERS.filter((u) => u.uid !== realUser.uid)]
    : MOCK_USERS

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return allUsers
    return allUsers.filter((u) =>
      u.username.toLowerCase().includes(term) ||
      u.full_name.toLowerCase().includes(term) ||
      String(u.uid).includes(term)
    )
  }, [search, allUsers])

  const handleCreditBalance = async () => {
    const amt = parseFloat(balAmt)
    if (!amt || amt <= 0 || !selected?.isReal) return
    const serverAuthoritative = api.isEnabled()
    if (serverAuthoritative) {
      const saved = await api.adminIssueBalance(selected.uid, amt)
      if (!saved || typeof saved !== 'object') {
        toast.show(lang === 'ru' ? 'Не удалось сохранить баланс на сервере' : 'Failed to save balance on server', 'error')
        return
      }
      await refreshUser()
    }
    if (!serverAuthoritative) updateBalance(amt)
    haptic('success')
    toast.show(`+$${amt.toFixed(2)} зачислено на основной баланс`, 'success')
    setBalAmt('')
    setSelected((prev) => prev ? { ...prev, balance: prev.balance + amt } : null)
  }

  const handleCreditRef = () => {
    const amt = parseFloat(refAmt)
    if (!amt || amt <= 0 || !selected?.isReal) return
    creditRefBalance(amt)
    haptic('success')
    toast.show(`+$${amt.toFixed(2)} зачислено на реф. баланс`, 'success')
    setRefAmt('')
    setSelected((prev) => prev ? { ...prev, ref_balance: prev.ref_balance + amt } : null)
  }

  const initials = (name: string) => name.split(' ').map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('')

  return (
    <PageTransition>
      <div className="page adm2-page">
        {/* HERO */}
        <div className="adm2-hero">
          <div>
            <div className="adm2-hero-eyebrow">{lang === 'ru' ? 'Сообщество' : 'Community'}</div>
            <div className="adm2-hero-title">
              {lang === 'ru' ? 'Пользо' : 'Users '}<span>{lang === 'ru' ? 'ватели' : 'list'}</span>
            </div>
            <div className="adm2-hero-sub">
              {filtered.length} {lang === 'ru' ? 'всего · ' : 'total · '}
              {filtered.filter((u) => u.purchases > 0).length} {lang === 'ru' ? 'активных' : 'active'}
            </div>
          </div>
          <motion.button
            className="adm2-iconbtn"
            style={{ width: 'auto', padding: '0 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', gap: 6, color: '#39ff63' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const header = 'UID,Username,Name,Balance,Spent,Purchases,Ref Earned,Ref Count\n'
              const rows = filtered.map((u) =>
                [u.uid, u.username, u.full_name, u.balance.toFixed(2), u.spent.toFixed(2), u.purchases, u.ref_earned.toFixed(2), u.ref_count].join(',')
              ).join('\n')
              const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8' })
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
              a.download = `users_${Date.now()}.csv`; a.click()
              toast.show(lang === 'ru' ? `Экспорт: ${filtered.length}` : `Exported ${filtered.length}`, 'success')
            }}
          >
            ↓ CSV
          </motion.button>
        </div>

        <div className="mb-3">
          <SearchBar value={search} onChange={setSearch} placeholder={t('admin_user_search')} />
        </div>

        <div className="col gap-3">
          {filtered.map((u, i) => (
            <motion.div
              key={u.uid}
              className="adm2-att-row"
              style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderColor: u.isReal ? 'rgba(57,255,99,0.35)' : undefined }}
              onClick={() => { setSelected(u); setBalAmt(''); setRefAmt('') }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              whileTap={{ scale: 0.98 }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: u.isReal ? 'linear-gradient(135deg, #39ff63, #22e84f)' : 'rgba(255,255,255,0.04)',
                border: u.isReal ? 'none' : '1px solid rgba(255,255,255,0.08)',
                color: u.isReal ? '#051006' : 'var(--t-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, flexShrink: 0,
                boxShadow: u.isReal ? '0 4px 14px rgba(57,255,99,0.35)' : 'none',
              }}>
                {initials(u.full_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-sm fw-bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {u.full_name}
                  {u.isReal && <span style={{ fontSize: 9, fontWeight: 900, background: 'linear-gradient(135deg, #39ff63, #22e84f)', color: '#051006', borderRadius: 4, padding: '2px 5px', letterSpacing: '0.06em' }}>YOU</span>}
                </div>
                <div className="t-xs t-muted">@{u.username} · {u.uid}</div>
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                <div className="t-sm fw-black" style={{ color: '#39ff63' }}>${u.balance.toFixed(0)}</div>
                {u.ref_balance > 0 && (
                  <div className="t-xs fw-bold" style={{ color: '#94c592' }}>
                    ref: ${u.ref_balance.toFixed(0)}
                  </div>
                )}
                <div className="t-xs t-muted">{u.purchases} {lang === 'ru' ? 'покупок' : 'orders'}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* User detail sheet */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
          >
            <motion.div
              className="sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              style={{ maxHeight: '90dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
            >
              <motion.div
                className="sheet-handle"
                style={{ cursor: 'grab', touchAction: 'none' }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.3 }}
                onDragEnd={(_, info) => { if (info.offset.y > 80) setSelected(null) }}
              />

              {/* Header */}
              <div className="row gap-3 mb-4">
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: selected.isReal ? 'var(--g-brand)' : 'var(--surface-2)',
                  border: selected.isReal ? 'none' : '1.5px solid var(--b-default)',
                  color: selected.isReal ? 'white' : 'var(--t-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 900, flexShrink: 0,
                }}>
                  {initials(selected.full_name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-lg fw-black">{selected.full_name}</div>
                  <div className="t-xs t-muted">@{selected.username}</div>
                  <div className="t-xs t-muted">UID: {selected.uid}</div>
                </div>
                <motion.button onClick={() => setSelected(null)} whileTap={{ scale: 0.9 }} style={{ color: 'var(--t-muted)', fontSize: 22, lineHeight: 1, alignSelf: 'flex-start' }}>×</motion.button>
              </div>

              {/* Stats */}
              <div className="grid-2 gap-3 mb-4">
                <div className="stat-card">
                  <div className="stat-value t-gold">${selected.balance.toFixed(2)}</div>
                  <div className="stat-label">{lang === 'ru' ? 'Баланс' : 'Balance'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value t-brand">${selected.ref_balance.toFixed(2)}</div>
                  <div className="stat-label">{lang === 'ru' ? 'Реф. баланс' : 'Ref balance'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value t-purple">{selected.purchases}</div>
                  <div className="stat-label">{lang === 'ru' ? 'Покупок' : 'Purchases'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--cyan)' }}>{selected.ref_count}</div>
                  <div className="stat-label">{lang === 'ru' ? 'Рефералов' : 'Referrals'}</div>
                </div>
              </div>

              <div className="card mb-3" style={{ padding: '4px 0' }}>
                <div className="meta-row">
                  <span className="t-xs t-muted">{lang === 'ru' ? 'Потрачено' : 'Spent'}</span>
                  <span className="t-sm fw-black">${selected.spent.toFixed(2)}</span>
                </div>
                <div className="meta-row">
                  <span className="t-xs t-muted">{lang === 'ru' ? 'Реф. заработано' : 'Ref earned'}</span>
                  <span className="t-sm fw-black t-brand">${selected.ref_earned.toFixed(2)}</span>
                </div>
                <div className="meta-row">
                  <span className="t-xs t-muted">{lang === 'ru' ? 'Последняя активность' : 'Last seen'}</span>
                  <span className="t-xs">{fmtDate(selected.last_seen)}</span>
                </div>
              </div>

              {selected.isReal ? (
                <>
                  {/* Credit main balance */}
                  <div className="card mb-3" style={{ padding: '14px 16px' }}>
                    <div className="t-sm fw-bold mb-2">
                      💰 {lang === 'ru' ? 'Зачислить основной баланс' : 'Credit main balance'}
                    </div>
                    <div className="row gap-2">
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        placeholder="$0.00"
                        value={balAmt}
                        onChange={(e) => setBalAmt(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <motion.button
                        className="btn btn-primary btn-sm"
                        style={{ flexShrink: 0 }}
                        disabled={!balAmt || parseFloat(balAmt) <= 0}
                        onClick={handleCreditBalance}
                        whileTap={{ scale: 0.95 }}
                      >
                        {lang === 'ru' ? 'Зачислить' : 'Credit'}
                      </motion.button>
                    </div>
                  </div>

                  {/* Credit ref balance */}
                  <div className="card mb-4" style={{ padding: '14px 16px' }}>
                    <div className="t-sm fw-bold mb-2">
                      🎁 {lang === 'ru' ? 'Зачислить реф. баланс' : 'Credit ref balance'}
                    </div>
                    <div className="row gap-2">
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        placeholder="$0.00"
                        value={refAmt}
                        onChange={(e) => setRefAmt(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <motion.button
                        className="btn btn-primary btn-sm"
                        style={{ flexShrink: 0, background: 'var(--g-success)' }}
                        disabled={!refAmt || parseFloat(refAmt) <= 0}
                        onClick={handleCreditRef}
                        whileTap={{ scale: 0.95 }}
                      >
                        {lang === 'ru' ? 'Зачислить' : 'Credit'}
                      </motion.button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card mb-4" style={{ padding: '14px', background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.2)' }}>
                  <div className="t-xs" style={{ color: 'var(--orange)' }}>
                    ⚠️ {lang === 'ru' ? 'Это тестовый пользователь (не интерактивен в demo-режиме)' : 'This is a test user (not interactive in demo mode)'}
                  </div>
                </div>
              )}

              <motion.button className="btn btn-secondary" onClick={() => setSelected(null)} whileTap={{ scale: 0.97 }}>
                {t('close')}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
