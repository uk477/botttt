import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; type: ToastType; text: string }
interface Ctx { show: (text: string, type?: ToastType) => void }

const ToastCtx = createContext<Ctx>({ show: () => { /* noop */ } })

export const useToast = () => useContext(ToastCtx)

const ICONS: Record<ToastType, string> = { success: '✓', error: '✕', info: 'ⓘ' }
const COLORS: Record<ToastType, string> = {
  success: 'linear-gradient(135deg, #10B981, #06B6D4)',
  error: 'linear-gradient(135deg, #EF4444, #F97316)',
  info: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((text: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((p) => [...p, { id, type, text }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 1400)
  }, [])

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="toast-stack">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className="toast-item"
              initial={false}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="toast-icon" style={{ background: COLORS[t.type] }}>
                {ICONS[t.type]}
              </span>
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
