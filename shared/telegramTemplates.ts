export type NotifyLang = 'ru' | 'en'

export type UserNotifyKind =
  | 'support_reply'
  | 'order_created'
  | 'deposit_created'
  | 'payment_received'
  | 'deposit_credited'
  | 'order_delivered'
  | 'ref_approved'
  | 'ref_rejected'

export interface UserNotifyPayload {
  preview?: string
  amountUsd?: number
  orderId?: string
  network?: string
  walletAddress?: string
  amountCrypto?: string | number
  productTitle?: string
  time?: string
  refId?: string
  txid?: string
  cryptoName?: string
  reason?: string
}

export interface BuiltUserNotify {
  text: string
  /** Omit or empty string — message without inline button */
  buttonText?: string
}

const BRAND = 'Fanvue Market'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, max - 1) + '…'
}

function t(lang: NotifyLang, ru: string, en: string): string {
  return lang === 'ru' ? ru : en
}

function btn(lang: NotifyLang, ru: string, en: string): string {
  return t(lang, ru, en)
}

/** Business-style header: brand + subject */
function notice(lang: NotifyLang, subjectRu: string, subjectEn: string, lines: string[]): string {
  const subject = t(lang, subjectRu, subjectEn)
  const body = lines.filter(Boolean).join('\n')
  return body ? `<b>${BRAND}</b>\n${subject}\n\n${body}` : `<b>${BRAND}</b>\n${subject}`
}

/** Buyer DM: brand, italic headline, dot-separated rows, optional footer — no buttons */
function userMessage(
  lang: NotifyLang,
  headlineRu: string,
  headlineEn: string,
  rows: string[],
  footerRu?: string,
  footerEn?: string,
): string {
  const headline = t(lang, headlineRu, headlineEn)
  const body = rows.filter(Boolean).join('\n')
  const footer =
    footerRu && footerEn ? `\n\n${t(lang, footerRu, footerEn)}` : ''
  return `<b>${BRAND}</b>\n<i>${headline}</i>\n\n${body}${footer}`
}

function row(lang: NotifyLang, labelRu: string, labelEn: string, value: string, code = false): string {
  const label = t(lang, labelRu, labelEn)
  const v = code ? `<code>${escapeHtml(value)}</code>` : escapeHtml(value)
  return `${label} · ${v}`
}

function field(lang: NotifyLang, labelRu: string, labelEn: string, value: string, code = false): string {
  const label = t(lang, labelRu, labelEn)
  const v = code ? `<code>${escapeHtml(value)}</code>` : escapeHtml(value)
  return `${label}: ${v}`
}

function paymentSuccessRows(lang: NotifyLang, params: UserNotifyPayload): string[] {
  const net = (params.network ?? 'trc20').toLowerCase()
  if (net === 'balance') {
    const rows: string[] = []
    if (params.orderId) rows.push(row(lang, 'Заказ', 'Order', params.orderId, true))
    if (params.amountUsd != null) {
      rows.push(row(lang, 'Сумма', 'Amount', `$${params.amountUsd.toFixed(2)}`, true))
    }
    rows.push(row(lang, 'Оплата', 'Payment', t(lang, 'Баланс аккаунта', 'Account balance')))
    if (params.time) rows.push(row(lang, 'Время', 'Time', params.time))
    return rows
  }

  const asset = formatPaymentAsset(net)
  const amountStr =
    params.amountCrypto != null
      ? typeof params.amountCrypto === 'number'
        ? formatPayCryptoAmount(params.amountCrypto, net)
        : params.amountCrypto
      : params.amountUsd != null
        ? formatPayCryptoAmount(params.amountUsd, net)
        : ''
  const rows: string[] = []
  if (params.orderId) {
    rows.push(row(lang, 'Заявка', 'Reference', params.orderId, true))
  }
  if (amountStr) {
    rows.push(row(lang, 'Сумма', 'Amount', amountStr, true))
  }
  rows.push(row(lang, 'Сеть', 'Network', asset))
  if (params.time) {
    rows.push(row(lang, 'Время', 'Time', params.time))
  }
  return rows
}

