import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import PageTransition from '../components/PageTransition'
import ProductCard from '../components/ProductCard'
import CategoryChips from '../components/CategoryChip'
import SearchBar from '../components/SearchBar'
import EmptyState from '../components/EmptyState'
import { useT } from '../i18n'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import NotificationBell from '../components/NotificationBell'
import PhotoUploader from '../components/PhotoUploader'
import { SettingsIcon } from '../components/NavIcons'
import { ProductGridSkeleton } from '../components/SkeletonCard'
import type { Product } from '../store/types'

type Sort = 'default' | 'price_asc' | 'price_desc' | 'popular'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }
const fadeUp = { hidden: { opacity: 0, y: 18, filter: 'blur(6px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }

const EMPTY_PRODUCT: Omit<Product, 'id'> = {
  cat_id: 1, title: '', title_en: '', description: '', desc_en: '',
  price: 0, delivery: 'auto', stock: 0, active: true,
}

function ProductEditSheet({
  product, onClose,
}: {
  product: Partial<Product> & { id?: number }
  onClose: () => void
}) {
  const lang     = useStore((s) => s.lang)
  const cats     = useStore((s) => s.categories)
  const upsert   = useStore((s) => s.upsertProduct)
  const del      = useStore((s) => s.deleteProduct)
  const { haptic } = useTelegram()
  const toast    = useToast()
  const isNew    = !product.id

  const [form, setForm] = useState<Omit<Product, 'id'>>({
    cat_id:      product.cat_id      ?? 1,
    title:       product.title       ?? '',
    title_en:    product.title_en    ?? '',
    description: product.description ?? '',
    desc_en:     product.desc_en     ?? '',
    price:       product.price       ?? 0,
    delivery:    product.delivery    ?? 'auto',
    stock:       product.stock       ?? 0,
    active:      product.active      ?? true,
  })

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim()) return toast.show(lang === 'ru' ? 'Введите название' : 'Enter title', 'error')
    const id = product.id ?? Date.now()
    upsert({ ...form, id })
    haptic('success')
    toast.show(
      isNew
        ? (lang === 'ru' ? 'Товар добавлен' : 'Product added')
        : (lang === 'ru' ? 'Товар обновлён' : 'Product updated'),
      'success',
    )
    onClose()
  }

  const handleDelete = () => {
    if (!product.id) return
    del(product.id)
    haptic('error')
    toast.show(lang === 'ru' ? 'Товар удалён' : 'Product deleted', 'success')
    onClose()
  }

  const inputStyle = {
    width: '100%', background: 'var(--surface)', border: '1px solid var(--b-default)',
    borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--t-primary)',
    marginTop: 4,
  }

  const Label = ({ text }: { text: string }) => (
    <div className="t-xs t-muted" style={{ marginBottom: 2, marginTop: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {text}
    </div>
  )

  return (
    <motion.div
      className="modal-overlay"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        style={{ maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}
      >
        <motion.div
          style={{ flexShrink: 0, paddingTop: 8, paddingBottom: 4, cursor: 'grab' }}
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.3 }}
          onDragEnd={(_, info) => { if (info.offset.y > 80) onClose() }}
        >
          <div className="sheet-handle" style={{ margin: '0 auto' }} />
        </motion.div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 var(--page-px) var(--page-px)' }}>
        <div className="row-between mb-4">
          <div className="t-md fw-black">
            {isNew
              ? (lang === 'ru' ? 'Новый товар' : 'New product')
              : (lang === 'ru' ? 'Редактировать' : 'Edit product')}
          </div>
          {!isNew && (
            <button
              onClick={handleDelete}
              style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              {lang === 'ru' ? 'Удалить' : 'Delete'}
            </button>
          )}
        </div>

        {/* Photo upload — only for existing products */}
        {product.id && (
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <PhotoUploader
              photoKey={`product_${product.id}`}
              label={lang === 'ru' ? 'Фото товара' : 'Product photo'}
              hint={lang === 'ru' ? 'Рекомендуем квадратное фото' : 'Square photo recommended'}
              aspect="square"
            />
          </div>
        )}

        <Label text={lang === 'ru' ? 'Название (RU)' : 'Title (RU)'} />
        <input style={inputStyle} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Название" />

        <Label text={lang === 'ru' ? 'Название (EN)' : 'Title (EN)'} />
        <input style={inputStyle} value={form.title_en} onChange={(e) => set('title_en', e.target.value)} placeholder="Title" />

        <Label text={lang === 'ru' ? 'Описание (RU)' : 'Description (RU)'} />
        <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Описание..." />

        <Label text={lang === 'ru' ? 'Описание (EN)' : 'Description (EN)'} />
        <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={form.desc_en} onChange={(e) => set('desc_en', e.target.value)} placeholder="Description..." />

        <div className="row gap-3 mt-2">
          <div style={{ flex: 1 }}>
            <Label text={lang === 'ru' ? 'Цена ($)' : 'Price ($)'} />
            <input style={inputStyle} type="number" min="0" step="0.01" value={form.price || ''} onChange={(e) => set('price', parseFloat(e.target.value) || 0)} placeholder="0.00" />
          </div>
          <div style={{ flex: 1 }}>
            <Label text={lang === 'ru' ? 'Остаток' : 'Stock'} />
            <input style={inputStyle} type="number" min="0" step="1" value={form.stock || ''} onChange={(e) => set('stock', parseInt(e.target.value) || 0)} placeholder="0" />
          </div>
        </div>

        <Label text={lang === 'ru' ? 'Категория' : 'Category'} />
        <div className="row gap-2" style={{ marginTop: 4, flexWrap: 'wrap' }}>
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => set('cat_id', c.id)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: form.cat_id === c.id ? 'var(--brand)' : 'var(--surface)',
                color: form.cat_id === c.id ? 'white' : 'var(--t-muted)',
                border: `1px solid ${form.cat_id === c.id ? 'var(--brand)' : 'var(--b-default)'}`,
              }}
            >
              {lang === 'ru' ? c.name : c.name_en}
            </button>
          ))}
        </div>

        <Label text={lang === 'ru' ? 'Тип доставки' : 'Delivery'} />
        <div className="row gap-2" style={{ marginTop: 4 }}>
          {(['auto', 'manual'] as const).map((d) => (
            <button
              key={d}
              onClick={() => set('delivery', d)}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: form.delivery === d ? 'rgba(232,54,93,0.12)' : 'var(--surface)',
                color: form.delivery === d ? 'var(--brand)' : 'var(--t-muted)',
                border: `1px solid ${form.delivery === d ? 'var(--brand)' : 'var(--b-default)'}`,
              }}
            >
              {d === 'auto'
                ? (lang === 'ru' ? 'Авто' : 'Instant')
                : (lang === 'ru' ? 'Ручная' : 'Manual')}
            </button>
          ))}
        </div>

        <div className="row gap-2 mt-2" style={{ marginTop: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
            />
            <span className="t-sm">{lang === 'ru' ? 'Активный товар' : 'Active product'}</span>
          </label>
        </div>

        <motion.button
          className="btn btn-primary mt-5"
          onClick={handleSave}
          whileTap={{ scale: 0.97 }}
        >
          {lang === 'ru' ? 'Сохранить' : 'Save'}
        </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function Market() {
  const t      = useT()
  const lang   = useStore((s) => s.lang)
  const navigate = useNavigate()
  const products = useStore((s) => s.products)
  const isAdmin  = useStore((s) => s.isAdmin)
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [search, setSearch]       = useState('')
  const [sort, setSort]           = useState<Sort>('default')
  const [editMode, setEditMode]   = useState(false)
  const [editProduct, setEditProduct] = useState<Partial<Product> & { id?: number } | null>(null)
  const admin = isAdmin()

  const allProducts = admin ? products : products.filter((p) => p.active)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let arr = allProducts.filter((p) => {
      if (!admin && !p.active) return false
      if (activeCat !== null && p.cat_id !== activeCat) return false
      if (!term) return true
      return (lang === 'ru' ? p.title : p.title_en).toLowerCase().includes(term)
        || (lang === 'ru' ? p.description : p.desc_en).toLowerCase().includes(term)
    })
    if (sort === 'price_asc') arr = [...arr].sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') arr = [...arr].sort((a, b) => b.price - a.price)
    if (sort === 'popular') arr = [...arr].sort((a, b) => b.stock - a.stock)
    return arr
  }, [allProducts, admin, activeCat, search, sort, lang])

  const sortLabels: Record<Sort, string> = lang === 'ru'
    ? { default: 'По умолчанию', price_asc: '↑ Цена', price_desc: '↓ Цена', popular: 'Популярные' }
    : { default: 'Default', price_asc: '↑ Price', price_desc: '↓ Price', popular: 'Popular' }

  return (
    <PageTransition>
      <motion.div className="page" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="pg-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--t-primary)' }}>
              {t('market_title')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t-muted)', fontWeight: 500 }}>
              {filtered.length} {lang === 'ru'
                ? (filtered.length === 1 ? 'товар' : 'товаров')
                : (filtered.length === 1 ? 'item' : 'items')}
            </div>
          </div>
          <div className="row gap-2">
            {admin && editMode && (
              <motion.button
                className="btn btn-primary btn-sm"
                style={{ height: 32, fontSize: 12 }}
                onClick={() => setEditProduct({ ...EMPTY_PRODUCT })}
                whileTap={{ scale: 0.95 }}
              >
                + {lang === 'ru' ? 'Товар' : 'Product'}
              </motion.button>
            )}
            {admin && (
              <motion.button
                className="card"
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 700,
                  color: editMode ? 'var(--brand)' : 'var(--t-muted)',
                  border: editMode ? '1px solid var(--b-accent)' : undefined,
                }}
                onClick={() => setEditMode((v) => !v)}
                whileTap={{ scale: 0.9 }}
              >
                {editMode ? (lang === 'ru' ? 'Готово' : 'Done') : (lang === 'ru' ? 'Изменить' : 'Edit')}
              </motion.button>
            )}
            <NotificationBell />
            <motion.button
              className="card"
              style={{ padding: 10, color: 'var(--t-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => navigate('/settings')}
              whileTap={{ scale: 0.9 }}
            >
              <SettingsIcon size={20} />
            </motion.button>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="mb-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={lang === 'ru' ? 'Поиск товаров...' : 'Search products...'}

          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <CategoryChips active={activeCat} onSelect={setActiveCat} />
        </motion.div>

        <motion.div variants={fadeUp} className="sort-row">
          {(['default', 'price_asc', 'price_desc', 'popular'] as Sort[]).map((s) => (
            <motion.button
              key={s}
              className={`sort-pill${sort === s ? ' active' : ''}`}
              onClick={() => setSort(s)}
              whileTap={{ scale: 0.93 }}
              animate={sort === s ? { scale: 1 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              {sortLabels[s]}
            </motion.button>
          ))}
        </motion.div>

        <motion.div variants={fadeUp}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeCat ?? 'all'}-${sort}-${search}`}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {allProducts.length === 0 && !search && activeCat === null ? (
                <ProductGridSkeleton count={6} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={search ? 'search' : 'box'}
                  title={search
                    ? (lang === 'ru' ? 'Ничего не найдено' : 'Nothing found')
                    : t('market_empty')}
                  hint={search
                    ? (lang === 'ru' ? `По запросу «${search}» товаров нет` : `No products for "${search}"`)
                    : undefined}
                  action={search ? {
                    label: lang === 'ru' ? 'Сбросить поиск' : 'Clear search',
                    onClick: () => setSearch(''),
                  } : undefined}
                />
              ) : (
                <div className="grid-2">
                  {filtered.map((p, i) => (
                    <div
                      key={p.id}
                      style={{ position: 'relative' }}
                      onClick={editMode ? () => setEditProduct(p) : undefined}
                    >
                      <ProductCard product={p} index={i} disableNav={editMode} />
                      {editMode && (
                        <motion.div
                          initial={false}
                          animate={{ opacity: 1 }}
                          style={{
                            position: 'absolute', inset: 0, borderRadius: 16,
                            background: 'rgba(232,54,93,0.08)',
                            border: '1.5px solid rgba(232,54,93,0.4)',
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
                            padding: 8, pointerEvents: 'none',
                          }}
                        >
                          <div style={{
                            background: 'var(--brand)', borderRadius: 8, padding: '4px 8px',
                            fontSize: 10, fontWeight: 800, color: 'white',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>
                            {lang === 'ru' ? 'Изменить' : 'Edit'}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {editProduct !== null && (
          <ProductEditSheet
            product={editProduct}
            onClose={() => setEditProduct(null)}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
