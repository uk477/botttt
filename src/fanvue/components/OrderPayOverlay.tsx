import CryptoInvoiceOverlay from './CryptoInvoiceOverlay'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { api } from '../store/api'
import { useTelegram } from '../hooks/useTelegram'
import { useToast } from './Toast'
import type { Order } from '../store/types'

interface Props {
  order: Order | null
  onClose: () => void
}

/** Full-screen crypto pay for an existing pending order */
export default function OrderPayOverlay({ order, onClose }: Props) {
  const lang = useStore((s) => s.lang)
  const setOrderStatus = useStore((s) => s.setOrderStatus)
  const { haptic } = useTelegram()
  const toast = useToast()

  const cryptoOpt = order?.provider
    ? CRYPTO_OPTIONS.find((c) => c.id === order.provider)
    : undefined

  if (!order || !cryptoOpt || order.kind === 'deposit') return null

  const uiLang = lang === 'ru' ? 'ru' : 'en'

  return (
    <CryptoInvoiceOverlay
      open={!!order}
      title={uiLang === 'ru' ? 'Оплата заказа' : 'Order payment'}
      orderId={order.id}
      uniqueAmount={order.amount}
      amountCrypto={order.amount_crypto}
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
  )
}
