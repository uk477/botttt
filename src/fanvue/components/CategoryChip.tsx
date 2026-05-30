import { motion } from 'framer-motion'
import { useT } from '../i18n'
import { useStore } from '../store'
import type { Category } from '../store/types'

const AllIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
const CrownIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M5 20 3 8l4.5 4L12 4l4.5 8L21 8l-2 12"/></svg>
const CheckIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const BoxIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
const KeyIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
const StarIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>

function catIcon(emoji: string) {
  if (emoji === '👑' || emoji === '💎') return <CrownIcon />
  if (emoji === '✅' || emoji === '☑') return <CheckIcon />
  if (emoji === '📦' || emoji === '🎁') return <BoxIcon />
  if (emoji === '🔑' || emoji === '🗝') return <KeyIcon />
  return <StarIcon />
}

export default function CategoryChips({ active, onSelect }: {
  active: number | null
  onSelect: (id: number | null) => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const categories = useStore((s) => s.categories)

  return (
    <div className="chip-row mb-4">
      <motion.button
        className={`chip${active === null ? ' active' : ''}`}
        onClick={() => onSelect(null)}
        whileTap={{ scale: 0.95 }}
      >
        <AllIcon /> {t('market_all')}
      </motion.button>
      {categories.filter((c: Category) => c.active).map((cat: Category) => (
        <motion.button
          key={cat.id}
          className={`chip${active === cat.id ? ' active' : ''}`}
          onClick={() => onSelect(cat.id)}
          whileTap={{ scale: 0.95 }}
        >
          {catIcon(cat.emoji)} {lang === 'ru' ? cat.name : cat.name_en}
        </motion.button>
      ))}
    </div>
  )
}
