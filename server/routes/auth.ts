import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { verifyInitData, isAdmin } from "../telegram.js";
import { users, settings } from "../db.js";
import { persistUserLangIfMissing } from "../userLang.js";
import { readMaintenanceFlag } from "../storeConfig.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/api/auth", authLimiter, (req: Request, res: Response) => {
  const initData =
    (req.headers["x-telegram-init-data"] as string) || req.body?.initData || "";

  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Invalid Telegram initData" });
    return;
  }

  const row = users.upsert({
    uid: user.id,
    username: user.username ?? null,
    full_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
  });

  const preferred_lang = persistUserLangIfMissing(user.id, user.language_code);

  res.json({
    uid: user.id,
    first_name: user.first_name,
    last_name: user.last_name ?? "",
    username: user.username ?? "",
    photo_url: user.photo_url ?? "",
    language_code: user.language_code ?? "en",
    preferred_lang,
    isAdmin: isAdmin(user.id),
    maintenance: readMaintenanceFlag(),
    balance: row.balance,
    spent: row.spent,
    purchases: row.purchases,
    ref_earned: row.ref_earned,
    ref_count: row.ref_count,
    ref_balance: row.ref_balance,
  });
});

router.post("/api/admin/user/:uid/balance", (req: Request, res: Response) => {
  const initData =
    (req.headers["x-telegram-init-data"] as string) || req.body?.initData || "";
  const admin = verifyInitData(initData);
  if (!admin || !isAdmin(admin.id)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const uid = Number(req.params.uid);
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    res.status(400).json({ error: "Invalid balance credit" });
    return;
  }

  const row = users.credit(uid, amount);
  res.json({ ok: true, uid: row.uid, balance: row.balance });
});

router.post("/api/user/lang", authLimiter, (req: Request, res: Response) => {
  const initData =
    (req.headers["x-telegram-init-data"] as string) || req.body?.initData || "";

  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Invalid Telegram initData" });
    return;
  }

  const lang = req.body?.lang;
  if (lang !== "ru" && lang !== "en") {
    res.status(400).json({ error: "Invalid lang" });
    return;
  }

  settings.set(`user_lang:${user.id}`, lang);
  res.json({ ok: true, lang });
});

export default router;
