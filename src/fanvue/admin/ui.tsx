import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export function admStatusClass(status: string) {
  return `adm-badge adm-badge--${status}`
}

export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="adm-section" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>{title}</h2>
        {subtitle && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.4 }}>{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  )
}

export function AdminSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="adm-section">
      {label && <div className="adm-section-label">{label}</div>}
      {children}
    </section>
  )
}

export function AdminCard({
  children,
  variant,
  className = '',
  style,
}: {
  children: ReactNode
  variant?: 'warn' | 'danger'
  className?: string
  style?: React.CSSProperties
}) {
  const v = variant === 'warn' ? ' adm-card--warn' : variant === 'danger' ? ' adm-card--danger' : ''
  return <div className={`adm-card${v} ${className}`.trim()} style={style}>{children}</div>
}

export function AdminStat({
  label,
  value,
  hint,
  trend,
}: {
  label: string
  value: string
  hint?: string
  trend?: { pct: number; label?: string }
}) {
  const up = (trend?.pct ?? 0) >= 0
  return (
    <div className="adm-stat">
      <div className="adm-stat-value">{value}</div>
      <div className="adm-stat-label">{label}</div>
      {trend && (
        <div className={`adm-stat-trend ${up ? 'up' : 'down'}`}>
          {up ? '↑' : '↓'} {Math.abs(trend.pct).toFixed(0)}% {trend.label ?? ''}
        </div>
      )}
      {hint && <div className="adm-stat-hint">{hint}</div>}
    </div>
  )
}

export function AdminMenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="adm-section">
      <div className="adm-section-label">{title}</div>
      {children}
    </section>
  )
}

export function AdminMenuItem({
  icon,
  title,
  description,
  path,
  badge,
  color,
}: {
  icon: ReactNode
  title: string
  description?: string
  path: string
  badge?: string | number
  color?: string
}) {
  const navigate = useNavigate()
  return (
    <button type="button" className="adm-menu-item" onClick={() => navigate(path)}>
      <div className="adm-menu-icon" style={color ? { color, background: `${color}18` } : undefined}>
        {icon}
      </div>
      <div className="adm-menu-body">
        <div className="adm-menu-title">{title}</div>
        {description && <div className="adm-menu-desc">{description}</div>}
      </div>
      {badge != null && badge !== 0 && <span className="adm-menu-badge">{badge}</span>}
      <span className="adm-menu-arrow" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </span>
    </button>
  )
}

export function AdminTask({
  title,
  subtitle,
  dotColor,
  onClick,
  right,
}: {
  title: string
  subtitle: string
  dotColor: string
  onClick: () => void
  right?: ReactNode
}) {
  return (
    <button type="button" className="adm-task" onClick={onClick}>
      <span className="adm-task-dot" style={{ background: dotColor }} />
      <div className="adm-task-meta">
        <div className="adm-task-title">{title}</div>
        <div className="adm-task-sub">{subtitle}</div>
      </div>
      {right ?? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--adm-dim)' }}><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      )}
    </button>
  )
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="adm-empty">{children}</div>
}

export function AdminSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="adm-seg">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? 'is-active' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function AdminToggle({ on, onToggle, label, description }: {
  on: boolean
  onToggle: () => void
  label: string
  description?: string
}) {
  return (
    <div className="adm-toggle-row">
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 4 }}>{description}</div>}
      </div>
      <button
        type="button"
        className={`adm-toggle${on ? ' is-on' : ''}`}
        onClick={onToggle}
        aria-pressed={on}
      >
        <span className="adm-toggle-knob" />
      </button>
    </div>
  )
}

export function AdminMeta({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <div className="adm-meta">
      {rows.map((r, i) => (
        <div key={i} className="adm-meta-row">
          <span className="adm-meta-label">{r.label}</span>
          <span className="adm-meta-value">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

export function AdminSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="adm-sheet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            className="adm-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="adm-sheet-handle"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80) onClose() }}
            />
            {title && <h2 className="adm-sheet-title">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AdminConfirmSheet({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AdminSheet open={open} onClose={onCancel} title={title}>
      {message && <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.45 }}>{message}</p>}
      <div className="adm-btn-row adm-btn-row--col">
        <button
          type="button"
          className={`adm-btn adm-btn--block${danger ? ' adm-btn--danger' : ' adm-btn--primary'}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button type="button" className="adm-btn adm-btn--block" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </AdminSheet>
  )
}
