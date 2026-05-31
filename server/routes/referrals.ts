import { Router, type Request, type Response } from "express";
import { verifyInitData } from "../telegram.js";
import { getReferralPayloadForUid } from "../referrals.js";

const router = Router();

router.get("/api/referrals", (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(getReferralPayloadForUid(user.id));
});

export default router;
