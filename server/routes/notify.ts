import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { verifyInitData, isAdmin, notifyAdmin, notifyUser, notifyUserWithButton } from "../telegram.js";

const router = Router();

const notifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/api/notify", notifyLimiter, (req: Request, res: Response) => {
  const initData =
    (req.headers["x-telegram-init-data"] as string) || req.body?.initData || "";

  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { text, chatId, buttonText } = req.body as {
    text?: string;
    chatId?: number;
    buttonText?: string;
  };
  if (!text || typeof text !== "string" || text.length > 4000) {
    res.status(400).json({ error: "Invalid text" });
    return;
  }

  if (chatId) {
    if (!isAdmin(user.id)) {
      res.status(403).json({ error: "Only admins can send to specific users" });
      return;
    }
    if (!Number.isInteger(chatId) || chatId <= 0) {
      res.status(400).json({ error: "Invalid chatId" });
      return;
    }
    if (buttonText) {
      notifyUserWithButton(chatId, text, buttonText);
    } else {
      notifyUser(chatId, text);
    }
  } else {
    notifyAdmin(text);
  }

  res.json({ ok: true });
});

export default router;
