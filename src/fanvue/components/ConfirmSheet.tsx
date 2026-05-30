import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmSheet({
  open, title, message, confirmLabel = 'OK', cancelLabel = 'Отмена',
  danger = false, onConfirm, onCancel,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
        >
          <motion.div
            className="sheet"
            style={{ paddingBottom: 'max(32px, calc(env(safe-area-inset-bottom, 0px) + 24px))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="sheet-handle" style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />
            <div className="t-lg fw-black mb-2" style={{ marginTop: 4 }}>{title}</div>
            {message && <div className="t-sm t-muted mb-5">{message}</div>}
            <div className="col gap-3">
              <motion.button
                className="btn btn-primary"
                style={danger ? { background: 'linear-gradient(135deg,#ef4444,#dc2626)' } : undefined}
                onClick={onConfirm}
                whileTap={{ scale: 0.97 }}
              >
                {confirmLabel}
              </motion.button>
              <motion.button
                className="btn btn-secondary"
                onClick={onCancel}
                whileTap={{ scale: 0.97 }}
              >
                {cancelLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
