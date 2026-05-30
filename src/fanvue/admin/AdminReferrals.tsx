import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import CryptoLogo from '../components/CryptoLogo'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { api } from '../store/api'
import { tgNotify, notifyUserTemplated, notifyAdmin } from '../utils/tgNotify'
import { adminRefApproved, adminRefRejected } from '../../../shared/telegramTemplates'
import type { RefWithdrawal } from '../store/types'
import { AdminSegmented, AdminStat, AdminEmpty, AdminCard } from './ui'

type Tab = 'pending' | 'all'

const STATUS_COLOR: Record<RefWithdrawal['status'], string> = {
  pending:   '#F0B90B',
  completed: 'var(--success)',
  rejected:  '#ff5050',
}

const STATUS_LABEL_RU: Record<RefWithdrawal['status'], string> = {
  pending:   'Ожидает',
  completed: 'Выплачено',
  rejected:  'Отклонено',
}

const STATUS_LABEL_EN: Record<RefWithdrawal['status'], string> = {
  pending:   'Pending',
  completed: 'Paid',
  rejected:  'Rejected',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function TxidInput({ id }: { id: string }) {
  const [tx, setTx] = useState('')
  const [reason, setReason] = useState('')
  const [showReason, setShowReason] = useState(false)
  const completeRefWithdrawal = useStore((s) => s.completeRefWithdrawal)
  const updateRefWithdrawal = useStore((s) => s.updateRefWithdrawal)
  const syncAdminData = useStore((s) => s.syncAdminData)
  const lang = useStore((s) => s.lang)

  return (
    <div className="col gap-2" style={{ marginTop: 8 }}>
      <input
        className="adm-input"
        style={{ fontSize: 12 }}
        placeholder="TX hash"
        value={tx}
        onChange={(e) => setTx(e.target.value)}
      />
      <div className="adm-btn-row">
        <button
          type="button"
          className="adm-btn adm-btn--primary adm-btn--sm"
          style={{ flex: 1 }}
          onClick={async () => {
            const w = useStore.getState().refWithdrawals.find((x) => x.id === id)
            if (!w) return
            if (api.isEnabled()) {
              const res = await api.adminSetRefStatus(id, { action: 'approve', txid: tx || '' })
              if (!res) return
              await syncAdminData()
            } else {
              completeRefWithdrawal(id, tx || '')
            }
            const net = CRYPTO_OPTIONS.find((o) => o.id === w.network)
            if (w.uid) {
              notifyUserTemplated(w.uid, 'ref_approved', {
                amountUsd: w.amount,
                cryptoName: net?.name ?? w.network.toUpperCase(),
                txid: tx || undefined,
                refId: w.id,
              }, lang)
            }
            notifyAdmin(
              adminRefApproved({
                refId: w.id,
                amountUsd: w.amount,
                network: net?.name ?? w.network,
                txid: tx || undefined,
              }),
            )
          }}
        >
          {lang === 'ru' ? 'Подтвердить выплату' : 'Confirm payout'}
        </button>
        <button
          type="button"
          className="adm-btn adm-btn--sm adm-btn--danger"
          style={{ flex: 1 }}
          onClick={() => setShowReason((v) => !v)}
        >
          {lang === 'ru' ? 'Отклонить' : 'Reject'}
        </button>
      </div>

      {showReason && (
        <div className="col gap-2" style={{ marginTop: 4 }}>
          <textarea
            className="adm-input"
            style={{ fontSize: 12, minHeight: 60, resize: 'vertical' }}
            placeholder={lang === 'ru' ? 'Причина отклонения (увидит пользователь)' : 'Reject reason (user will see)'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            className="adm-btn adm-btn--sm adm-btn--danger adm-btn--block"
            disabled={!reason.trim()}
            onClick={async () => {
              const trimmed = reason.trim()
              if (!trimmed) return
              const w = useStore.getState().refWithdrawals.find((x) => x.id === id)
              if (!w) return
              if (api.isEnabled()) {
                const res = await api.adminSetRefStatus(id, { action: 'reject', reason: trimmed })
                if (!res) return
                await syncAdminData()
              } else {
                updateRefWithdrawal(id, {
                  status: 'rejected',
                  completedAt: new Date().toISOString(),
                  rejectReason: trimmed,
                })
              }
              if (w.uid) {
                notifyUserTemplated(w.uid, 'ref_rejected', {
                  amountUsd: w.amount,
                  refId: w.id,
                  reason: trimmed,
                }, lang)
              }
              notifyAdmin(
                adminRefRejected({
                  refId: w.id,
                  amountUsd: w.amount,
                  reason: trimmed,
                }),
              )
              setShowReason(false)
              setReason('')
            }}
          >
            {lang === 'ru' ? 'Подтвердить отклонение' : 'Confirm reject'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminReferrals() {
  const refWithdrawals = useStore((s) => s.refWithdrawals)
  const user = useStore((s) => s.user)
  const lang = useStore((s) => s.lang)
  const [tab, setTab] = useState<Tab>('pending')
  const [expanded, setExpanded] = useState<string | null>(null)

  const pending  = refWithdrawals.filter((w) => w.status === 'pending')
  const list     = tab === 'pending' ? pending : refWithdrawals
  const totalOut = pending.reduce((s, w) => s + w.amount, 0)
  const statusLabel = lang === 'ru' ? STATUS_LABEL_RU : STATUS_LABEL_EN

  return (
    <PageTransition>
      <div className="adm-page">
        <div className="adm-stats" style={{ marginBottom: 12 }}>
          <AdminStat label={lang === 'ru' ? 'Ожидают' : 'Pending'} value={String(pending.length)} />
          <AdminStat label={lang === 'ru' ? 'К выплате' : 'To pay'} value={`$${totalOut.toFixed(2)}`} />
        </div>

        {user && user.ref_balance > 0 && (
          <AdminCard className="mb-3">
            <div style={{ fontSize: 11, color: 'var(--adm-muted)' }}>{lang === 'ru' ? 'Ваш реф. баланс' : 'Your ref balance'}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--adm-accent)', marginTop: 4 }}>${user.ref_balance.toFixed(2)}</div>
          </AdminCard>
        )}

        <AdminSegmented
          options={([
            { id: 'pending' as Tab, label: `${lang === 'ru' ? 'Ожидают' : 'Pending'} (${pending.length})` },
            { id: 'all' as Tab, label: `${lang === 'ru' ? 'Все' : 'All'} (${refWithdrawals.length})` },
          ])}
          value={tab}
          onChange={setTab}
        />

        {list.length === 0 ? (
          <AdminEmpty>
            {tab === 'pending'
              ? (lang === 'ru' ? 'Нет заявок в ожидании' : 'No pending requests')
              : (lang === 'ru' ? 'Нет выводов' : 'No withdrawals')}
          </AdminEmpty>
        ) : (
          <div className="col gap-3" style={{ marginTop: 14 }}>
            <AnimatePresence>
              {list.map((w, i) => (
                <motion.div
                  key={w.id}
                  className="adm-card"
                  style={{ padding: '14px 16px' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
                    <CryptoLogo network={w.network} size={36} showBadge />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row-between mb-1">
                        <span className="t-md fw-black">${w.amount.toFixed(2)}</span>
                        <span className="t-xs fw-bold" style={{ color: STATUS_COLOR[w.status] }}>
                          {statusLabel[w.status]}
                        </span>
                      </div>
                      <div className="t-xs t-muted mb-1">{formatDate(w.createdAt)}</div>
                      <div
                        className="t-xs"
                        style={{
                          fontFamily: 'monospace',
                          background: 'var(--surface-2)',
                          borderRadius: 6,
                          padding: '4px 8px',
                          wordBreak: 'break-all',
                          cursor: 'pointer',
                        }}
                        onClick={() => { navigator.clipboard?.writeText(w.address) }}
                        title={lang === 'ru' ? 'Копировать' : 'Copy'}
                      >
                        {w.address}
                      </div>
                      {w.txid && (
                        <div className="t-xs t-muted mt-1" style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          TX: {w.txid}
                        </div>
                      )}
                    </div>
                  </div>

                  {w.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        className="adm-btn adm-btn--sm"
                        style={{ marginTop: 10, width: '100%' }}
                        onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                      >
                        {expanded === w.id
                          ? (lang === 'ru' ? 'Скрыть' : 'Hide')
                          : (lang === 'ru' ? 'Выплатить' : 'Pay out')}
                      </button>
                      <AnimatePresence>
                        {expanded === w.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <TxidInput id={w.id} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
