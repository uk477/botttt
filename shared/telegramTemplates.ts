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

function card(title: string, body: string, _lang: NotifyLang): string {
  return `${title}\n\n${body}`
}

function btn(lang: NotifyLang, ru: string, en: string): string {
  return lang === 'ru' ? ru : en
}

const SEP = '━━━━━━━━━━━━━━━━'

/** Human-readable asset + network for payment notifications */
export function formatPaymentAsset(network: string): string {
  const n = network.toLowerCase().trim()
  const map: Record<string, string> = {
    trc20: 'USDT TRC20',
    erc20: 'USDT ERC20',
    bep20: 'USDT BEP20',
    btc: 'BTC',
    eth: 'ETH',
    sol: 'SOL',
    ton: 'TON',
    usdc_sol: 'USDC (Solana)',
  }
  return map[n] ?? network.toUpperCase()
}

/** Exact crypto amount to send (matches mini-app payment screen) */
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
  const asset = formatPaymentAsset(network)
  const symbol = asset.split(' ')[0] ?? 'USDT'
  return `${digits} ${symbol}`
}

function fieldLabel(lang: NotifyLang, ru: string, en: string): string {
  return lang === 'ru' ? ru : en
}

export function buildUserNotification(
  kind: UserNotifyKind,
  params: UserNotifyPayload,
  lang: NotifyLang = 'ru',
): BuiltUserNotify {
  switch (kind) {
    case 'support_reply': {
      const preview = params.preview?.trim()
      const body = preview
        ? (lang === 'ru'
          ? `Новое сообщение от команды поддержки:\n\n<blockquote>${escapeHtml(truncate(preview, 320))}</blockquote>`
          : `New message from support:\n\n<blockquote>${escapeHtml(truncate(preview, 320))}</blockquote>`)
        : lang === 'ru'
          ? 'Команда поддержки ответила на ваше обращение.'
          : 'Support has replied to your request.'
      return {
        text: card(
          lang === 'ru' ? '💬 Поддержка' : '💬 Support',
          body,
          lang,
        ),
        buttonText: btn(lang, 'Открыть чат', 'Open chat'),
      }
    }

    case 'order_created':
      return {
        text: card(
          lang === 'ru' ? '🛒 Заказ оформлен' : '🛒 Order placed',
          [
            params.amountUsd != null
              ? (lang === 'ru' ? `Сумма · <b>$${params.amountUsd.toFixed(2)}</b>` : `Amount · <b>$${params.amountUsd.toFixed(2)}</b>`)
              : '',
            params.network ? (lang === 'ru' ? `Сеть · ${escapeHtml(params.network.toUpperCase())}` : `Network · ${escapeHtml(params.network.toUpperCase())}`) : '',
            params.orderId ? (lang === 'ru' ? `Номер · <code>${escapeHtml(params.orderId)}</code>` : `ID · <code>${escapeHtml(params.orderId)}</code>`) : '',
            '',
            lang === 'ru'
              ? 'Переведите точную сумму на адрес в приложении. После подтверждения сети начнём обработку.'
              : 'Send the exact amount to the address in the app. Processing starts after network confirmation.',
          ].filter(Boolean).join('\n'),
          lang,
        ),
        buttonText: btn(lang, 'Оплатить заказ', 'Pay order'),
      }

    case 'deposit_created': {
      const asset = params.network ? formatPaymentAsset(params.network) : 'USDT TRC20'
      const body = [
        SEP,
        '',
        `🪙 <b>${fieldLabel(lang, 'Сеть', 'Network')}</b>`,
        escapeHtml(asset),
        '',
        params.amountCrypto != null
          ? `💰 <b>${fieldLabel(lang, 'К оплате', 'Send exactly')}</b>\n<code>${escapeHtml(
              typeof params.amountCrypto === 'number'
                ? formatPayCryptoAmount(params.amountCrypto, params.network ?? 'trc20')
                : params.amountCrypto,
            )}</code>`
          : params.amountUsd != null
            ? `💰 <b>${fieldLabel(lang, 'К оплате', 'Send exactly')}</b>\n<code>${formatPayCryptoAmount(params.amountUsd, params.network ?? 'trc20')}</code>`
            : '',
        params.walletAddress
          ? `\n📬 <b>${fieldLabel(lang, 'Адрес кошелька', 'Wallet address')}</b>\n<code>${escapeHtml(params.walletAddress)}</code>`
          : '',
        params.orderId
          ? `\n🆔 <b>${fieldLabel(lang, 'ID заявки', 'Deposit ID')}</b>\n<code>${escapeHtml(params.orderId)}</code>`
          : '',
        params.amountUsd != null
          ? `\n\n💵 ${fieldLabel(lang, 'Сумма в USD', 'USD amount')} · <b>$${params.amountUsd.toFixed(2)}</b>`
          : '',
        '',
        SEP,
        '',
        lang === 'ru'
          ? '<i>Переведите <b>точную сумму</b> на адрес выше. Нажмите на строку — скопируется. Баланс обновится после подтверждения в сети.</i>'
          : '<i>Send the <b>exact amount</b> to the address above. Tap a line to copy. Balance updates after network confirmation.</i>',
      ].filter(Boolean).join('\n')
      return {
        text: card(
          lang === 'ru' ? '💳 Депозит создан' : '💳 Deposit created',
          body,
          lang,
        ),
      }
    }

    case 'payment_received':
      return {
        text: card(
          lang === 'ru' ? '✅ Оплата получена' : '✅ Payment received',
          [
            params.orderId ? (lang === 'ru' ? `Заказ · <code>${escapeHtml(params.orderId)}</code>` : `Order · <code>${escapeHtml(params.orderId)}</code>`) : '',
            params.amountUsd != null
              ? (lang === 'ru' ? `Сумма · <b>$${params.amountUsd.toFixed(2)}</b>` : `Amount · <b>$${params.amountUsd.toFixed(2)}</b>`)
              : '',
            params.time ? `🕐 ${escapeHtml(params.time)}` : '',
            '',
            lang === 'ru' ? 'Заказ передан в обработку. Статус — в приложении.' : 'Your order is being processed. Check status in the app.',
          ].filter(Boolean).join('\n'),
          lang,
        ),
        buttonText: btn(lang, 'Статус заказа', 'Order status'),
      }

    case 'deposit_credited':
      return {
        text: card(
          lang === 'ru' ? '✅ Баланс пополнен' : '✅ Balance credited',
          [
            params.amountUsd != null
              ? (lang === 'ru' ? `Зачислено · <b>$${params.amountUsd.toFixed(2)}</b>` : `Credited · <b>$${params.amountUsd.toFixed(2)}</b>`)
              : '',
            params.time ? `🕐 ${escapeHtml(params.time)}` : '',
            '',
            lang === 'ru' ? 'Средства уже на балансе в приложении.' : 'Funds are available in the app balance.',
          ].filter(Boolean).join('\n'),
          lang,
        ),
        buttonText: btn(lang, 'Открыть баланс', 'Open balance'),
      }

    case 'order_delivered':
      return {
        text: card(
          lang === 'ru' ? '📦 Заказ выдан' : '📦 Order delivered',
          [
            params.productTitle ? escapeHtml(params.productTitle) : '',
            params.amountUsd != null ? `$${params.amountUsd.toFixed(2)}` : '',
            '',
            lang === 'ru'
              ? 'Данные для доступа уже в приложении.'
              : 'Access details are ready in the app.',
          ].filter(Boolean).join('\n'),
          lang,
        ),
        buttonText: btn(lang, 'Открыть заказ', 'Open order'),
      }

    case 'ref_approved':
      return {
        text: card(
          lang === 'ru' ? '✅ Выплата одобрена' : '✅ Payout approved',
          [
            params.amountUsd != null
              ? (lang === 'ru' ? `Сумма · <b>$${params.amountUsd.toFixed(2)}</b>` : `Amount · <b>$${params.amountUsd.toFixed(2)}</b>`)
              : '',
            params.cryptoName ? (lang === 'ru' ? `Сеть · ${escapeHtml(params.cryptoName)}` : `Asset · ${escapeHtml(params.cryptoName)}`) : '',
            params.txid ? `TX · <code>${escapeHtml(truncate(params.txid, 48))}</code>` : '',
            params.refId ? `ID · <code>${escapeHtml(params.refId)}</code>` : '',
          ].filter(Boolean).join('\n'),
          lang,
        ),
        buttonText: btn(lang, 'Реф. баланс', 'Referral balance'),
      }

    case 'ref_rejected':
      return {
        text: card(
          lang === 'ru' ? '↩️ Вывод отклонён' : '↩️ Withdrawal declined',
          [
            params.refId ? `ID · <code>${escapeHtml(params.refId)}</code>` : '',
            params.amountUsd != null
              ? (lang === 'ru'
                ? `Сумма · <b>$${params.amountUsd.toFixed(2)}</b> возвращена на реф. баланс`
                : `<b>$${params.amountUsd.toFixed(2)}</b> returned to referral balance`)
              : '',
            params.reason
              ? (lang === 'ru' ? `\nПричина:\n<blockquote>${escapeHtml(truncate(params.reason, 400))}</blockquote>` : `\nReason:\n<blockquote>${escapeHtml(truncate(params.reason, 400))}</blockquote>`)
              : '',
          ].filter(Boolean).join('\n'),
          lang,
        ),
        buttonText: btn(lang, 'Открыть приложение', 'Open app'),
      }

    default:
      return {
        text: card(lang === 'ru' ? '📬 Уведомление' : '📬 Notification', '', lang),
        buttonText: btn(lang, 'Открыть приложение', 'Open app'),
      }
  }
}

