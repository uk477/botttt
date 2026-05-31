import { Router, type Request, type Response } from "express";
import { ENV } from "../env.js";
import { settings, users } from "../db.js";
import {
  sendMessageWithKeyboard,
  editMessageText,
  answerCallbackQuery,
} from "../telegram.js";
import {
  WELCOME,
  buildStartKeyboard,
  type NotifyLang,
} from "../../shared/telegramTemplates.js";

const router = Router();

type Lang = NotifyLang;

function buildKeyboard(lang: Lang) {
  return buildStartKeyboard(lang, ENV.webAppUrl);
}

function detectLang(code?: string): Lang {
  return code && code.toLowerCase().startsWith("ru") ? "ru" : "en";
}

router.post("/api/telegram/webhook", async (req: Request, res: Response) => {
  const got = req.header("x-telegram-bot-api-secret-token") || "";
  if (!ENV.webhookSecret) {
    console.warn("[webhook] TELEGRAM_WEBHOOK_SECRET not set — webhook is unprotected!");
  } else if (got !== ENV.webhookSecret) {
    res.status(401).json({ ok: false });
    return;
  }

  // Respond fast; process async
  res.json({ ok: true });

  try {
    const update = req.body as {
      message?: {
        chat: { id: number };
        from?: { language_code?: string };
        text?: string;
      };
      callback_query?: {
        id: string;
        from: { language_code?: string };
        message?: { chat: { id: number }; message_id: number };
        data?: string;
      };
    };

    if (update.message?.text?.startsWith("/start")) {
      const from = update.message.from;
      const lang = detectLang(from?.language_code);
      if (from?.id) {
        users.upsert({
          uid: from.id,
          username: from.username ?? null,
          full_name: [from.first_name, from.last_name].filter(Boolean).join(" ") || null,
        });
      }
      await sendMessageWithKeyboard(
        update.message.chat.id,
        WELCOME[lang],
        buildKeyboard(lang),
      );
      return;
    }

    if (update.callback_query?.data?.startsWith("lang:")) {
      const cb = update.callback_query;
      const lang: Lang = cb.data === "lang:ru" ? "ru" : "en";
      if (cb.from?.id) {
        settings.set(`user_lang:${cb.from.id}`, lang);
        users.upsert({
          uid: cb.from.id,
          username: cb.from.username ?? null,
          full_name: [cb.from.first_name, cb.from.last_name].filter(Boolean).join(" ") || null,
        });
      }
      await answerCallbackQuery(cb.id, lang === "ru" ? "Язык: русский" : "Language: English");
      if (cb.message) {
        await editMessageText(
          cb.message.chat.id,
          cb.message.message_id,
          WELCOME[lang],
          buildKeyboard(lang),
        );
      }
    }
  } catch (e) {
    console.error("[telegram webhook]", e);
  }
});

export default router;