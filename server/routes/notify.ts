import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import {
  verifyInitData,
  isAdmin,
  notifyAdmin,
  notifyUser,
  notifyUserWithButton,
  notifyUserTemplated,
} from "../telegram.js";
import type { NotifyLang, UserNotifyKind, UserNotifyPayload } from "../../shared/telegramTemplates.js";

const router = Router();

const notifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/api/notify", notifyLimiter, async (req: Request, res: Response) => {
  const initData =
    (req.headers["x-telegram-init-data"] as string) || req.body?.initData || "";

  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { text, chatId, buttonText, template, params, lang } = req.body as {
    text?: string;
    chatId?: number;
    buttonText?: string;
    template?: UserNotifyKind;
    params?: UserNotifyPayload;
    lang?: NotifyLang;
  };

  if (chatId) {
    if (!isAdmin(user.id)) {
      res.status(403).json({ error: "Only admins can send to specific users" });
      return;
    }
    if (!Number.isInteger(chatId) || chatId <= 0) {
      res.status(400).json({ error: "Invalid chatId" });
      return;
    }
    const notifyLang: NotifyLang = lang === "en" ? "en" : "ru";
    let ok: boolean;
    if (template) {
      ok = await notifyUserTemplated(chatId, template, params ?? {}, notifyLang);
    } else {
      if (!text || typeof text !== "string" || text.length > 4000) {
        res.status(400).json({ error: "Invalid text" });
        return;
      }
      ok = buttonText
        ? await notifyUserWithButton(chatId, text, buttonText)
        : await notifyUser(chatId, text);
    }
    console.log(`[notify] user chatId=${chatId} ok=${ok}`);
    res.json({ ok });
    return;
  }

  if (!text || typeof text !== "string" || text.length > 4000) {
    res.status(400).json({ error: "Invalid text" });
    return;
  }

  {
    const ok = await notifyAdmin(text);
    console.log(`[notify] admin ok=${ok}`);
    res.json({ ok });
  }
});

export default router;
