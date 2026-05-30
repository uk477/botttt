import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

const variants = {
  initial: { opacity: 0, y: 12 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -6 },
}

export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="in"
      exit="out"
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ minHeight: '100%', willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  )
}
