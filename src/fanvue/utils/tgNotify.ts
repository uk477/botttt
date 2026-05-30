import { getTelegramInitData } from './security'
import { apiPath } from './apiBase'
import type { NotifyLang, UserNotifyKind, UserNotifyPayload } from '../../../shared/telegramTemplates'

/**
 * Sends a Telegram notification via the backend /api/notify endpoint.
 */

const NOTIFY_URL = apiPath('/api/notify')

type NotifyBody = {
  text?: string
  initData: string
  chatId?: number
  buttonText?: string
  template?: UserNotifyKind
  params?: UserNotifyPayload
  lang?: NotifyLang
}

async function post(body: NotifyBody): Promise<void> {
  try {
    const res = await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': getTelegramInitData(),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.warn(`[tgNotify] ${res.status} ${errBody}`)
    }
  } catch (e) {
    console.warn('[tgNotify] fetch failed:', e)
  }
}

/** Notification to admin (your personal bot / admin group) */
export function notifyAdmin(text: string): void {
  post({ text, initData: getTelegramInitData() })
}

/** Notification to a specific user's Telegram DM (plain text) */
export function notifyUser(chatId: number, text: string): void {
  if (!chatId || chatId <= 0) return
  post({ text, initData: getTelegramInitData(), chatId })
}

/** Templated user notification with inline app button */
export function notifyUserTemplated(
  chatId: number,
  template: UserNotifyKind,
  params: UserNotifyPayload = {},
  lang: NotifyLang = 'ru',
): void {
  if (!chatId || chatId <= 0) return
  post({ initData: getTelegramInitData(), chatId, template, params, lang })
}

/** @deprecated Prefer notifyUserTemplated — kept for custom broadcast text */
export function notifyUserWithButton(chatId: number, text: string, buttonText = 'Открыть приложение'): void {
  if (!chatId || chatId <= 0) return
  post({ text, initData: getTelegramInitData(), chatId, buttonText })
}

export async function tgNotify(text: string, userChatId?: number): Promise<void> {
  if (userChatId) {
    notifyUser(userChatId, text)
  } else {
    notifyAdmin(text)
  }
}
