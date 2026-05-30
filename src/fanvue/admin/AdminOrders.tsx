import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore } from '../store'
import { api } from '../store/api'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import type { Order, OrderStatus, OrderKind } from '../store/types'
import { AdminSegmented, AdminEmpty, AdminSheet, AdminConfirmSheet, AdminMeta, AdminCard, admStatusClass } from './ui'

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
  const syncAdminData = useStore((s) => s.syncAdminData)

  useEffect(() => {
    syncAdminData()
  }, [syncAdminData])

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

  const handleIssueBalance = async () => {
    const amt = parseFloat(balAmt)
    if (!amt || amt <= 0 || !open?.uid) {
      toast.show(lang === 'ru' ? 'Нет UID пользователя' : 'Missing user UID', 'error')
      return
    }
    if (api.isEnabled()) {
      const res = await api.adminIssueBalance(open.uid, amt)
      if (!res || typeof res !== 'object') {
        toast.show(lang === 'ru' ? 'Ошибка сервера' : 'Server error', 'error')
        return
      }
      await syncAdminData()
    }
    haptic('success')
    toast.show(lang === 'ru' ? `+$${amt.toFixed(2)} зачислено` : `+$${amt.toFixed(2)} credited`, 'success')
    setBalSent(true)
    setBalAmt('')
    setTimeout(() => setBalSent(false), 2500)
  }

  const handleVerify = async (o: Order) => {
    haptic('success')
    if (api.isEnabled()) {
      const status = o.status === 'pending' && o.kind === 'buy' ? 'paid' : 'completed'
      const res = await api.adminPatchOrder(o.id, { status })
      if (!res) {
        toast.show(lang === 'ru' ? 'Ошибка сервера' : 'Server error', 'error')
        return
      }
      await syncAdminData()
    } else {
      setOrderStatus(o.id, 'completed')
    }
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

  const handleReject = async (o: Order) => {
    haptic('error')
    if (api.isEnabled()) {
      const res = await api.adminPatchOrder(o.id, { status: 'expired' })
      if (!res) {
        toast.show(lang === 'ru' ? 'Ошибка сервера' : 'Server error', 'error')
        return
      }
      await syncAdminData()
    } else {
      setOrderStatus(o.id, 'failed')
    }
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

  const doDelete = async () => {
    if (!confirmDelete) return
    if (api.isEnabled()) {
      await api.adminDeleteOrder(confirmDelete.id)
      await syncAdminData()
    } else {
      deleteOrder(confirmDelete.id)
    }
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
      <div className="adm-page">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <AdminSegmented
              options={([
                { id: 'all' as KindFilter, label: lang === 'ru' ? 'Все' : 'All' },
                { id: 'buy', label: lang === 'ru' ? 'Покупки' : 'Purchases' },
                { id: 'deposit', label: lang === 'ru' ? 'Депозиты' : 'Deposits' },
              ])}
              value={kind}
              onChange={setKind}
            />
          </div>
          <button type="button" className="adm-btn" onClick={handleExportCSV}>CSV</button>
        </div>

        <AdminSegmented
          options={STATUSES.map((s) => ({
            id: s,
            label: s === 'all' ? (lang === 'ru' ? 'Все' : 'All') : t(`status_${s}` as never),
          }))}
          value={filter}
          onChange={setFilter}
        />

        <div className="col gap-3" style={{ marginTop: 14 }}>
          {filtered.map((o, i) => (
            <motion.button
              type="button"
              key={o.id}
              className="adm-menu-item"
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
                  <span className={admStatusClass(o.status)}>{t(`status_${o.status}` as never)}</span>
                  <span className="t-xs t-muted">{o.id}</span>
                </div>
              </div>
              <div className="t-md fw-black" style={{ color: 'var(--adm-accent)' }}>${o.amount.toFixed(2)}</div>
            </motion.button>
          ))}
          {filtered.length === 0 && (
            <AdminEmpty>{lang === 'ru' ? 'Заказы не найдены' : 'No orders found'}</AdminEmpty>
          )}
        </div>
      </div>

      <AdminSheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.product_title ?? (lang === 'ru' ? 'Заказ' : 'Order')}
      >
        {open && (
          <>
            <AdminMeta rows={[
              { label: 'ID', value: <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{open.id}</span> },
              { label: lang === 'ru' ? 'Сумма' : 'Amount', value: <span style={{ color: 'var(--adm-accent)' }}>${open.amount.toFixed(2)}</span> },
              { label: lang === 'ru' ? 'Статус' : 'Status', value: <span className={admStatusClass(open.status)}>{t(`status_${open.status}` as never)}</span> },
              ...(open.provider ? [{ label: lang === 'ru' ? 'Сеть' : 'Network', value: <span style={{ textTransform: 'uppercase' }}>{open.provider}</span> }] : []),
              { label: lang === 'ru' ? 'Создан' : 'Created', value: fmt(open.created) },
              ...(open.paid_at ? [{ label: lang === 'ru' ? 'Оплачен' : 'Paid', value: fmt(open.paid_at) }] : []),
            ]} />

            {open.status === 'pending' && (
              <div className="adm-btn-row adm-btn-row--col" style={{ marginBottom: 12 }}>
                <button type="button" className="adm-btn adm-btn--primary adm-btn--block" onClick={() => handleVerify(open)}>
                  {t('admin_verify_payment')}
                </button>
                <button type="button" className="adm-btn adm-btn--danger adm-btn--block" onClick={() => handleReject(open)}>
                  {t('admin_reject_payment')}
                </button>
              </div>
            )}

            {open.status === 'paid' && open.kind === 'buy' && (
              <button type="button" className="adm-btn adm-btn--primary adm-btn--block" style={{ marginBottom: 12 }} onClick={() => handleVerify(open)}>
                {t('admin_mark_completed')}
              </button>
            )}

            {open.kind === 'buy' && (
              <AdminCard className="mb-3">
                <div className="adm-section-label" style={{ marginBottom: 8 }}>
                  {lang === 'ru' ? 'Выдача клиенту' : 'Delivery to client'}
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--adm-muted)', lineHeight: 1.45 }}>
                  {lang === 'ru'
                    ? 'Логин, пароль, почта — клиент увидит в заказе.'
                    : 'Credentials — visible in client order.'}
                </p>
                <textarea
                  className="adm-input"
                  rows={10}
                  placeholder={DELIVERY_PLACEHOLDER}
                  value={deliveryDraft}
                  onChange={(e) => setDeliveryDraft(e.target.value)}
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre' }}
                />
                <button type="button" className="adm-btn adm-btn--primary adm-btn--block" style={{ marginTop: 10 }} onClick={() => handleIssueDelivery(open)}>
                  {open.deliveryData
                    ? (lang === 'ru' ? 'Обновить выдачу' : 'Update delivery')
                    : (lang === 'ru' ? 'Выдать клиенту' : 'Issue to client')}
                </button>
              </AdminCard>
            )}

            <button type="button" className="adm-btn adm-btn--danger adm-btn--block" style={{ marginBottom: 12 }} onClick={() => handleDelete(open)}>
              {t('admin_delete')}
            </button>

            <AdminCard>
              <div className="adm-section-label" style={{ marginBottom: 8 }}>
                {lang === 'ru' ? 'Зачислить баланс' : 'Credit balance'}
              </div>
              <div className="row gap-2">
                <input
                  className="adm-input"
                  type="number"
                  inputMode="decimal"
                  placeholder="$0.00"
                  value={balAmt}
                  onChange={(e) => setBalAmt(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="adm-btn adm-btn--primary adm-btn--sm"
                  onClick={handleIssueBalance}
                  disabled={!balAmt || balSent}
                >
                  {balSent ? 'OK' : lang === 'ru' ? 'Зачислить' : 'Add'}
                </button>
              </div>
            </AdminCard>

            <button type="button" className="adm-btn adm-btn--block" style={{ marginTop: 12 }} onClick={() => setOpen(null)}>
              {t('close')}
            </button>
          </>
        )}
      </AdminSheet>

      <AdminConfirmSheet
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
