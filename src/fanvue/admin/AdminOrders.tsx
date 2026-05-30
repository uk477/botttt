import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import ConfirmSheet from '../components/ConfirmSheet'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import type { Order, OrderStatus, OrderKind } from '../store/types'

const STATUSES: Array<OrderStatus | 'all'> = ['all', 'pending', 'paid', 'completed', 'failed', 'expired']
type KindFilter = 'all' | OrderKind

function fmt(iso: string) {
  return new Date(iso).toLocaleString()
}

export default function AdminOrders() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const orders = useStore((s) => s.orders)
  const setOrderStatus = useStore((s) => s.setOrderStatus)
  const setOrderDelivery = useStore((s) => s.setOrderDelivery)
  const deleteOrder = useStore((s) => s.deleteOrder)
  const addLog = useStore((s) => s.addLog)
  const toast = useToast()
  const { haptic } = useTelegram()
  const [filter, setFilter]   = useState<OrderStatus | 'all'>('all')
  const [kind,   setKind]     = useState<KindFilter>('all')
  const [open,   setOpen]     = useState<Order | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null)
  const [balAmt, setBalAmt]   = useState('')
  const [balSent, setBalSent] = useState(false)
  const [deliveryDraft, setDeliveryDraft] = useState('')
  const updateBalance = useStore((s) => s.updateBalance)

  // Sync draft when opening a different order
  useEffect(() => {
    setDeliveryDraft(open?.deliveryData ?? '')
  }, [open?.id, open?.deliveryData])

  const DELIVERY_PLACEHOLDER = `fanvue/\nЛогин: \nПароль: \n\nПочта/\nЛогин: \nПароль: \n\nИнструкция по работе с аккаунтом:\n`

  const handleIssueDelivery = (o: Order) => {
    const txt = deliveryDraft.trim()
    if (!txt) {
      toast.show(lang === 'ru' ? 'Заполните данные выдачи' : 'Fill delivery data', 'error')
      return
    }
    haptic('success')
    setOrderDelivery(o.id, txt)
    addLog({
      ts: new Date().toISOString(),
      uid: 0,
      username: 'manual',
      kind: o.kind,
      amount: o.amount,
      network: o.provider as never,
      status: 'success',
      product: o.product_title,
    })
    toast.show(lang === 'ru' ? 'Данные выданы клиенту' : 'Delivery issued', 'success')
    setOpen(null)
  }

  const filtered = useMemo(() => {
    let list = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
    if (kind !== 'all') list = list.filter((o) => o.kind === kind)
    return list
  }, [orders, filter, kind])

  const handleIssueBalance = () => {
    const amt = parseFloat(balAmt)
    if (!amt || amt <= 0) return
    updateBalance(amt)
    haptic('success')
    toast.show(lang === 'ru' ? `+$${amt.toFixed(2)} зачислено` : `+$${amt.toFixed(2)} credited`, 'success')
    setBalSent(true)
    setBalAmt('')
    setTimeout(() => setBalSent(false), 2500)
  }

  const handleVerify = (o: Order) => {
    haptic('success')
    setOrderStatus(o.id, 'completed')
    addLog({
      ts: new Date().toISOString(),
      uid: 0,
      username: 'manual',
      kind: o.kind,
      amount: o.amount,
      network: o.provider as never,
      status: 'success',
      product: o.product_title,
    })
    toast.show(lang === 'ru' ? 'Заказ подтверждён' : 'Order verified', 'success')
    setOpen(null)
  }

  const handleReject = (o: Order) => {
    haptic('error')
    setOrderStatus(o.id, 'failed')
    addLog({
      ts: new Date().toISOString(),
      uid: 0,
      username: 'manual',
      kind: o.kind,
      amount: o.amount,
      network: o.provider as never,
      status: 'failed',
      product: o.product_title,
    })
    toast.show(lang === 'ru' ? 'Заказ отклонён' : 'Order rejected', 'error')
    setOpen(null)
  }

  const handleDelete = (o: Order) => setConfirmDelete(o)

  const doDelete = () => {
    if (!confirmDelete) return
    deleteOrder(confirmDelete.id)
    haptic('success')
    toast.show(lang === 'ru' ? 'Удалено' : 'Deleted', 'info')
    setConfirmDelete(null)
    setOpen(null)
  }

  const handleExportCSV = () => {
    const header = 'ID,Тип,Товар,Сумма,Статус,Сеть,Создан,Оплачен\n'
    const rows = filtered.map((o) =>
      [o.id, o.kind, o.product_title ?? '', o.amount.toFixed(2), o.status, o.provider ?? '', o.created.slice(0,16), o.paid_at?.slice(0,16) ?? ''].join(',')
    ).join('\n')
    const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `orders_${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.show(lang === 'ru' ? `Экспорт: ${filtered.length} записей` : `Exported ${filtered.length} rows`, 'success')
  }

  return (
    <PageTransition>
      <div className="page">
        {/* Kind filter + export */}
        <div className="row-between mb-3">
          <div className="row gap-2">
            {(['all', 'buy', 'deposit'] as KindFilter[]).map((k) => (
              <motion.button
                key={k}
                className={`btn btn-sm ${kind === k ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setKind(k)}
                whileTap={{ scale: 0.95 }}
              >
                {k === 'all' ? (lang === 'ru' ? 'Все' : 'All') : k === 'buy' ? '📦' : '💳'}
              </motion.button>
            ))}
          </div>
          <motion.button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, gap: 5 }}
            onClick={handleExportCSV}
            whileTap={{ scale: 0.95 }}
          >
            📊 CSV
          </motion.button>
        </div>

        {/* Status filter */}
        <div className="chip-row mb-4">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`chip${filter === s ? ' active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? (lang === 'ru' ? 'Все' : 'All') : t(`status_${s}` as never)}
            </button>
          ))}
        </div>

        <div className="col gap-3">
          {filtered.map((o, i) => (
            <motion.div
              key={o.id}
              className="card"
              style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => setOpen(o)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: o.kind === 'deposit' ? 'rgba(73,242,100,0.12)' : 'rgba(151,114,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: o.kind === 'deposit' ? 'var(--brand)' : 'var(--purple)', flexShrink: 0,
              }}>
                {o.kind === 'deposit'
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-sm fw-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {o.product_title ?? (o.kind === 'deposit' ? 'Deposit' : 'Order')}
                </div>
                <div className="row gap-2 mt-1">
                  <span className={`badge badge-${o.status}`}>{t(`status_${o.status}` as never)}</span>
                  <span className="t-xs t-muted">{o.id}</span>
                </div>
              </div>
              <div className="t-md fw-black">${o.amount.toFixed(2)}</div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center t-muted" style={{ padding: 40 }}>
              {lang === 'ru' ? 'Заказы не найдены' : 'No orders found'}
            </div>
          )}
        </div>
      </div>

      {/* Order action sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(null) }}
          >
            <motion.div
              className="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              style={{ maxHeight: '90dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
            >
              <motion.div
                className="sheet-handle"
                style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 12px', cursor: 'grab', touchAction: 'none' }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.3 }}
                onDragEnd={(_, info) => { if (info.offset.y > 80) setOpen(null) }}
              />

              <div className="t-lg fw-black mb-3">
                {open.product_title ?? (lang === 'ru' ? 'Заказ' : 'Order')}
              </div>

              <div className="card mb-4" style={{ padding: 0 }}>
                <div className="meta-row">
                  <span className="t-xs t-muted">ID</span>
                  <span className="t-xs fw-bold" style={{ fontFamily: 'monospace' }}>{open.id}</span>
                </div>
                <div className="meta-row">
                  <span className="t-xs t-muted">{lang === 'ru' ? 'Сумма' : 'Amount'}</span>
                  <span className="t-md fw-black t-purple">${open.amount.toFixed(2)}</span>
                </div>
                <div className="meta-row">
                  <span className="t-xs t-muted">{lang === 'ru' ? 'Статус' : 'Status'}</span>
                  <span className={`badge badge-${open.status}`}>{t(`status_${open.status}` as never)}</span>
                </div>
                {open.provider && (
                  <div className="meta-row">
                    <span className="t-xs t-muted">{lang === 'ru' ? 'Сеть' : 'Network'}</span>
                    <span className="t-xs fw-bold" style={{ textTransform: 'uppercase' }}>{open.provider}</span>
                  </div>
                )}
                <div className="meta-row">
                  <span className="t-xs t-muted">{lang === 'ru' ? 'Создан' : 'Created'}</span>
                  <span className="t-xs">{fmt(open.created)}</span>
                </div>
                {open.paid_at && (
                  <div className="meta-row">
                    <span className="t-xs t-muted">{lang === 'ru' ? 'Оплачен' : 'Paid'}</span>
                    <span className="t-xs">{fmt(open.paid_at)}</span>
                  </div>
                )}
              </div>

              {open.status === 'pending' && (
                <div className="col gap-3">
                  <motion.button
                    className="btn btn-primary"
                    style={{ background: 'var(--g-success)' }}
                    onClick={() => handleVerify(open)}
                    whileTap={{ scale: 0.97 }}
                  >
                    {t('admin_verify_payment')}
                  </motion.button>
                  <motion.button
                    className="btn btn-danger"
                    onClick={() => handleReject(open)}
                    whileTap={{ scale: 0.97 }}
                  >
                    {t('admin_reject_payment')}
                  </motion.button>
                </div>
              )}

              {(open.status === 'paid' && open.kind === 'buy') && (
                <motion.button
                  className="btn btn-primary"
                  onClick={() => handleVerify(open)}
                  whileTap={{ scale: 0.97 }}
                >
                  {t('admin_mark_completed')}
                </motion.button>
              )}

              {/* Delivery data — only for buy orders */}
              {open.kind === 'buy' && (
                <div className="card mt-4" style={{ padding: 14 }}>
                  <div className="t-sm fw-bold mb-2">
                    📦 {lang === 'ru' ? 'Данные для выдачи клиенту' : 'Delivery data for client'}
                  </div>
                  <div className="t-xs t-muted mb-2">
                    {lang === 'ru'
                      ? 'Заполните логин/пароль аккаунта и почты. Эти данные клиент увидит в своём заказе.'
                      : 'Fill in account & email credentials. The client will see this in their order.'}
                  </div>
                  <textarea
                    className="input"
                    rows={10}
                    placeholder={DELIVERY_PLACEHOLDER}
                    value={deliveryDraft}
                    onChange={(e) => setDeliveryDraft(e.target.value)}
                    style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre' }}
                  />
                  <motion.button
                    className="btn btn-primary mt-2"
                    style={{ background: 'var(--g-success, #39ff63)', color: '#0a0a0a' }}
                    onClick={() => handleIssueDelivery(open)}
                    whileTap={{ scale: 0.97 }}
                  >
                    {open.deliveryData
                      ? (lang === 'ru' ? '💾 Обновить выдачу' : '💾 Update delivery')
                      : (lang === 'ru' ? '🚀 Выдать клиенту' : '🚀 Issue to client')}
                  </motion.button>
                </div>
              )}



              <motion.button
                className="btn btn-secondary mt-3"
                onClick={() => handleDelete(open)}
                whileTap={{ scale: 0.97 }}
                style={{ color: 'var(--red)' }}
              >
                🗑 {t('admin_delete')}
              </motion.button>

              {/* Issue balance */}
              <div className="card mt-4" style={{ padding: '14px' }}>
                <div className="t-sm fw-bold mb-2">💰 {lang === 'ru' ? 'Выдать баланс клиенту' : 'Issue balance to client'}</div>
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
                    onClick={handleIssueBalance}
                    disabled={!balAmt || balSent}
                    whileTap={{ scale: 0.95 }}
                  >
                    {balSent ? '✓' : lang === 'ru' ? 'Зачислить' : 'Add'}
                  </motion.button>
                </div>
              </div>

              <motion.button
                className="btn btn-secondary mt-3"
                onClick={() => setOpen(null)}
                whileTap={{ scale: 0.97 }}
              >
                {t('close')}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmSheet
        open={!!confirmDelete}
        title={t('admin_confirm_delete')}
        message={confirmDelete?.product_title ?? confirmDelete?.id}
        confirmLabel={lang === 'ru' ? 'Удалить' : 'Delete'}
        cancelLabel={lang === 'ru' ? 'Отмена' : 'Cancel'}
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </PageTransition>
  )
}