const START_MARK = '🛍 FANVUE MARKET 🛍'

export const WELCOME: Record<NotifyLang, string> = {
  ru: `${START_MARK}

<i>Премиум-маркет аккаунтов Fanvue</i>

━━━━━━━━━━━━━━━━
Проверенные аккаунты, прохождение верификации и пополнение баланса криптой — в одном мини-приложении. Без лишних шагов.

<b>Почему выбирают нас</b>
✦ Моментальная выдача после подтверждения оплаты
✦ Поддержка и сопровождение сделки
✦ USDT · BTC · ETH · SOL — конфиденциально

<i>Выберите язык и нажмите кнопку ниже — маркет откроется прямо в Telegram.</i>`,
  en: `${START_MARK}

<i>Premium Fanvue accounts marketplace</i>

━━━━━━━━━━━━━━━━
Verified accounts, verification services and crypto balance top-up — in one mini app. No clutter.

<b>Why creators choose us</b>
✦ Instant delivery after payment confirmation
✦ Support through every step
✦ USDT · BTC · ETH · SOL — private checkout

<i>Pick your language, then tap below to open the market inside Telegram.</i>`,
}

export const OPEN_BTN: Record<NotifyLang, string> = {
  ru: START_MARK,
  en: START_MARK,
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
          text: lang === 'ru' ? '✓ Русский' : 'Русский',
          callback_data: 'lang:ru',
        },
        {
          text: lang === 'en' ? '✓ English' : 'English',
          callback_data: 'lang:en',
        },
      ],
    ],
  }
}
