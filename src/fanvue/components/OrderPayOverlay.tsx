import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PayPanel } from '../pages/Deposit'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { api } from '../store/api'
import { useTelegram } from '../hooks/useTelegram'
import { useToast } from './Toast'
import type { Order } from '../store/types'

interface Props {
  order: Order | null
  onClose: () => void
}

/** Full-screen crypto pay — not inside order modal scroll */
export default function OrderPayOverlay({ order, onClose }: Props) {
  const lang = useStore((s) => s.lang)
  const setOrderStatus = useStore((s) => s.setOrderStatus)
  const { haptic } = useTelegram()
  const toast = useToast()

  useEffect(() => {
    if (!order) return
    document.body.classList.add('pay-sheet-open')
    const scroll = document.querySelector('.scroll-area')
    scroll?.classList.add('pay-sheet-open')
    return () => {
      document.body.classList.remove('pay-sheet-open')
      scroll?.classList.remove('pay-sheet-open')
    }
  }, [order?.id])

  const cryptoOpt = order?.provider
    ? CRYPTO_OPTIONS.find((c) => c.id === order.provider)
    : undefined

  if (!order || !cryptoOpt || order.kind === 'deposit') return null

  const uiLang = lang === 'ru' ? 'ru' : 'en'

  return createPortal(
    <AnimatePresence>
      {order && (
        <motion.div
          key={order.id}
          className="fv-sheet-overlay fv-pay-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="fv-pay-sheet fv-pay-sheet--full"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <PayPanel
              orderId={order.id}
              amountUsd={order.amount}
              uniqueAmount={order.amount}
              createdAt={order.created}
              expiresAt={order.expires_at}
              network={cryptoOpt.id}
              cryptoName={cryptoOpt.name}
              cryptoSymbol={cryptoOpt.symbol}
              cryptoColor={cryptoOpt.color}
              cryptoAddressFallback={cryptoOpt.address}
              lang={uiLang}
              onCancel={() => {
                void (async () => {
                  if (api.isEnabled()) await api.cancelOrder(order.id)
                  setOrderStatus(order.id, 'expired')
                  haptic('light')
                  toast.show(uiLang === 'ru' ? 'Счёт отменён' : 'Invoice cancelled', 'success')
                  onClose()
                })()
              }}
              onSuccess={() => {
                setOrderStatus(order.id, 'paid')
                onClose()
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
