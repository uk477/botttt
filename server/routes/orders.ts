import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { verifyInitData, isAdmin, notifyAdmin, notifyUserWithButton } from "../telegram.js";
import { orders } from "../db.js";
import { ENV } from "../env.js";
import { fetchLiveRates, usdToCrypto } from "../blockchain/rates.js";

const router = Router();

const VALID_NETWORKS = new Set([
  "trc20", "erc20", "bep20", "eth", "sol", "btc", "usdc_eth", "usdc_sol", "ton",
]);

const orderLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── GET /api/config/wallets — public runtime wallet addresses ──────

router.get("/api/config/wallets", (_req: Request, res: Response) => {
  res.json({ addresses: ENV.addr });
});

// ── Unique amount generation (same 3-decimal logic as client) ───────

const usedAmounts = new Map<number, number>();

function generateUniqueAmount(base: number): number {
  const MAX = 50;
  for (let i = 0; i < MAX; i++) {
    const buf = crypto.randomBytes(2);
    const raw = ((buf[0] << 8) | buf[1]) % 990 + 10;
    const offset = raw / 10000;
    const amount = Math.round((base + offset) * 1000) / 1000;
    if (!usedAmounts.has(amount)) {
      usedAmounts.set(amount, Date.now());
      if (usedAmounts.size > 5000) {
        const cutoff = Date.now() - 3600_000;
        for (const [k, ts] of usedAmounts) {
          if (ts < cutoff) usedAmounts.delete(k);
        }
      }
      return amount;
    }
  }
  const fb = crypto.randomBytes(2);
  const raw = ((fb[0] << 8) | fb[1]) % 990 + 10;
  return Math.round((base + raw / 10000) * 1000) / 1000;
}

function generateOrderId(kind: "buy" | "deposit" = "buy"): string {
  const prefix = kind === "deposit" ? "DEP" : "ORD";
  const ts = Date.now().toString(36).toUpperCase();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = crypto.randomBytes(4);
  let rand = "";
  for (let i = 0; i < 4; i++) rand += alphabet[arr[i] % alphabet.length];
  return `${prefix}-${ts}-${rand}`;
}

// ── POST /api/order — create a new order ────────────────────────────

router.post("/api/order", orderLimiter, async (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { kind = "deposit", amount_usd, network } = req.body as {
    kind?: "buy" | "deposit";
    amount_usd: number;
    network: string;
  };

  if (kind !== "buy" && kind !== "deposit") {
    res.status(400).json({ error: "Invalid kind" });
    return;
  }

  if (!amount_usd || typeof amount_usd !== "number" || amount_usd < 1 || amount_usd > 50000) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  if (!network || typeof network !== "string" || !VALID_NETWORKS.has(network)) {
    res.status(400).json({ error: "Invalid network" });
    return;
  }

  const wallet = ENV.addr[network];
  if (!wallet) {
    res.status(400).json({ error: `No wallet configured for network: ${network}` });
    return;
  }

  const uniqueUsd = generateUniqueAmount(amount_usd);

  let rates;
  try {
    rates = await fetchLiveRates();
  } catch {
    rates = null;
  }
  const amountCrypto = usdToCrypto(uniqueUsd, network, rates);

  const id = generateOrderId(kind as "buy" | "deposit");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  orders.create({
    id,
    uid: user.id,
    kind,
    amount_usd: uniqueUsd,
    amount_crypto: amountCrypto,
    network,
    wallet,
    expires_at: expiresAt,
  });

  console.log(
    `[order] created ${id} | ${network} | $${uniqueUsd} | ${amountCrypto} crypto | uid=${user.id}`,
  );

  const userName = user.username ? `@${user.username}` : user.first_name;
  const isDeposit = kind === "deposit";
  const time = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });

  notifyAdmin(
    isDeposit
      ? `<b>Новый депозит</b>\n\n${userName} · $${uniqueUsd.toFixed(2)}\n${network.toUpperCase()} · ${time}\n<code>${id}</code>`
      : `<b>Новый заказ</b>\n\n${userName} · $${uniqueUsd.toFixed(2)}\n${network.toUpperCase()} · ${time}\n<code>${id}</code>`,
  );

  notifyUserWithButton(
    user.id,
    isDeposit
      ? `<b>Депозит создан</b>\n\nСумма: <b>$${uniqueUsd.toFixed(2)}</b>\nСеть: ${network.toUpperCase()}\n\nПереведите указанную сумму на адрес в приложении. После подтверждения сети средства зачислятся автоматически.`
      : `<b>Заказ оформлен</b>\n\nСумма: <b>$${uniqueUsd.toFixed(2)}</b>\nСеть: ${network.toUpperCase()}\nНомер: <code>${id}</code>\n\nОплатите заказ в приложении. После подтверждения оплаты мы начнём обработку.`,
    isDeposit ? "Перейти к оплате" : "Оплатить заказ",
  );

  res.json({
    id,
    address: wallet,
    amount_usd: uniqueUsd,
    amount_crypto: amountCrypto,
    expires_at: expiresAt,
  });
});

// ── GET /api/order/:id — check order status (auth required) ─────────

router.get("/api/order/:id", (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  orders.expireOld();
  const order = orders.get(req.params.id as string);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.uid !== user.id && !isAdmin(user.id)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({
    id: order.id,
    status: order.status,
    amount_usd: order.amount_usd,
    amount_crypto: order.amount_crypto,
    network: order.network,
    tx_hash: order.tx_hash,
    created_at: order.created_at,
    expires_at: order.expires_at,
    paid_at: order.paid_at,
    completed_at: order.completed_at,
  });
});

// ── GET /api/orders — list user's orders ────────────────────────────

router.get("/api/orders", (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  orders.expireOld();
  res.json({ orders: orders.getByUid(user.id) });
});

export default router;
