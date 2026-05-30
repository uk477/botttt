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

function field(lang: NotifyLang, labelRu: string, labelEn: string, value: string, code = false): string {
  const label = t(lang, labelRu, labelEn)
  const v = code ? `<code>${escapeHtml(value)}</code>` : escapeHtml(value)
  return `${label}: ${v}`
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
      const lines = preview
        ? [field(lang, 'Сообщение', 'Message', truncate(preview, 320))]
        : []
      return {
        text: notice(
          lang,
          'Ответ службы поддержки',
          'Support reply',
          [
            ...lines,
            '',
            t(
              lang,
              'Откройте чат в приложении, чтобы продолжить диалог.',
              'Open the in-app chat to continue.',
            ),
          ],
        ),
        buttonText: btn(lang, 'Чат поддержки', 'Support chat'),
      }
    }

    case 'order_created':
      return {
        text: notice(lang, 'Заказ создан', 'Order created', [
          params.orderId ? field(lang, 'Номер', 'Order ID', params.orderId, true) : '',
          params.amountUsd != null
            ? field(lang, 'Сумма', 'Amount', `$${params.amountUsd.toFixed(2)}`)
            : '',
          params.network ? field(lang, 'Оплата', 'Payment', formatPaymentAsset(params.network)) : '',
          '',
          t(
            lang,
            'Оплатите заказ в приложении. Обработка начнётся после подтверждения транзакции.',
            'Complete payment in the app. Processing starts after on-chain confirmation.',
          ),
        ]),
        buttonText: btn(lang, 'Оплатить', 'Pay'),
      }

    case 'deposit_created': {
      const asset = params.network ? formatPaymentAsset(params.network) : 'USDT (TRC20)'
      return {
        text: notice(lang, 'Счёт на пополнение', 'Balance top-up invoice', [
          field(lang, 'Сеть', 'Network', asset),
          payAmountLine(lang, params),
          params.walletAddress ? field(lang, 'Адрес', 'Address', params.walletAddress, true) : '',
          params.orderId ? field(lang, 'Заявка', 'Reference', params.orderId, true) : '',
          params.amountUsd != null
            ? field(lang, 'Эквивалент', 'USD equivalent', `$${params.amountUsd.toFixed(2)}`)
            : '',
          '',
          t(
            lang,
            'Переведите указанную сумму без изменений. Зачисление — после подтверждения в сети.',
            'Send the exact amount shown. Funds are credited after network confirmation.',
          ),
        ]),
      }
    }

    case 'payment_received':
      return {
        text: notice(lang, 'Оплата получена', 'Payment received', [
          params.orderId ? field(lang, 'Заказ', 'Order', params.orderId, true) : '',
          params.amountUsd != null
            ? field(lang, 'Сумма', 'Amount', `$${params.amountUsd.toFixed(2)}`)
            : '',
          params.time ? field(lang, 'Время', 'Time', params.time) : '',
          '',
          t(lang, 'Заказ передан в обработку.', 'Your order is being processed.'),
        ]),
        buttonText: btn(lang, 'Статус заказа', 'Order status'),
      }

    case 'deposit_credited':
      return {
        text: notice(lang, 'Баланс пополнен', 'Balance credited', [
          params.amountUsd != null
            ? field(lang, 'Зачислено', 'Credited', `$${params.amountUsd.toFixed(2)}`)
            : '',
          params.time ? field(lang, 'Время', 'Time', params.time) : '',
          '',
          t(lang, 'Средства доступны в приложении.', 'Funds are available in the app.'),
        ]),
        buttonText: btn(lang, 'Открыть приложение', 'Open app'),
      }

    case 'order_delivered':
      return {
        text: notice(lang, 'Заказ выполнен', 'Order fulfilled', [
          params.productTitle ? field(lang, 'Товар', 'Product', params.productTitle) : '',
          params.amountUsd != null
            ? field(lang, 'Сумма', 'Amount', `$${params.amountUsd.toFixed(2)}`)
            : '',
          '',
          t(lang, 'Данные доступа — в приложении.', 'Access details are in the app.'),
        ]),
        buttonText: btn(lang, 'Открыть заказ', 'View order'),
      }

    case 'ref_approved':
      return {
        text: notice(lang, 'Реферальная выплата', 'Referral payout', [
          params.refId ? field(lang, 'Заявка', 'Reference', params.refId, true) : '',
          params.amountUsd != null
            ? field(lang, 'Сумма', 'Amount', `$${params.amountUsd.toFixed(2)}`)
            : '',
          params.cryptoName ? field(lang, 'Сеть', 'Network', params.cryptoName) : '',
          params.txid ? field(lang, 'Транзакция', 'Transaction', truncate(params.txid, 48), true) : '',
          '',
          t(lang, 'Выплата одобрена и отправлена.', 'Payout approved and sent.'),
        ]),
        buttonText: btn(lang, 'Реферальный баланс', 'Referral balance'),
      }

    case 'ref_rejected':
      return {
        text: notice(lang, 'Вывод отклонён', 'Withdrawal declined', [
          params.refId ? field(lang, 'Заявка', 'Reference', params.refId, true) : '',
          params.amountUsd != null
            ? field(
                lang,
                'Сумма',
                'Amount',
                `$${params.amountUsd.toFixed(2)} (${t(lang, 'возврат на баланс', 'returned to balance')})`,
              )
            : '',
          params.reason
            ? field(lang, 'Причина', 'Reason', truncate(params.reason, 400))
            : '',
        ]),
        buttonText: btn(lang, 'Открыть приложение', 'Open app'),
      }

    default:
      return {
        text: notice(lang, 'Уведомление', 'Notification', []),
        buttonText: btn(lang, 'Открыть приложение', 'Open app'),
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
