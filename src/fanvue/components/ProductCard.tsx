import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { useStore } from '../store'
import type { Product } from '../store/types'

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.28, delay: Math.min(i, 5) * 0.025, ease: [0.16, 1, 0.3, 1] },
  }),
}

function BoltIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
function ClockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}
function PlaceholderIcon({ catId }: { catId: number }) {
  const variants: Record<number, JSX.Element> = {
    1: (
      <svg viewBox="0 0 48 48" fill="none">
        <path d="M14 18l10-7 10 7v3H14v-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <rect x="14" y="22" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
        <circle cx="24" cy="29" r="2.5" fill="currentColor"/>
      </svg>
    ),
    2: (
      <svg viewBox="0 0 48 48" fill="none">
        <path d="M24 8l3.5 7 7.5 1-5.5 5.5 1.5 8L24 26l-6.5 3.5 1.5-8L13.5 16l7.5-1L24 8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      </svg>
    ),
    3: (
      <svg viewBox="0 0 48 48" fill="none">
        <path d="M10 20l14-8 14 8M10 20v14l14 8 14-8V20M10 20l14 8 14-8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      </svg>
    ),
  }
  return (
    <div style={{
      width: 'calc(100% + 28px)', aspectRatio: '4/3', borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(232,54,93,0.10) 0%, rgba(151,114,255,0.06) 100%)',
      border: '1px solid rgba(232,54,93,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(232,54,93,0.7)', margin: '-14px -14px 0',
    }}>
      <div style={{ width: 56, height: 56 }}>{variants[catId] ?? variants[1]}</div>
    </div>
  )
}

export default function ProductCard({ product, index = 0, disableNav = false }: { product: Product; index?: number; disableNav?: boolean }) {
  const navigate = useNavigate()
  const t = useT()
  const lang = useStore((s) => s.lang)
  const photos = useStore((s) => s.photos)
  const photo = photos[`product_${product.id}`]
  const title = lang === 'ru' ? product.title : product.title_en
  const isAuto = product.delivery === 'auto'
  // Для авто-выдачи не показываем количество в наличии — только лейбл «Авто».
  // Реальная проверка пула делается в момент покупки.
  const soldOut = !isAuto && product.stock === 0
  const lowStock = !isAuto && product.stock > 0 && product.stock <= 5
  const dimmed = !product.active || soldOut
  const stockText = isAuto
    ? (lang === 'ru' ? 'Авто' : 'Auto')
    : soldOut
      ? (lang === 'ru' ? 'Нет в наличии' : 'Out of stock')
      : lowStock
        ? (lang === 'ru' ? `${product.stock} осталось` : `${product.stock} left`)
        : `${product.stock} ${t('in_stock')}`

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      custom={index}
      whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 400, damping: 22 } }}
      whileHover={{ y: -2 }}
      onClick={disableNav ? undefined : () => navigate(`/product/${product.id}`)}
      style={{
        position: 'relative',
        borderRadius: 18, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: disableNav ? 'default' : 'pointer',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 6px 18px -8px rgba(0,0,0,0.5)',
        opacity: dimmed ? 0.55 : 1,
        overflow: 'hidden',
        transition: 'border-color 220ms, box-shadow 220ms',
      }}
    >
      {photo ? (
        <div style={{ position: 'relative', width: 'calc(100% + 28px)', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', margin: '-14px -14px 0' }}>
          <img src={photo} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" decoding="async" />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.35) 100%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: 8, right: 8,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 999,
            fontSize: 10, fontWeight: 700, lineHeight: 1, letterSpacing: 0.2,
            background: isAuto ? 'rgba(34,197,94,0.92)' : 'rgba(255,107,53,0.92)',
            color: 'white',
            backdropFilter: 'blur(8px)',
          }}>
            {isAuto ? <BoltIcon /> : <ClockIcon />}
            {t(isAuto ? 'delivery_auto' : 'delivery_manual')}
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <PlaceholderIcon catId={product.cat_id} />
          <div style={{
            position: 'absolute', top: 8, right: 8,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 999,
            fontSize: 10, fontWeight: 700, lineHeight: 1, letterSpacing: 0.2,
            background: isAuto ? 'rgba(34,197,94,0.18)' : 'rgba(255,107,53,0.18)',
            color: isAuto ? '#22C55E' : '#FF7A35',
            border: `1px solid ${isAuto ? 'rgba(34,197,94,0.3)' : 'rgba(255,107,53,0.3)'}`,
          }}>
            {isAuto ? <BoltIcon /> : <ClockIcon />}
            {t(isAuto ? 'delivery_auto' : 'delivery_manual')}
          </div>
        </div>
      )}

      <div style={{
        fontSize: 14, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.01em',
        color: 'var(--t-primary)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {title}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', gap: 8 }}>
        <div style={{
          fontSize: 19, fontWeight: 900, letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 50%, rgba(255,255,255,0.7) 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1,
        }}>
          ${product.price.toFixed(product.price % 1 === 0 ? 0 : 2)}
        </div>
        {soldOut ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.2 }}>
            {stockText}
          </span>
        ) : lowStock ? (
          <motion.span
            animate={{ opacity: [1, 0.55, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 800, color: '#FF3B47',
              padding: '3px 7px', borderRadius: 999,
              background: 'rgba(255,59,71,0.1)',
              border: '1px solid rgba(255,59,71,0.25)',
              letterSpacing: 0.2,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF3B47' }} />
            {stockText}
          </motion.span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--t-muted)', fontWeight: 600 }}>
            {stockText}
          </span>
        )}
      </div>
    </motion.div>
  )
}
