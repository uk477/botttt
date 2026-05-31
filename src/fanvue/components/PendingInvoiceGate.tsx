import { motion } from 'framer-motion'
import type { Order } from '../store/types'
import CryptoLogo from './CryptoLogo'
import type { CryptoNetwork } from '../store/types'

const EASE = [0.22, 1, 0.36, 1] as const

type Props = {
  lang: 'ru' | 'en'
  invoice: Order
  context: 'product' | 'deposit'
  onContinue: () => void
  onCancelAndNew: () => void
  onChangeNetwork?: () => void
  onDismiss: () => void
}

export default function PendingInvoiceGate({
  lang,
  invoice,
  context,
  onContinue,
  onCancelAndNew,
  onChangeNetwork,
  onDismiss,
}: Props) {
  const isDeposit = invoice.kind === 'deposit'
  const net = invoice.provider as CryptoNetwork | undefined
  const title = isDeposit
    ? (lang === 'ru' ? 'Открыто пополнение' : 'Top-up in progress')
    : (lang === 'ru' ? 'Открыта оплата товара' : 'Product payment open')

  const lead =
    context === 'product'
      ? isDeposit
        ? lang === 'ru'
          ? 'Нельзя платить за товар, пока висит счёт на пополнение. Сначала оплатите или отмените его.'
          : 'You cannot pay for an item while a balance top-up invoice is open. Pay or cancel it first.'
        : lang === 'ru'
          ? 'Уже есть счёт на другой товар. Продолжите его или отмените и создайте новый на этот лот.'
          : 'Another item invoice is already open. Continue it, cancel it, or start a new one for this product.'
      : isDeposit
        ? lang === 'ru'
          ? 'Завершите текущее пополнение или отмените счёт, чтобы открыть новое.'
          : 'Finish this top-up or cancel the invoice before starting a new one.'
        : lang === 'ru'
          ? 'Сначала закройте оплату товара — пополнение и покупка не идут одновременно.'
          : 'Finish the product payment first — top-up and checkout cannot run together.'

  return (
    <motion.section
      className="dpz-card"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      style={{ margin: 0 }}
    >
      <span className="dpz-kicker">{lang === 'ru' ? 'Один счёт за раз' : 'One invoice at a time'}</span>
      <h2 className="dpz-h2" style={{ marginTop: 8 }}>{title}</h2>
      <p className="dpz-lead" style={{ marginBottom: 16 }}>{lead}</p>

      <div
        className="dpz-amt-pill"
        style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'flex-start' }}
      >
        {net && <CryptoLogo network={net} size={36} />}
        <div style={{ textAlign: 'left' }}>
          <span className="dpz-amt-pill-eye">
            {isDeposit
              ? (lang === 'ru' ? 'Пополнение' : 'Top-up')
              : (invoice.product_title ?? (lang === 'ru' ? 'Товар' : 'Product'))}
          </span>
          <strong>${invoice.amount.toFixed(2)}</strong>
          {net && (
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, opacity: 0.55, marginTop: 4 }}>
              {net.toUpperCase()} · #{invoice.id.slice(-8)}
            </div>
          )}
        </div>
      </div>

      <button type="button" className="dpz-cta" onClick={onContinue} style={{ marginBottom: 10 }}>
        <span className="dpz-cta-bg" aria-hidden />
        <span className="dpz-cta-t">
          {isDeposit
            ? (lang === 'ru' ? 'Перейти к оплате' : 'Go to payment')
            : (lang === 'ru' ? 'Продолжить оплату' : 'Continue payment')}
        </span>
      </button>

      <button type="button" className="dpz-cta" onClick={onCancelAndNew} style={{ marginBottom: onChangeNetwork ? 10 : 14, opacity: 0.92 }}>
        <span className="dpz-cta-t">
          {context === 'product'
            ? isDeposit
              ? (lang === 'ru' ? 'Отменить пополнение · купить товар' : 'Cancel top-up · pay for item')
              : (lang === 'ru' ? 'Отменить · новый счёт на этот товар' : 'Cancel · new invoice for this item')
            : isDeposit
              ? (lang === 'ru' ? 'Отменить и новое пополнение' : 'Cancel · new top-up')
              : (lang === 'ru' ? 'Отменить покупку · пополнить' : 'Cancel purchase · top up')}
        </span>
      </button>

      {!isDeposit && onChangeNetwork && (
        <button type="button" className="dpz-cta" onClick={onChangeNetwork} style={{ marginBottom: 14, opacity: 0.85 }}>
          <span className="dpz-cta-t">{lang === 'ru' ? 'Сменить сеть' : 'Change network'}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        style={{
          width: '100%',
          padding: '12px',
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.45)',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {lang === 'ru' ? 'Не сейчас' : 'Not now'}
      </button>
    </motion.section>
  )
}