/** Human-readable asset + network for payment notifications */
export function formatPaymentAsset(network: string): string {
  const n = network.toLowerCase().trim()
  const map: Record<string, string> = {
    trc20: 'USDT (TRC20)',
    erc20: 'USDT (ERC20)',
    bep20: 'USDT (BEP20)',
    btc: 'BTC',
    eth: 'ETH',
    sol: 'SOL',
    ton: 'TON',
    usdc_sol: 'USDC (Solana)',
  }
  return map[n] ?? network.toUpperCase()
}

function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

export function formatPayCryptoAmount(amount: number, network: string): string {
  const n = network.toLowerCase().trim()
  let digits: string
  if (n === 'btc') digits = trimTrailingZeros(amount.toFixed(8))
  else if (n === 'eth' || n === 'sol' || n === 'ton') digits = trimTrailingZeros(amount.toFixed(6))
  else digits = trimTrailingZeros(amount.toFixed(3))
  const symbol = formatPaymentAsset(network).split(' ')[0] ?? 'USDT'
  return `${digits} ${symbol}`
}

function payAmountLine(
  lang: NotifyLang,
  params: UserNotifyPayload,
): string | '' {
  if (params.amountCrypto != null) {
    const val =
      typeof params.amountCrypto === 'number'
        ? formatPayCryptoAmount(params.amountCrypto, params.network ?? 'trc20')
        : params.amountCrypto
    return field(lang, 'Сумма', 'Amount', val, true)
  }
  if (params.amountUsd != null) {
    return field(
      lang,
      'Сумма',
      'Amount',
      formatPayCryptoAmount(params.amountUsd, params.network ?? 'trc20'),
      true,
    )
  }
  return ''
}

export function buildUserNotification(
  kind: UserNotifyKind,
  params: UserNotifyPayload,
  lang: NotifyLang = 'ru',
): BuiltUserNotify {
  switch (kind) {
    case 'support_reply': {
      const preview = params.preview?.trim()
      const rows = preview
        ? [row(lang, 'Сообщение', 'Message', truncate(preview, 320))]
        : []
      return {
        text: userMessage(
          lang,
          'Ответ поддержки',
          'Support reply',
          rows,
          'Продолжите диалог в разделе «Поддержка» в приложении.',
          'Continue the conversation in Support inside the app.',
        ),
      }
    }

    case 'order_created':
    case 'deposit_created':
      return { text: '' }

    case 'payment_received':
      return {
        text: userMessage(
          lang,
          'Оплата подтверждена',
          'Payment confirmed',
          paymentSuccessRows(lang, params),
          'Заказ принят в обработку. Детали — в приложении.',
          'Your order is being processed. Details are in the app.',
        ),
      }

    case 'deposit_credited': {
      const rows = paymentSuccessRows(lang, params)
      if (params.amountUsd != null) {
        rows.push(
          row(
            lang,
            'Баланс',
            'Balance',
            `$${params.amountUsd.toFixed(2)}`,
            true,
          ),
        )
      }
      return {
        text: userMessage(
          lang,
          'Пополнение зачислено',
          'Top-up completed',
          rows,
          'Средства доступны на балансе в приложении.',
          'Funds are available on your in-app balance.',
        ),
      }
    }

    case 'order_delivered': {
      const rows: string[] = []
      if (params.productTitle) {
        rows.push(row(lang, 'Товар', 'Product', params.productTitle))
      }
      if (params.amountUsd != null) {
        rows.push(
          row(lang, 'Сумма', 'Amount', `$${params.amountUsd.toFixed(2)}`, true),
        )
      }
      return {
        text: userMessage(
          lang,
          'Заказ выполнен',
          'Order fulfilled',
          rows,
          'Данные для доступа — в карточке заказа в приложении.',
          'Access details are in your order in the app.',
        ),
      }
    }

    case 'ref_approved': {
      const rows: string[] = []
      if (params.refId) rows.push(row(lang, 'Заявка', 'Reference', params.refId, true))
      if (params.amountUsd != null) {
        rows.push(row(lang, 'Сумма', 'Amount', `$${params.amountUsd.toFixed(2)}`, true))
      }
      if (params.cryptoName) rows.push(row(lang, 'Сеть', 'Network', params.cryptoName))
      if (params.txid) {
        rows.push(row(lang, 'Транзакция', 'Transaction', truncate(params.txid, 48), true))
      }
      return {
        text: userMessage(
          lang,
          'Реферальная выплата отправлена',
          'Referral payout sent',
          rows,
        ),
      }
    }

    case 'ref_rejected': {
      const rows: string[] = []
      if (params.refId) rows.push(row(lang, 'Заявка', 'Reference', params.refId, true))
      if (params.amountUsd != null) {
        rows.push(
          row(
            lang,
            'Сумма',
            'Amount',
            `$${params.amountUsd.toFixed(2)} · ${t(lang, 'возврат на баланс', 'returned')}`,
            true,
          ),
        )
      }
      if (params.reason) {
        rows.push(row(lang, 'Причина', 'Reason', truncate(params.reason, 400)))
      }
      return {
        text: userMessage(
          lang,
          'Вывод отклонён',
          'Withdrawal declined',
          rows,
        ),
      }
    }

    default:
      return {
        text: userMessage(lang, 'Уведомление', 'Notification', []),
      }
  }
}

