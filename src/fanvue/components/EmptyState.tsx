import { motion } from 'framer-motion'

function SearchEmptyIcon() {
  return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
}
function BoxEmptyIcon() {
  return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
function ChatEmptyIcon() {
  return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}

const ICON_MAP: Record<string, () => JSX.Element> = {
  search: SearchEmptyIcon,
  box:    BoxEmptyIcon,
  chat:   ChatEmptyIcon,
}

export default function EmptyState({
  icon = 'box', title, hint, action,
}: {
  icon?: string
  title: string
  hint?: string
  action?: { label: string; onClick: () => void }
}) {
  const Icon = ICON_MAP[icon] ?? BoxEmptyIcon

  return (
    <motion.div
      className="empty-state"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="empty-icon"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon />
      </motion.div>
      <div className="t-md fw-bold">{title}</div>
      {hint && <div className="t-xs t-muted text-center" style={{ maxWidth: 280, marginTop: 6 }}>{hint}</div>}
      {action && (
        <motion.button className="btn btn-primary mt-5" style={{ maxWidth: 240 }} onClick={action.onClick} whileTap={{ scale: 0.96 }}>
          {action.label}
        </motion.button>
      )}
    </motion.div>
  )
}
