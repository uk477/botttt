import { motion, AnimatePresence } from 'framer-motion'

export default function SearchBar({
  value, onChange, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        className="search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <AnimatePresence>
        {value && (
          <motion.button
            className="search-clear"
            initial={false}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onChange('')}
          >
            ✕
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
