import { motion } from 'framer-motion'

export default function LoadingScreen() {
  return (
    <div className="fv-loader">
      <motion.div
        className="fv-loader-mark"
        initial={false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        F
      </motion.div>
      <motion.div className="fv-loader-bar" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  )
}
