import { CONFIG } from '../config'
import { getTelegramInitData } from './security'

/**
 * Sends a Telegram notification via the backend /api/notify endpoint.
 *
 * Two modes:
 * - Admin notification (no userChatId) → goes to NOTIFY_CHAT_ID (admin's bot/group)
 * - User notification  (with userChatId) → goes to user's Telegram DM via the bot
 *
 * The backend is expected to:
 *   POST body: { text, initData, chatId? }
 *   - If chatId is provided → send message to that chat
 *   - Otherwise → send to the configured admin chat
 */

const NOTIFY_URL = CONFIG.apiUrl
  ? `${CONFIG.apiUrl}/api/notify`
  : '/api/notify'

async function send(text: string, chatId?: number): Promise<void> {
  try {
    await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': getTelegramInitData(),
      },
      body: JSON.stringify({
        text,
        initData: getTelegramInitData(),
        ...(chatId ? { chatId } : {}),
      }),
    })
  } catch { /* best-effort — notifications must never block UX */ }
}

/** Notification to admin (your personal bot / admin group) */
export function notifyAdmin(text: string): void {
  send(text)
}

/** Notification to a specific user's Telegram DM */
export function notifyUser(chatId: number, text: string): void {
  if (!chatId || chatId <= 0) return
  send(text, chatId)
}

/**
 * Legacy-compatible wrapper: admin notification by default,
 * user notification if userChatId is provided.
 */
export async function tgNotify(text: string, userChatId?: number): Promise<void> {
  if (userChatId) {
    notifyUser(userChatId, text)
  } else {
    notifyAdmin(text)
  }
}