// ── Admin / ops notifications (HTML) ─────────────────────────────

function adminNotice(title: string, lines: string[]): string {
  const body = lines.filter(Boolean).join('\n')
  return body ? `<b>${BRAND}</b> · ${title}\n\n${body}` : `<b>${BRAND}</b> · ${title}`
}

export function formatUserRef(user: {
  username?: string | null
  full_name?: string | null
  uid?: number | string | null
}): string {
  const name = user.username ? `@${user.username}` : user.full_name ?? '—'
  const id = user.uid != null ? String(user.uid) : '—'
  return `${name} · ID ${id}`
}

export function adminNewDeposit(opts: {
  userLabel: string
  amountUsd: number
  network: string
  orderId: string
  time?: string
}): string {
  return adminNotice('Новый депозит', [
    `Клиент: ${escapeHtml(opts.userLabel)}`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    `Сеть: ${escapeHtml(formatPaymentAsset(opts.network))}`,
    opts.time ? `Время: ${escapeHtml(opts.time)}` : '',
    `Заявка: <code>${escapeHtml(opts.orderId)}</code>`,
  ])
}

export function adminNewOrder(opts: {
  userLabel: string
  amountUsd: number
  network: string
  orderId: string
  time?: string
}): string {
  return adminNotice('Новый заказ', [
    `Клиент: ${escapeHtml(opts.userLabel)}`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    `Сеть: ${escapeHtml(formatPaymentAsset(opts.network))}`,
    opts.time ? `Время: ${escapeHtml(opts.time)}` : '',
    `Заказ: <code>${escapeHtml(opts.orderId)}</code>`,
  ])
}

export function adminBalanceOrder(opts: {
  userLabel: string
  product: string
  qty: number
  amountUsd: number
  orderId: string
  time?: string
}): string {
  return adminNotice('Заказ (баланс)', [
    `Клиент: ${escapeHtml(opts.userLabel)}`,
    `Товар: ${escapeHtml(opts.product)} × ${opts.qty}`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    opts.time ? `Время: ${escapeHtml(opts.time)}` : '',
    `Заказ: <code>${escapeHtml(opts.orderId)}</code>`,
  ])
}

export function adminDepositConfirmed(opts: {
  amountUsd: number
  network: string
  uid: number
  time?: string
}): string {
  return adminNotice('Депозит подтверждён', [
    `Сумма: $${opts.amountUsd}`,
    `Сеть: ${escapeHtml(formatPaymentAsset(opts.network))}`,
    `UID: ${opts.uid}`,
    opts.time ? `Время: ${escapeHtml(opts.time)}` : '',
  ])
}

