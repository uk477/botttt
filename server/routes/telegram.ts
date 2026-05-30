import { Router, type Request, type Response } from "express";
import { ENV } from "../env.js";
import {
  sendMessageWithKeyboard,
  editMessageText,
  answerCallbackQuery,
} from "../telegram.js";

const router = Router();

type Lang = "ru" | "en";

const WELCOME: Record<Lang, string> = {
  ru: `<b>Fanvue Market</b>

Верифицированные аккаунты, прохождение верификации и пополнение криптой — всё в одном приложении.

✦ Моментальная выдача после оплаты
✦ Гарантия возврата при отказе
✦ Анонимно и безопасно

Нажми кнопку ниже, чтобы открыть маркет.`,
  en: `<b>Fanvue Market</b>

Verified accounts, verification services and crypto top-up — all in one app.

✦ Instant delivery after payment
✦ Money-back guarantee if declined
✦ Anonymous and secure

Tap the button below to open the market.`,
};

const OPEN_BTN: Record<Lang, string> = {
  ru: "🛍 FANVUE MARKET 🛍",
  en: "🛍 FANVUE MARKET 🛍",
};

function buildKeyboard(lang: Lang) {
  const url = ENV.webAppUrl;
  const openBtn = url
    ? [{ text: OPEN_BTN[lang], web_app: { url } }]
    : [{ text: OPEN_BTN[lang], url: "https://t.me/" }];
  return {
    inline_keyboard: [
      openBtn,
      [
        { text: lang === "ru" ? "✅ Русский" : "Русский", callback_data: "lang:ru" },
        { text: lang === "en" ? "✅ English" : "English", callback_data: "lang:en" },
      ],
    ],
  };
}

function detectLang(code?: string): Lang {
  return code && code.toLowerCase().startsWith("ru") ? "ru" : "en";
}

router.post("/api/telegram/webhook", async (req: Request, res: Response) => {
  // Optional secret-token check
  if (ENV.webhookSecret) {
    const got = req.header("x-telegram-bot-api-secret-token") || "";
    if (got !== ENV.webhookSecret) {
      res.status(401).json({ ok: false });
      return;
    }
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
      const lang = detectLang(update.message.from?.language_code);
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
      await answerCallbackQuery(cb.id, lang === "ru" ? "Русский" : "English");
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