import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import ConfirmSheet from '../components/ConfirmSheet'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import type { Product } from '../store/types'
import AccountsPoolEditor from './AccountsPoolEditor'
import { api } from '../store/api'

const EMPTY: Product = {
  id: 0, cat_id: 1,
  title: '', title_en: '', description: '', desc_en: '',
  price: 0, delivery: 'auto', stock: 0, active: true, autoItems: [],
}

export default function AdminProducts() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const products = useStore((s) => s.products)
  const categories = useStore((s) => s.categories)
  const upsert = useStore((s) => s.upsertProduct)
  const remove = useStore((s) => s.deleteProduct)
  const pinned = useStore((s) => s.pinnedProductIds)
  const pinProduct = useStore((s) => s.pinProduct)
  const unpinProduct = useStore((s) => s.unpinProduct)
  const syncAdminData = useStore((s) => s.syncAdminData)
  const toast = useToast()

  useEffect(() => {
    syncAdminData()
  }, [syncAdminData])
  const { haptic } = useTelegram()
  const [editing, setEditing] = useState<Product | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)

  const startNew = () => {
    haptic('light')
    setEditing({ ...EMPTY, id: Date.now() })
  }

  const save = () => {
    if (!editing) return
    if (!editing.title.trim() || editing.price <= 0) {
      toast.show(lang === 'ru' ? 'Заполните название и цену' : 'Fill title and price', 'error')
      return
    }
    upsert(editing)
    toast.show(lang === 'ru' ? 'Сохранено' : 'Saved', 'success')
    haptic('success')
    setEditing(null)
  }

  const handleDelete = (p: Product) => setConfirmDelete(p)

  const doDelete = () => {
    if (!confirmDelete) return
    remove(confirmDelete.id)
    haptic('success')
    toast.show(lang === 'ru' ? 'Удалено' : 'Deleted', 'info')
    setConfirmDelete(null)
  }

  return (
    <PageTransition>
      <div className="page">
        <motion.button
          className="btn btn-primary mb-4"
          onClick={startNew}
          whileTap={{ scale: 0.97 }}
        >
          + {t('admin_add_product')}
        </motion.button>

        <div className="col gap-3">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              className="card"
              style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 12 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--surface-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--brand)', flexShrink: 0,
              }}>
                {p.delivery === 'auto'
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-sm fw-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lang === 'ru' ? p.title : p.title_en}
                </div>
                <div className="t-xs t-muted">${p.price.toFixed(2)} · {p.stock} {t('in_stock')}</div>
              </div>
              <div className="row gap-2">
                <motion.button
                  onClick={() => pinned.includes(p.id) ? unpinProduct(p.id) : pinProduct(p.id)}
                  title={pinned.includes(p.id) ? 'Убрать из популярных' : 'Закрепить в популярных'}
                  style={{ width: 32, height: 32, borderRadius: 8, background: pinned.includes(p.id) ? 'rgba(232,54,93,0.18)' : 'var(--surface-hover)', color: pinned.includes(p.id) ? 'var(--brand)' : 'var(--t-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}
                  whileTap={{ scale: 0.88 }}
                >
                  {pinned.includes(p.id) ? '★' : '☆'}
                </motion.button>
                <button
                  onClick={() => setEditing(p)}
                  style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-hover)', color: 'var(--t-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: 'var(--red)', fontSize: 14 }}
                >
                  🗑
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Editor modal */}
      <AnimatePresence>
        {editing && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditing(null) }}
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
                style={{ cursor: 'grab', touchAction: 'none' }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.3 }}
                onDragEnd={(_, info) => { if (info.offset.y > 80) setEditing(null) }}
              />
              <div className="t-lg fw-black mb-4">
                {editing.id && products.some((p) => p.id === editing.id)
                  ? t('admin_edit_product')
                  : t('admin_add_product')}
              </div>

              <div className="col gap-3">
                <input
                  className="input"
                  placeholder={lang === 'ru' ? 'Название (RU)' : 'Title (RU)'}
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Title (EN)"
                  value={editing.title_en}
                  onChange={(e) => setEditing({ ...editing, title_en: e.target.value })}
                />
                <textarea
                  className="input"
                  placeholder={lang === 'ru' ? 'Описание (RU)' : 'Description (RU)'}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                />
                <textarea
                  className="input"
                  placeholder="Description (EN)"
                  value={editing.desc_en}
                  onChange={(e) => setEditing({ ...editing, desc_en: e.target.value })}
                  rows={2}
                />
                <div className="row gap-3">
                  <input
                    className="input"
                    type="number"
                    placeholder="Price USD"
                    value={editing.price || ''}
                    onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Stock"
                    value={editing.stock || ''}
                    onChange={(e) => setEditing({ ...editing, stock: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <select
                  className="input"
                  value={editing.cat_id}
                  onChange={(e) => setEditing({ ...editing, cat_id: parseInt(e.target.value) })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{lang === 'ru' ? c.name : c.name_en}</option>
                  ))}
                </select>
                <select
                  className="input"
                  value={editing.delivery}
                  onChange={(e) => setEditing({ ...editing, delivery: e.target.value as 'auto' | 'manual' })}
                >
                  <option value="auto">{t('delivery_auto')}</option>
                  <option value="manual">{t('delivery_manual')}</option>
                </select>

                {editing.delivery === 'auto' && (
                  <AccountsPoolEditor
                    items={editing.autoItems ?? []}
                    onChange={(items) => setEditing({ ...editing, autoItems: items })}
                  />
                )}

                <motion.button className="btn btn-primary mt-3" onClick={save} whileTap={{ scale: 0.97 }}>
                  💾 {t('admin_save')}
                </motion.button>
                <motion.button className="btn btn-secondary" onClick={() => setEditing(null)} whileTap={{ scale: 0.97 }}>
                  {t('cancel')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmSheet
        open={!!confirmDelete}
        title={t('admin_confirm_delete')}
        message={confirmDelete ? (lang === 'ru' ? confirmDelete.title : confirmDelete.title_en) : undefined}
        confirmLabel={lang === 'ru' ? 'Удалить' : 'Delete'}
        cancelLabel={lang === 'ru' ? 'Отмена' : 'Cancel'}
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </PageTransition>
  )
}
