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
        ? [`<blockquote>${escapeHtml(truncate(preview, 320))}</blockquote>`]
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

/** Админ-уведомление: статус → факты → что делать (одна строка). */
function adminCard(headline: string, rows: string[], action?: string): string {
  const body = rows.filter(Boolean).join('\n')
  const act = action ? `\n\n<b>${escapeHtml(action)}</b>` : ''
  return `<b>${BRAND}</b>\n\n<b>${escapeHtml(headline)}</b>\n\n${body}${act}`
}

function adminRow(label: string, value: string, code = false): string {
  const v = code ? `<code>${escapeHtml(value)}</code>` : escapeHtml(value)
  return `${label}: ${v}`
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

/** Клиент открыл оплату пополнения — перевода ещё нет. */
export function adminNewDeposit(opts: {
  userLabel: string
  amountUsd: number
  network: string
  orderId: string
  time?: string
}): string {
  return adminCard(
    'Ждём перевод на баланс',
    [
      adminRow('Клиент', opts.userLabel),
      adminRow('К переводу', `$${opts.amountUsd.toFixed(2)}`, true),
      adminRow('Сеть', formatPaymentAsset(opts.network)),
      adminRow('Заявка', opts.orderId, true),
      opts.time ? adminRow('Время', opts.time) : '',
    ],
    'Деньги ещё не пришли — баланс не трогать.',
  )
}

/** Клиент открыл оплату товара — перевода ещё нет. */
export function adminNewOrder(opts: {
  userLabel: string
  amountUsd: number
  network: string
  orderId: string
  time?: string
  product?: string
  qty?: number
}): string {
  return adminCard(
    'Ждём оплату за товар',
    [
      adminRow('Клиент', opts.userLabel),
      opts.product
        ? adminRow('Товар', `${opts.product}${opts.qty && opts.qty > 1 ? ` × ${opts.qty}` : ''}`)
        : '',
      adminRow('К переводу', `$${opts.amountUsd.toFixed(2)}`, true),
      adminRow('Сеть', formatPaymentAsset(opts.network)),
      adminRow('Заказ', opts.orderId, true),
      opts.time ? adminRow('Время', opts.time) : '',
    ],
    'Товар не выдавать — оплаты ещё нет.',
  )
}

/** Товар оплачен с баланса в приложении. */
export function adminBalanceOrder(opts: {
  userLabel: string
  product: string
  qty: number
  amountUsd: number
  orderId: string
  time?: string
}): string {
  return adminCard(
    'Товар оплачен · баланс',
    [
      adminRow('Клиент', opts.userLabel),
      adminRow('Товар', `${opts.product} × ${opts.qty}`),
      adminRow('Списано', `$${opts.amountUsd.toFixed(2)}`, true),
      adminRow('Заказ', opts.orderId, true),
      opts.time ? adminRow('Время', opts.time) : '',
    ],
    'Выдайте товар.',
  )
}

/** Перевод на пополнение зачислен. */
export function adminDepositConfirmed(opts: {
  amountUsd: number
  network: string
  uid: number
  orderId?: string
  userLabel?: string
  txHash?: string
  time?: string
}): string {
  return adminCard(
    'Баланс пополнен',
    [
      opts.userLabel ? adminRow('Клиент', opts.userLabel) : adminRow('Клиент', `UID ${opts.uid}`),
      adminRow('Зачислено', `$${opts.amountUsd.toFixed(2)}`, true),
      adminRow('Сеть', formatPaymentAsset(opts.network)),
      opts.orderId ? adminRow('Заявка', opts.orderId, true) : '',
      opts.txHash ? adminRow('TX', truncate(opts.txHash, 48), true) : '',
      opts.time ? adminRow('Время', opts.time) : '',
    ],
  )
}

/** Крипта за товар дошла. */
export function adminPaymentConfirmed(opts: {
  amountUsd: number
  network: string
  uid: number
  orderId?: string
  userLabel?: string
  txHash?: string
  time?: string
}): string {
  return adminCard(
    'Товар оплачен · крипта',
    [
      opts.userLabel ? adminRow('Клиент', opts.userLabel) : adminRow('Клиент', `UID ${opts.uid}`),
      adminRow('Получено', `$${opts.amountUsd.toFixed(2)}`, true),
      adminRow('Сеть', formatPaymentAsset(opts.network)),
      opts.orderId ? adminRow('Заказ', opts.orderId, true) : '',
      opts.txHash ? adminRow('TX', truncate(opts.txHash, 48), true) : '',
      opts.time ? adminRow('Время', opts.time) : '',
    ],
    'Выдайте товар.',
  )
}

export function adminDepositCancelled(opts: {
  userLabel: string
  amountUsd: number
  network: string
  orderId: string
}): string {
  return adminCard(
    'Пополнение отменено',
    [
      adminRow('Клиент', opts.userLabel),
      adminRow('Сумма', `$${opts.amountUsd.toFixed(2)}`, true),
      adminRow('Сеть', formatPaymentAsset(opts.network)),
      adminRow('Заявка', opts.orderId, true),
    ],
    'Перевода не было.',
  )
}

export function adminOrderCancelled(opts: {
  userLabel: string
  product: string
  qty: number
  amountUsd: number
  network: string
  orderId: string
}): string {
  return adminCard(
    'Заказ отменён',
    [
      adminRow('Клиент', opts.userLabel),
      adminRow('Товар', `${opts.product} × ${opts.qty}`),
      adminRow('Сумма', `$${opts.amountUsd.toFixed(2)}`, true),
      adminRow('Сеть', formatPaymentAsset(opts.network)),
      adminRow('Заказ', opts.orderId, true),
    ],
    'Оплаты не было — товар не выдавали.',
  )
}

/** @deprecated Дублировал server adminNewOrder — оставлен для совместимости, не вызывать. */
export function adminCryptoOrder(opts: {
  userLabel: string
  product: string
  qty: number
  amountUsd: number
  network: string
  orderId: string
}): string {
  return adminNewOrder({
    userLabel: opts.userLabel,
    amountUsd: opts.amountUsd,
    network: opts.network,
    orderId: opts.orderId,
    product: opts.product,
    qty: opts.qty,
  })
}

/** Офлайн-режим без API — тот же смысл, что adminBalanceOrder. */
export function adminBalancePurchase(opts: {
  userLabel: string
  product: string
  qty: number
  amountUsd: number
  orderId?: string
}): string {
  return adminCard(
    'Товар оплачен · баланс',
    [
      adminRow('Клиент', opts.userLabel),
      adminRow('Товар', `${opts.product} × ${opts.qty}`),
      adminRow('Списано', `$${opts.amountUsd.toFixed(2)}`, true),
      opts.orderId ? adminRow('Заказ', opts.orderId, true) : '',
    ],
    'Выдайте товар.',
  )
}

export function adminNewTicket(opts: {
  ticketId: string
  category: string
  userLabel: string
  summary?: string
}): string {
  return adminCard(
    'Новый тикет',
    [
      adminRow('Клиент', opts.userLabel),
      adminRow('Тикет', opts.ticketId, true),
      adminRow('Тема', opts.category),
      opts.summary ? adminRow('Текст', opts.summary) : '',
    ],
    'Ответьте в поддержке.',
  )
}

export function adminSupportMessage(opts: {
  ticketId?: string
  userLabel: string
  excerpt: string
  filesNote?: string
}): string {
  return adminCard(
    'Сообщение в тикете',
    [
      adminRow('Клиент', opts.userLabel),
      opts.ticketId ? adminRow('Тикет', opts.ticketId, true) : '',
      opts.filesNote ? escapeHtml(opts.filesNote) : '',
      '',
      escapeHtml(opts.excerpt || '—'),
    ],
  )
}

export function adminTicketClosed(opts: { ticketId: string; userLabel: string }): string {
  return adminCard('Тикет закрыт', [
    adminRow('Клиент', opts.userLabel),
    adminRow('Тикет', opts.ticketId, true),
  ])
}

export function adminRefWithdraw(opts: {
  refId: string
  userLabel: string
  amountUsd: number
  network: string
  address: string
}): string {
  return adminCard(
    'Вывод с реф. баланса',
    [
      adminRow('Клиент', opts.userLabel),
      adminRow('Заявка', opts.refId, true),
      adminRow('Сумма', `$${opts.amountUsd.toFixed(2)}`, true),
      adminRow('Сеть', formatPaymentAsset(opts.network)),
      adminRow('Кошелёк', opts.address, true),
    ],
    'Отправьте крипту на указанный адрес.',
  )
}

export function adminRefApproved(opts: {
  refId: string
  amountUsd: number
  network?: string
  txid?: string
}): string {
  return adminCard('Вывод отправлен', [
    adminRow('Заявка', opts.refId, true),
    adminRow('Сумма', `$${opts.amountUsd.toFixed(2)}`, true),
    opts.network ? adminRow('Сеть', opts.network) : '',
    opts.txid ? adminRow('TX', truncate(opts.txid, 48), true) : '',
  ])
}

export function adminRefRejected(opts: {
  refId: string
  amountUsd: number
  reason?: string
}): string {
  return adminCard(
    'Вывод отклонён',
    [
      adminRow('Заявка', opts.refId, true),
      adminRow('Сумма', `$${opts.amountUsd.toFixed(2)}`, true),
      opts.reason ? adminRow('Причина', truncate(opts.reason, 400)) : '',
    ],
    'Сумма снова на реф. балансе клиента.',
  )
}

export function adminSupportInbound(opts: {
  userLabel: string
  uid: number
  preview: string
}): string {
  return adminCard(
    'Сообщение в чат',
    [adminRow('Клиент', `${opts.userLabel} · UID ${opts.uid}`), '', escapeHtml(opts.preview)],
    'Ответьте в поддержке.',
  )
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
  orderId?: string
  time?: string
}): string {
  return adminCard('Товар отмечен выданным', [
    adminRow('Товар', opts.product),
    adminRow('Сумма', `$${opts.amountUsd.toFixed(2)}`, true),
    opts.orderId ? adminRow('Заказ', opts.orderId, true) : '',
    opts.uid != null ? adminRow('Клиент', `UID ${opts.uid}`) : '',
    opts.time ? adminRow('Время', opts.time) : '',
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
