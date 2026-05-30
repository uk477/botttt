import { motion } from 'framer-motion'

const PRESETS = [1, 2, 3, 5, 10]

export default function QuantitySelector({
  value, onChange, max = 99
}: {
  value: number
  onChange: (v: number) => void
  max?: number
}) {
  const set = (v: number) => onChange(Math.max(1, Math.min(max, v)))

  return (
    <div>
      <div className="qty">
        <motion.button
          className="qty-btn"
          onClick={() => set(value - 1)}
          whileTap={{ scale: 0.85 }}
          disabled={value <= 1}
        >
          −
        </motion.button>
        <motion.span
          key={value}
          className="qty-val"
          initial={false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          {value}
        </motion.span>
        <motion.button
          className="qty-btn"
          onClick={() => set(value + 1)}
          whileTap={{ scale: 0.85 }}
          disabled={value >= max}
        >
          +
        </motion.button>
      </div>
      <div className="qty-presets">
        {PRESETS.filter((p) => p <= max).map((p) => (
          <motion.button
            key={p}
            className={`qty-preset${value === p ? ' active' : ''}`}
            onClick={() => set(p)}
            whileTap={{ scale: 0.92 }}
          >
            {p}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
