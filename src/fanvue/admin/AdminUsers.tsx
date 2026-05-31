import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import SearchBar from '../components/SearchBar'
import { api } from '../store/api'
import { AdminEmpty, AdminSheet, AdminCard } from './ui'

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
  const syncAdminData = useStore((s) => s.syncAdminData)
  const toast = useToast()
  const { haptic } = useTelegram()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [balAmt, setBalAmt] = useState('')
  const [refAmt, setRefAmt] = useState('')
  const [serverUsers, setServerUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!api.isEnabled()) return
    setLoading(true)
    api.adminUsers().then((res) => {
      if (Array.isArray(res)) setServerUsers(res as UserRow[])
      setLoading(false)
    }).catch(() => setLoading(false))
    syncAdminData()
  }, [syncAdminData])

  const allUsers: UserRow[] = useMemo(() => {
    if (!api.isEnabled()) {
      return storeUser ? [{
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
      }] : []
    }
    const list = [...serverUsers]
    if (storeUser && !list.some((u) => u.uid === storeUser.uid)) {
      list.unshift({
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
      })
    }
    return list.map((u) => ({
      ...u,
      isReal: u.uid === storeUser?.uid ? true : u.isReal,
    }))
  }, [serverUsers, storeUser])

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
    if (!amt || amt <= 0 || !selected) return
    const serverAuthoritative = api.isEnabled()
    if (serverAuthoritative) {
      const saved = await api.adminIssueBalance(selected.uid, amt)
      if (!saved || typeof saved !== 'object') {
        toast.show(lang === 'ru' ? 'Не удалось сохранить баланс на сервере' : 'Failed to save balance on server', 'error')
        return
      }
      await refreshUser()
      const res = await api.adminUsers()
      if (Array.isArray(res)) setServerUsers(res as UserRow[])
    }
    if (!serverAuthoritative && selected.isReal) updateBalance(amt)
    haptic('success')
    toast.show(`+$${amt.toFixed(2)} зачислено на основной баланс`, 'success')
    setBalAmt('')
    setSelected((prev) => prev ? { ...prev, balance: prev.balance + amt } : null)
  }

  const handleCreditRef = async () => {
    const amt = parseFloat(refAmt)
    if (!amt || amt <= 0 || !selected?.isReal) return
    if (api.isEnabled()) {
      const res = await api.adminCreditRef(selected.uid, amt)
      if (!res || typeof res !== 'object' || !(res as { ok?: boolean }).ok) {
        toast.show(lang === 'ru' ? 'Ошибка сервера' : 'Server error', 'error')
        return
      }
      await syncAdminData()
      await refreshUser()
      const rb = Number((res as { ref_balance?: number }).ref_balance)
      setSelected((prev) => prev ? { ...prev, ref_balance: Number.isFinite(rb) ? rb : prev.ref_balance + amt } : null)
    } else {
      creditRefBalance(amt)
      setSelected((prev) => prev ? { ...prev, ref_balance: prev.ref_balance + amt } : null)
    }
    haptic('success')
    toast.show(`+$${amt.toFixed(2)} зачислено на реф. баланс`, 'success')
    setRefAmt('')
  }

  const initials = (name: string) => name.split(' ').map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('')

  return (
    <PageTransition>
      <div className="adm-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--adm-muted)' }}>
            {loading ? (lang === 'ru' ? 'Загрузка…' : 'Loading…') : (
              <>
                {filtered.length} {lang === 'ru' ? 'всего' : 'total'} ·{' '}
                {filtered.filter((u) => u.purchases > 0).length} {lang === 'ru' ? 'с покупками' : 'buyers'}
              </>
            )}
          </p>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={() => {
              const header = 'UID,Username,Name,Balance,Spent,Purchases,Ref Earned,Ref Count\n'
              const rows = filtered.map((u) =>
                [u.uid, u.username, u.full_name, u.balance.toFixed(2), u.spent.toFixed(2), u.purchases, u.ref_earned.toFixed(2), u.ref_count].join(',')
              ).join('\n')
              const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' })
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
              a.download = `users_${Date.now()}.csv`; a.click()
              toast.show(lang === 'ru' ? `Экспорт: ${filtered.length}` : `Exported ${filtered.length}`, 'success')
            }}
          >
            CSV
          </button>
        </div>

        <div className="mb-3">
          <SearchBar value={search} onChange={setSearch} placeholder={t('admin_user_search')} />
        </div>

        {filtered.length === 0 && !loading && (
          <AdminEmpty>
            {lang === 'ru' ? 'Пользователи появятся после первого входа в мини-апп.' : 'Users appear after opening the mini app.'}
          </AdminEmpty>
        )}

        <div className="col gap-3">
          {filtered.map((u, i) => (
            <motion.div
              key={u.uid}
              className="adm-menu-item"
              style={u.isReal ? { borderColor: 'rgba(61, 220, 132, 0.35)' } : undefined}
              onClick={() => { setSelected(u); setBalAmt(''); setRefAmt('') }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              whileTap={{ scale: 0.98 }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: u.isReal ? 'var(--adm-accent)' : 'var(--adm-surface-2)',
                border: u.isReal ? 'none' : '1px solid var(--adm-border)',
                color: u.isReal ? '#0a0f0c' : 'var(--adm-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, flexShrink: 0,
                boxShadow: u.isReal ? 'none' : 'none',
              }}>
                {initials(u.full_name || u.username || '?')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-sm fw-bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {u.full_name || u.username || `UID ${u.uid}`}
                  {u.isReal && <span className="adm-menu-badge" style={{ fontSize: 9 }}>YOU</span>}
                </div>
                <div className="t-xs t-muted">@{u.username || '—'} · {u.uid}</div>
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                <div className="t-sm fw-black" style={{ color: 'var(--adm-accent)' }}>${u.balance.toFixed(0)}</div>
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

      <AdminSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.full_name || selected?.username || 'User'}
      >
        {selected && (
          <>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--adm-muted)' }}>
              @{selected.username || '—'} · UID {selected.uid}
            </p>
            <div className="adm-mini-stats">
              <div className="adm-mini-stat">
                <div className="adm-mini-stat-value">${selected.balance.toFixed(2)}</div>
                <div className="adm-mini-stat-label">{lang === 'ru' ? 'Баланс' : 'Balance'}</div>
              </div>
              <div className="adm-mini-stat">
                <div className="adm-mini-stat-value">${selected.ref_balance.toFixed(2)}</div>
                <div className="adm-mini-stat-label">{lang === 'ru' ? 'Реф. баланс' : 'Ref balance'}</div>
              </div>
              <div className="adm-mini-stat">
                <div className="adm-mini-stat-value">{selected.purchases}</div>
                <div className="adm-mini-stat-label">{lang === 'ru' ? 'Покупок' : 'Purchases'}</div>
              </div>
              <div className="adm-mini-stat">
                <div className="adm-mini-stat-value">{selected.ref_count}</div>
                <div className="adm-mini-stat-label">{lang === 'ru' ? 'Рефералов' : 'Referrals'}</div>
              </div>
            </div>
            <div className="adm-meta" style={{ marginBottom: 12 }}>
              <div className="adm-meta-row">
                <span className="adm-meta-label">{lang === 'ru' ? 'Потрачено' : 'Spent'}</span>
                <span className="adm-meta-value">${selected.spent.toFixed(2)}</span>
              </div>
              <div className="adm-meta-row">
                <span className="adm-meta-label">{lang === 'ru' ? 'Реф. заработано' : 'Ref earned'}</span>
                <span className="adm-meta-value">${selected.ref_earned.toFixed(2)}</span>
              </div>
              <div className="adm-meta-row">
                <span className="adm-meta-label">{lang === 'ru' ? 'Активность' : 'Last seen'}</span>
                <span className="adm-meta-value">{fmtDate(selected.last_seen)}</span>
              </div>
            </div>
            <AdminCard style={{ marginBottom: 12 }}>
              <div className="adm-section-label" style={{ marginBottom: 8 }}>
                {lang === 'ru' ? 'Основной баланс' : 'Main balance'}
              </div>
              <div className="row gap-2">
                <input className="adm-input" type="number" inputMode="decimal" placeholder="$0.00" value={balAmt} onChange={(e) => setBalAmt(e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" disabled={!balAmt || parseFloat(balAmt) <= 0} onClick={handleCreditBalance}>
                  {lang === 'ru' ? 'Зачислить' : 'Credit'}
                </button>
              </div>
            </AdminCard>
            {selected.isReal && (
              <AdminCard style={{ marginBottom: 12 }}>
                <div className="adm-section-label" style={{ marginBottom: 8 }}>
                  {lang === 'ru' ? 'Реф. баланс' : 'Ref balance'}
                </div>
                <div className="row gap-2">
                  <input className="adm-input" type="number" inputMode="decimal" placeholder="$0.00" value={refAmt} onChange={(e) => setRefAmt(e.target.value)} style={{ flex: 1 }} />
                  <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" disabled={!refAmt || parseFloat(refAmt) <= 0} onClick={handleCreditRef}>
                    {lang === 'ru' ? 'Зачислить' : 'Credit'}
                  </button>
                </div>
              </AdminCard>
            )}
            <button type="button" className="adm-btn adm-btn--block" onClick={() => setSelected(null)}>{t('close')}</button>
          </>
        )}
      </AdminSheet>
    </PageTransition>
  )
}