export function adminPaymentConfirmed(opts: {
  amountUsd: number
  network: string
  uid: number
  time?: string
}): string {
  return adminNotice('Оплата подтверждена', [
    `Сумма: $${opts.amountUsd}`,
    `Сеть: ${escapeHtml(formatPaymentAsset(opts.network))}`,
    `UID: ${opts.uid}`,
    opts.time ? `Время: ${escapeHtml(opts.time)}` : '',
  ])
}

export function adminDepositCancelled(opts: {
  userLabel: string
  amountUsd: number
  network: string
  orderId: string
}): string {
  return adminNotice('Депозит отменён', [
    `Клиент: ${escapeHtml(opts.userLabel)}`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    `Сеть: ${escapeHtml(formatPaymentAsset(opts.network))}`,
    `Заявка: <code>${escapeHtml(opts.orderId)}</code>`,
  ])
}

export function adminOrderCancelled(opts: {
  userLabel: string
  product: string
  qty: number
  amountUsd: number
  network: string
  orderId: string
}): string {
  return adminNotice('Заказ отменён', [
    `Клиент: ${escapeHtml(opts.userLabel)}`,
    `Товар: ${escapeHtml(opts.product)} × ${opts.qty}`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    `Сеть: ${escapeHtml(formatPaymentAsset(opts.network))}`,
    `Заказ: <code>${escapeHtml(opts.orderId)}</code>`,
  ])
}

export function adminCryptoOrder(opts: {
  userLabel: string
  product: string
  qty: number
  amountUsd: number
  network: string
  orderId: string
}): string {
  return adminNotice('Новый заказ (крипто)', [
    `Клиент: ${escapeHtml(opts.userLabel)}`,
    `Товар: ${escapeHtml(opts.product)} × ${opts.qty}`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    `Сеть: ${escapeHtml(formatPaymentAsset(opts.network))}`,
    `Заказ: <code>${escapeHtml(opts.orderId)}</code>`,
  ])
}

export function adminBalancePurchase(opts: {
  userLabel: string
  product: string
  qty: number
  amountUsd: number
}): string {
  return adminNotice('Новый заказ (баланс)', [
    `Клиент: ${escapeHtml(opts.userLabel)}`,
    `Товар: ${escapeHtml(opts.product)} × ${opts.qty}`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
  ])
}

export function adminNewTicket(opts: {
  ticketId: string
  category: string
  userLabel: string
  summary?: string
}): string {
  return adminNotice('Новая заявка в поддержку', [
    `Заявка: <code>${escapeHtml(opts.ticketId)}</code>`,
    `Тема: ${escapeHtml(opts.category)}`,
    opts.summary ? `Кратко: ${escapeHtml(opts.summary)}` : '',
    `Клиент: ${escapeHtml(opts.userLabel)}`,
  ])
}

export function adminSupportMessage(opts: {
  ticketId?: string
  userLabel: string
  excerpt: string
  filesNote?: string
}): string {
  return adminNotice('Сообщение в поддержку', [
    opts.ticketId ? `Заявка: <code>${escapeHtml(opts.ticketId)}</code>` : '',
    `Клиент: ${escapeHtml(opts.userLabel)}`,
    opts.filesNote ? escapeHtml(opts.filesNote) : '',
    '',
    escapeHtml(opts.excerpt || '—'),
  ])
}

export function adminTicketClosed(opts: { ticketId: string; userLabel: string }): string {
  return adminNotice('Заявка закрыта клиентом', [
    `Заявка: <code>${escapeHtml(opts.ticketId)}</code>`,
    `Клиент: ${escapeHtml(opts.userLabel)}`,
  ])
}

export function adminRefWithdraw(opts: {
  refId: string
  userLabel: string
  amountUsd: number
  network: string
  address: string
}): string {
  return adminNotice('Заявка на реф. вывод', [
    `Заявка: <code>${escapeHtml(opts.refId)}</code>`,
    `Клиент: ${escapeHtml(opts.userLabel)}`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    `Сеть: ${escapeHtml(formatPaymentAsset(opts.network))}`,
    `Адрес: <code>${escapeHtml(opts.address)}</code>`,
  ])
}

