import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { verifyInitData, isAdmin, notifyUser } from "../telegram.js";
import { orders, users, settings, refWithdrawals } from "../db.js";
import { ENV } from "../env.js";

const router = Router();

function requireAdmin(req: Request, res: Response): number | null {
  const initData =
    (req.headers["x-telegram-init-data"] as string) || req.body?.initData || "";
  const user = verifyInitData(initData);
  if (!user || !isAdmin(user.id)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return user.id;
}

// ── Admin Orders ─────────────────────────────────────────────────
router.get("/api/admin/orders", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  orders.expireOld();
  const all = orders.getAllPending();
  res.json(all);
});

router.patch("/api/admin/order/:id", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const id = req.params.id as string;
  const order = orders.get(id);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const { status } = req.body;
  if (status === "paid") orders.markPaid(order.id, req.body.tx_hash || "manual");
  else if (status === "completed") orders.markCompleted(order.id);
  else if (status === "expired") orders.expire(order.id);
  res.json({ ok: true });
});

router.delete("/api/admin/order/:id", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  orders.expire(req.params.id as string);
  res.json({ ok: true });
});

// ── Admin Users ──────────────────────────────────────────────────
router.get("/api/admin/users", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json([]);
});

// ── Admin Settings (wallet addresses, ref withdraw networks, site config) ──
router.get("/api/admin/settings", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const all = settings.getAll();
  res.json({ ...all, addresses: ENV.addr });
});

router.post("/api/admin/settings", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const body = req.body as Record<string, unknown>;

  if (body.addresses && typeof body.addresses === "object") {
    for (const [net, addr] of Object.entries(body.addresses as Record<string, string>)) {
      if (typeof addr === "string" && addr.length < 200) {
        ENV.setAddr(net, addr);
      }
    }
  }

  const allowedKeys = [
    "refWithdrawNetworks",
    "siteLinks", "siteContent",
    "customization",
  ];
  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      settings.set(key, JSON.stringify(body[key]));
    }
  }

  res.json({ ok: true });
});

// ── Ref withdraw settings ────────────────────────────────────────
router.get("/api/ref/settings", (_req: Request, res: Response) => {
  const raw = settings.get("refWithdrawNetworks");
  const networks = raw ? JSON.parse(raw) : ["trc20", "btc"];
  res.json({ networks });
});

// ── Ref Withdrawals (user) ───────────────────────────────────────
const refWithdrawLimiter = rateLimit({ windowMs: 120_000, max: 3 });

router.post("/api/ref/withdraw", refWithdrawLimiter, (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { amount, network, address } = req.body as { amount: number; network: string; address: string };
  if (!amount || amount < 1 || amount > 10000) {
    res.status(400).json({ error: "Invalid amount" }); return;
  }
  if (!network || typeof network !== "string") {
    res.status(400).json({ error: "Invalid network" }); return;
  }
  if (!address || typeof address !== "string" || address.length < 10 || address.length > 100) {
    res.status(400).json({ error: "Invalid address" }); return;
  }

  const userRow = users.get(user.id);
  if (!userRow || userRow.ref_balance < amount) {
    res.status(400).json({ error: "Insufficient ref balance" }); return;
  }

  const id = `RW-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  refWithdrawals.create({ id, uid: user.id, amount, network, address });

  res.json({ ok: true, id });
});

router.get("/api/ref/withdrawals", (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json(refWithdrawals.getByUid(user.id));
});

// ── Admin Ref Withdrawals ────────────────────────────────────────
router.get("/api/admin/ref-withdrawals", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json(refWithdrawals.getAll());
});

router.patch("/api/admin/ref-withdrawal/:id", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const rw = refWithdrawals.get(req.params.id as string);
  if (!rw) { res.status(404).json({ error: "Not found" }); return; }

  const { action, txid, reason } = req.body as { action: string; txid?: string; reason?: string };
  if (action === "approve") {
    refWithdrawals.approve(rw.id, txid || "");
    notifyUser(rw.uid, `✅ Вывод $${rw.amount} одобрен! TX: ${txid || "—"}`);
  } else if (action === "reject") {
    refWithdrawals.reject(rw.id, reason || "");
    notifyUser(rw.uid, `❌ Вывод $${rw.amount} отклонён. ${reason || ""}`);
  }

  res.json({ ok: true });
});

// ── Admin Logs ───────────────────────────────────────────────────
router.get("/api/admin/logs", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json([]);
});

export default router;
