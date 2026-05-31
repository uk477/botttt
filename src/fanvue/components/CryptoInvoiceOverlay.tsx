import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import CryptoInvoicePanel, { type CryptoInvoicePanelProps } from './CryptoInvoicePanel'

type Props = CryptoInvoicePanelProps & {
  open: boolean
  title?: string
}

/** Full-screen payment sheet — fixed footer, scrollable body. */
export default function CryptoInvoiceOverlay({ open, title, lang, onCancel, ...panel }: Props) {
  useEffect(() => {
    if (!open) return
    document.body.classList.add('pay-sheet-open')
    document.querySelector('.scroll-area')?.classList.add('pay-sheet-open')
    return () => {
      document.body.classList.remove('pay-sheet-open')
      document.querySelector('.scroll-area')?.classList.remove('pay-sheet-open')
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="cinv-overlay"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="cinv-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="cinv-sheet__title t-sm fw-bold">
                {title}
              </div>
            )}
            <CryptoInvoicePanel lang={lang} onCancel={onCancel} {...panel} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
