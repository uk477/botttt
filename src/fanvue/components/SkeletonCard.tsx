import { motion } from 'framer-motion'

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] },
  }),
}

export function ProductCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      custom={index}
      style={{
        borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="skel" style={{ width: '100%', aspectRatio: '4/3', borderRadius: 12 }} />
      <div className="skel" style={{ width: '75%', height: 16 }} />
      <div className="skel" style={{ width: '50%', height: 14 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div className="skel" style={{ width: 60, height: 20 }} />
        <div className="skel" style={{ width: 40, height: 14 }} />
      </div>
    </motion.div>
  )
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid-2">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} index={i} />
      ))}
    </div>
  )
}
