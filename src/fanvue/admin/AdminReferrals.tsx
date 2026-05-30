import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import CryptoLogo from '../components/CryptoLogo'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { tgNotify, notifyUser, notifyAdmin } from '../utils/tgNotify'
import type { RefWithdrawal } from '../store/types'

type Tab = 'pending' | 'all'

const STATUS_COLOR: Record<RefWithdrawal['status'], string> = {
  pending:   '#F0B90B',
  completed: 'var(--success)',
  rejected:  '#ff5050',
}

const STATUS_LABEL_RU: Record<RefWithdrawal['status'], string> = {
  pending:   '⏳ Ожидает',
  completed: '✅ Выплачено',
  rejected:  '❌ Отклонено',
}

const STATUS_LABEL_EN: Record<RefWithdrawal['status'], string> = {
  pending:   '⏳ Pending',
  completed: '✅ Paid',
  rejected:  '❌ Rejected',
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
  const creditRefBalance = useStore((s) => s.creditRefBalance)
  const lang = useStore((s) => s.lang)

  return (
    <div className="col gap-2" style={{ marginTop: 8 }}>
      <input
        className="input"
        style={{ fontSize: 12 }}
        placeholder="TX hash"
        value={tx}
        onChange={(e) => setTx(e.target.value)}
      />
      <div className="row gap-2">
        <motion.button
          className="btn btn-primary btn-sm"
          style={{ flex: 1, fontSize: 12 }}
          onClick={() => {
            const w = useStore.getState().refWithdrawals.find((x) => x.id === id)
            if (!w) return
            completeRefWithdrawal(id, tx || '')
            const net = CRYPTO_OPTIONS.find((o) => o.id === w.network)
            const userMsg = [
              '✅ Реферальная выплата одобрена!',
              '',
              `💰 Сумма: $${w.amount.toFixed(2)}`,
              `💎 Валюта: ${net?.name ?? w.network.toUpperCase()}`,
              tx ? `🔗 TxID: ${tx}` : '',
              '',
              'Спасибо, что используете Fanvue Market!',
              'Рады сотрудничеству 🤝',
            ].filter(Boolean).join('\n')
            if (w.uid) notifyUser(w.uid, userMsg)
            notifyAdmin(`✅ Вывод одобрен\n🆔 ${w.id}\n💵 $${w.amount.toFixed(2)} · ${net?.name ?? w.network}\n${tx ? `🔗 ${tx}` : ''}`)
          }}
          whileTap={{ scale: 0.97 }}
        >
          {lang === 'ru' ? '✓ Подтвердить выплату' : '✓ Confirm Payout'}
        </motion.button>
        <motion.button
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, fontSize: 12, color: '#ff5050' }}
          onClick={() => setShowReason((v) => !v)}
          whileTap={{ scale: 0.97 }}
        >
          {lang === 'ru' ? '✕ Отклонить' : '✕ Reject'}
        </motion.button>
      </div>

      {showReason && (
        <div className="col gap-2" style={{ marginTop: 4 }}>
          <textarea
            className="input"
            style={{ fontSize: 12, minHeight: 60, resize: 'vertical' }}
            placeholder={lang === 'ru' ? 'Причина отклонения (увидит пользователь)' : 'Reject reason (user will see)'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <motion.button
            className="btn btn-sm"
            style={{ fontSize: 12, background: '#ff5050', color: '#fff' }}
            disabled={!reason.trim()}
            onClick={() => {
              const trimmed = reason.trim()
              if (!trimmed) return
              const w = useStore.getState().refWithdrawals.find((x) => x.id === id)
              if (w && w.status === 'pending') {
                creditRefBalance(w.amount)
              }
              updateRefWithdrawal(id, {
                status: 'rejected',
                completedAt: new Date().toISOString(),
                rejectReason: trimmed,
              })
              if (w?.uid) {
                notifyUser(w.uid, [
                  '❌ Заявка на вывод отклонена',
                  '',
                  `🆔 ${w.id}`,
                  `💵 $${w.amount.toFixed(2)} возвращены на реф. баланс`,
                  '',
                  `📝 Причина: ${trimmed}`,
                  '',
                  'Если у вас есть вопросы — обратитесь в поддержку.',
                ].join('\n'))
              }
              notifyAdmin([
                '❌ Вывод отклонён',
                w ? `🆔 ${w.id}` : '',
                w ? `💵 $${w.amount.toFixed(2)} возвращены` : '',
                `📝 ${trimmed}`,
              ].filter(Boolean).join('\n'))
              setShowReason(false)
              setReason('')
            }}
            whileTap={{ scale: 0.97 }}
          >
            {lang === 'ru' ? 'Подтвердить отклонение' : 'Confirm reject'}
          </motion.button>
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
      <div className="page adm2-page">
        {/* HERO */}
        <div className="adm2-hero">
          <div>
            <div className="adm2-hero-eyebrow">{lang === 'ru' ? 'Финансы' : 'Finance'}</div>
            <div className="adm2-hero-title">
              {lang === 'ru' ? 'Реф. ' : 'Ref '}<span>{lang === 'ru' ? 'выводы' : 'payouts'}</span>
            </div>
            <div className="adm2-hero-sub">
              {lang === 'ru' ? 'Обработайте заявки рефералов' : 'Process referral requests'}
            </div>
          </div>
        </div>

        {/* KPI */}
        <div className="adm2-kpi-grid mb-4">
          <div className="adm2-kpi" style={{ ['--kpi-accent' as never]: '57,255,99' }}>
            <div className="adm2-kpi-top">
              <div className="adm2-kpi-ic">⏳</div>
            </div>
            <div className="adm2-kpi-val">{pending.length}</div>
            <div className="adm2-kpi-lbl">{lang === 'ru' ? 'Ожидают' : 'Pending'}</div>
          </div>
          <div className="adm2-kpi" style={{ ['--kpi-accent' as never]: '118,163,116' }}>
            <div className="adm2-kpi-top">
              <div className="adm2-kpi-ic">💰</div>
            </div>
            <div className="adm2-kpi-val">${totalOut.toFixed(2)}</div>
            <div className="adm2-kpi-lbl">{lang === 'ru' ? 'К выплате' : 'To pay'}</div>
          </div>
        </div>

        {user && user.ref_balance > 0 && (
          <div className="adm2-att-row mb-3" style={{ cursor: 'default' }}>
            <span className="adm2-att-dot" style={{ background: '#94c592' }} />
            <div className="adm2-att-body">
              <div className="t-xs t-muted">
                {lang === 'ru' ? 'Реф. баланс пользователя' : 'User ref balance'}
              </div>
              <div className="t-md fw-black" style={{ color: '#39ff63' }}>
                ${user.ref_balance.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Segmented tabs */}
        <div className="adm2-segment mb-4" style={{ display: 'flex', width: '100%' }}>
          {(['pending', 'all'] as Tab[]).map((tb) => (
            <button
              key={tb}
              className={`adm2-seg-btn${tab === tb ? ' is-active' : ''}`}
              onClick={() => setTab(tb)}
              style={{ flex: 1, position: 'relative' }}
            >
              {tab === tb && (
                <motion.span className="adm2-seg-pill" layoutId="adm2-refseg" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>
                {tb === 'pending'
                  ? `${lang === 'ru' ? 'Ожидают' : 'Pending'} (${pending.length})`
                  : `${lang === 'ru' ? 'Все' : 'All'} (${refWithdrawals.length})`}
              </span>
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="t-sm t-muted" style={{ textAlign: 'center', paddingTop: 40 }}>
            {tab === 'pending'
              ? (lang === 'ru' ? 'Нет заявок на ожидании' : 'No pending requests')
              : (lang === 'ru' ? 'Нет выводов' : 'No withdrawals')}
          </div>
        ) : (
          <div className="col gap-3">
            <AnimatePresence>
              {list.map((w, i) => (
                <motion.div
                  key={w.id}
                  className="adm2-att-row"
                  style={{ padding: '14px 16px', cursor: 'default', display: 'block' }}
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
                      <motion.button
                        className="t-xs t-brand fw-bold"
                        style={{ marginTop: 10, display: 'block' }}
                        onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                        whileTap={{ scale: 0.95 }}
                      >
                        {expanded === w.id
                          ? (lang === 'ru' ? '▲ Скрыть' : '▲ Hide')
                          : (lang === 'ru' ? '▼ Выплатить' : '▼ Pay Out')}
                      </motion.button>
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