export function adminRefApproved(opts: {
  refId: string
  amountUsd: number
  network?: string
  txid?: string
}): string {
  return adminNotice('Реф. вывод одобрен', [
    `Заявка: <code>${escapeHtml(opts.refId)}</code>`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    opts.network ? `Сеть: ${escapeHtml(opts.network)}` : '',
    opts.txid ? `TX: <code>${escapeHtml(truncate(opts.txid, 48))}</code>` : '',
  ])
}

export function adminRefRejected(opts: {
  refId: string
  amountUsd: number
  reason?: string
}): string {
  return adminNotice('Реф. вывод отклонён', [
    `Заявка: <code>${escapeHtml(opts.refId)}</code>`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    opts.reason ? `Причина: ${escapeHtml(truncate(opts.reason, 400))}` : '',
  ])
}

export function adminSupportInbound(opts: {
  userLabel: string
  uid: number
  preview: string
}): string {
  return adminNotice('Сообщение в поддержку', [
    `Клиент: ${escapeHtml(opts.userLabel)} · UID ${opts.uid}`,
    '',
    escapeHtml(opts.preview),
  ])
}

/** Pre-filled message when buyer requests delivery via support */
export function userDeliveryRequest(
  lang: NotifyLang,
  opts: { product: string; qty?: number; orderId: string; amountUsd: number; paidAt: string },
): string {
  const qty = opts.qty && opts.qty > 1 ? ` × ${opts.qty}` : ''
  return notice(
    lang,
    'Запрос на выдачу заказа',
    'Delivery request',
    [
      field(lang, 'Товар', 'Product', `${opts.product}${qty}`),
      field(lang, 'Заказ', 'Order', opts.orderId, true),
      field(lang, 'Сумма', 'Amount', `$${opts.amountUsd.toFixed(2)}`),
      field(lang, 'Оплачен', 'Paid at', opts.paidAt),
      '',
      t(
        lang,
        'Оплата подтверждена. Прошу выдать заказ.',
        'Payment confirmed. Please deliver the order.',
      ),
    ],
  )
}

export function adminOrderDelivered(opts: {
  product: string
  amountUsd: number
  uid?: number | null
  time?: string
}): string {
  return adminNotice('Заказ выдан', [
    `Товар: ${escapeHtml(opts.product)}`,
    `Сумма: $${opts.amountUsd.toFixed(2)}`,
    opts.uid != null ? `UID: ${opts.uid}` : '',
    opts.time ? `Время: ${escapeHtml(opts.time)}` : '',
  ])
}

// ── /start welcome ───────────────────────────────────────────────

export const WELCOME: Record<NotifyLang, string> = {
  ru: `<b>${BRAND}</b>

Маркетплейс аккаунтов Fanvue: верификация, пополнение баланса, оплата криптовалютой.

Выберите язык и откройте приложение в Telegram.`,
  en: `<b>${BRAND}</b>

Fanvue accounts marketplace: verification, balance top-up, crypto checkout.

Choose your language and open the app in Telegram.`,
}

export const OPEN_BTN: Record<NotifyLang, string> = {
  ru: 'Открыть магазин',
  en: 'Open store',
}

export function buildStartKeyboard(lang: NotifyLang, webAppUrl: string | undefined) {
  const openBtn = webAppUrl
    ? [{ text: OPEN_BTN[lang], web_app: { url: webAppUrl } }]
    : [{ text: OPEN_BTN[lang], url: 'https://t.me/' }]
  return {
    inline_keyboard: [
      openBtn,
      [
        {
          text: lang === 'ru' ? 'Русский' : 'Russian',
          callback_data: 'lang:ru',
        },
        {
          text: lang === 'en' ? 'English' : 'English',
          callback_data: 'lang:en',
        },
      ],
    ],
  }
}
