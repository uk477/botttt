import crypto from "node:crypto";
import { ENV } from "./env.js";
import {
  buildUserNotification,
  type NotifyLang,
  type UserNotifyKind,
  type UserNotifyPayload,
} from "../shared/telegramTemplates.js";

const ADMIN_SALT = "fanvue:admin:v1:";
const TG_API = `https://api.telegram.org/bot${ENV.botToken}`;
const NOTIFY_API = ENV.notifyBotToken
  ? `https://api.telegram.org/bot${ENV.notifyBotToken}`
  : TG_API;

// ── Telegram initData HMAC-SHA256 verification ──────────────────────
// See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export function verifyInitData(initData: string): TelegramUser | null {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    params.delete("hash");
    const pairs = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(ENV.botToken)
      .digest();

    const computed = crypto
      .createHmac("sha256", secretKey)
      .update(pairs)
      .digest("hex");

    if (computed !== hash) return null;

    const authDate = Number(params.get("auth_date") || 0);
    if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}

// ── Admin hash verification (server-side, same algo as client) ──────

export function computeAdminHash(uid: number): string {
  return crypto
    .createHash("sha256")
    .update(`${ADMIN_SALT}${uid}`)
    .digest("hex");
}

export function isAdmin(uid: number): boolean {
  const hash = computeAdminHash(uid);
  return ENV.adminHashes.some((h) => h === hash);
}

// ── Telegram Bot API: send messages ─────────────────────────────────

export async function sendMessage(
  chatId: number | string,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
  entities?: import("../shared/telegramTemplates.js").TelegramMessageEntity[],
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (entities?.length) {
      body.entities = entities;
    } else {
      body.parse_mode = parseMode;
    }
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      console.error(
        `[telegram] sendMessage failed → chat_id=${chatId} :: ${data.description ?? "unknown error"}`,
      );
    }
    return data.ok;
  } catch (e) {
    console.error("[telegram] sendMessage error:", e);
    return false;
  }
}

export async function sendMessageWithKeyboard(
  chatId: number | string,
  text: string,
  replyMarkup: unknown,
  parseMode: "HTML" | "Markdown" = "HTML",
): Promise<{ ok: boolean; messageId?: number }> {
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        reply_markup: replyMarkup,
      }),
    });
    const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
    return { ok: data.ok, messageId: data.result?.message_id };
  } catch (e) {
    console.error("[telegram] sendMessageWithKeyboard error:", e);
    return { ok: false };
  }
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  replyMarkup: unknown,
  parseMode: "HTML" | "Markdown" = "HTML",
): Promise<boolean> {
  try {
    const res = await fetch(`${TG_API}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: parseMode,
        reply_markup: replyMarkup,
      }),
    });
    const data = (await res.json()) as { ok: boolean };
    return data.ok;
  } catch (e) {
    console.error("[telegram] editMessageText error:", e);
    return false;
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${TG_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
    const data = (await res.json()) as { ok: boolean };
    return data.ok;
  } catch (e) {
    console.error("[telegram] answerCallbackQuery error:", e);
    return false;
  }
}

async function notifySend(
  chatId: number | string,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
): Promise<boolean> {
  try {
    const res = await fetch(`${NOTIFY_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) console.error(`[notify] failed → chat_id=${chatId} :: ${data.description}`);
    return data.ok;
  } catch (e) {
    console.error("[notify] error:", e);
    return false;
  }
}

async function notifySendKeyboard(
  chatId: number | string,
  text: string,
  replyMarkup: unknown,
  parseMode: "HTML" | "Markdown" = "HTML",
): Promise<boolean> {
  try {
    const res = await fetch(`${NOTIFY_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, reply_markup: replyMarkup }),
    });
    const data = (await res.json()) as { ok: boolean };
    return data.ok;
  } catch (e) {
    console.error("[notify] keyboard error:", e);
    return false;
  }
}

export async function notifyAdmin(text: string): Promise<boolean> {
  console.log(`[notify] admin → chat_id=${ENV.adminChatId}`);
  const ok = await notifySend(ENV.adminChatId, text);
  if (ENV.notifyGroupId) {
    notifySend(ENV.notifyGroupId, text).catch(() => {});
  }
  return ok;
}

export async function notifyUser(
  chatId: number,
  text: string,
): Promise<boolean> {
  return sendMessage(chatId, text);
}

export async function notifyUserWithButton(
  chatId: number,
  text: string,
  buttonText = "Открыть приложение",
): Promise<boolean> {
  const url = ENV.webAppUrl;
  if (!url) return sendMessage(chatId, text);
  const { ok } = await sendMessageWithKeyboard(chatId, text, {
    inline_keyboard: [[{ text: buttonText, web_app: { url } }]],
  });
  return ok;
}

/** Plain text broadcast (no HTML parse — avoids broken messages like "Pop"). */
export async function sendBroadcastMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: unknown,
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      console.error(
        `[telegram] broadcast failed → chat_id=${chatId} :: ${data.description ?? "unknown"}`,
      );
    }
    return data.ok;
  } catch (e) {
    console.error("[telegram] broadcast error:", e);
    return false;
  }
}

export async function notifyUserBroadcast(
  chatId: number,
  text: string,
  replyMarkup: unknown | undefined,
): Promise<boolean> {
  return sendBroadcastMessage(chatId, text, replyMarkup);
}

export async function notifyUserTemplated(
  chatId: number,
  kind: UserNotifyKind,
  params: UserNotifyPayload,
  lang: NotifyLang = "ru",
): Promise<boolean> {
  // Покупателю — только текст, без inline-кнопок (Оплатить / Открыть приложение).
  if (kind === "order_created" || kind === "deposit_created") return true;
  const built = buildUserNotification(kind, params, lang);
  if (!built.text?.trim()) return true;
  return sendMessage(chatId, built.text, "HTML", built.entities);
}
