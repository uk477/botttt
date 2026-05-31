import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import {
  adminBalanceOrder,
  adminNewDeposit,
  adminNewOrder,
} from "../../shared/telegramTemplates.js";
import { verifyInitData, isAdmin, notifyAdmin, notifyUserTemplated } from "../telegram.js";
import { readMaintenanceFlag } from "../storeConfig.js";
import { orders, users, products, adminLogs } from "../db.js";
import { ENV } from "../env.js";
import { getPublicStoreConfig } from "../storeConfig.js";
import { fetchLiveRates, usdToCrypto } from "../blockchain/rates.js";
import { toSqliteUtc } from "../utils/sqliteTime.js";

const router = Router();

const VALID_NETWORKS = new Set([
  "trc20", "erc20", "bep20", "eth", "sol", "btc", "usdc_eth", "usdc_sol", "ton",
]);

const orderCreateLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many orders, try again in a minute" },
});

const orderCancelLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── GET /api/config/app — public storefront config (synced from admin) ───

router.get("/api/config/app", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json(getPublicStoreConfig());
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

router.post("/api/order", orderCreateLimiter, async (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (readMaintenanceFlag() && !isAdmin(user.id)) {
    res.status(503).json({ error: "maintenance", message: "Shop is under maintenance" });
    return;
  }

  const { kind = "deposit", amount_usd, network, product_id, quantity } = req.body as {
    kind?: "buy" | "deposit";
    amount_usd: number;
    network: string;
    product_id?: number;
    quantity?: number;
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

  const cancelled = orders.expireAllPendingCryptoForUid(user.id);
  if (cancelled.length > 0) {
    console.log(
      `[order] expired ${cancelled.length} pending invoice(s) for uid=${user.id} before new ${kind}`,
    );
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
  const expiresAt = toSqliteUtc(new Date(Date.now() + 30 * 60 * 1000));

  let productTitle: string | undefined;
  let productQty: number | undefined;
  if (kind === "buy" && product_id) {
    const p = products.get(Number(product_id));
    if (p) {
      productTitle = p.title;
      productQty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
    }
  }

  orders.create({
    id,
    uid: user.id,
    kind,
    amount_usd: uniqueUsd,
    amount_crypto: amountCrypto,
    network,
    wallet,
    expires_at: expiresAt,
    product_id: kind === "buy" && product_id ? Number(product_id) : null,
    product_title: productTitle ?? null,
    quantity: productQty ?? null,
  });

  console.log(
    `[order] created ${id} | ${network} | $${uniqueUsd} | ${amountCrypto} crypto | uid=${user.id}`,
  );

  const userLabel = user.username
    ? `@${user.username} · ID ${user.id}`
    : `${user.first_name} · ID ${user.id}`;
  const isDeposit = kind === "deposit";
  const time = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });

  notifyAdmin(
    isDeposit
      ? adminNewDeposit({
          userLabel,
          amountUsd: uniqueUsd,
          network,
          orderId: id,
          time,
        })
      : adminNewOrder({
          userLabel,
          amountUsd: uniqueUsd,
          network,
          orderId: id,
          time,
          product: productTitle,
          qty: productQty,
        }),
  );

  // Покупателю не шлём «заказ создан» — только после подтверждения оплаты (finalizeCompletedOrder).

  res.json({
    id,
    address: wallet,
    amount_usd: uniqueUsd,
    amount_crypto: amountCrypto,
    expires_at: expiresAt,
  });
});

// ── POST /api/purchase/balance — pay for product from account balance ─

router.post("/api/purchase/balance", orderCreateLimiter, (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (readMaintenanceFlag() && !isAdmin(user.id)) {
    res.status(503).json({ error: "maintenance" });
    return;
  }

  const { product_id, quantity = 1, amount_usd } = req.body as {
    product_id?: number;
    quantity?: number;
    amount_usd?: number;
  };

  const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
  const productId = Number(product_id);
  if (!productId || productId <= 0) {
    res.status(400).json({ error: "Invalid product" });
    return;
  }

  const product = products.get(productId);
  if (!product || !product.active) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const total = Number(amount_usd);
  const expected = Math.round(product.price * qty * 100) / 100;
  if (!total || Math.abs(total - expected) > 0.02) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  if (product.delivery === "auto" && product.stock < qty) {
    res.status(400).json({ error: "Out of stock" });
    return;
  }

  const debited = users.debitPurchase(user.id, total, qty);
  if (!debited) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const id = generateOrderId("buy");
  const expiresAt = toSqliteUtc(new Date(Date.now() + 30 * 60 * 1000));
  orders.create({
    id,
    uid: user.id,
    kind: "buy",
    amount_usd: total,
    amount_crypto: 0,
    network: "balance",
    wallet: "",
    expires_at: expiresAt,
    product_id: productId,
    product_title: product.title,
    quantity: qty,
  });
  orders.markPaid(id, "balance");
  orders.markCompleted(id);

  if (product.delivery === "auto" && product.stock >= qty) {
    let autoItems: string[] = [];
    try {
      autoItems = JSON.parse(product.auto_items || "[]") as string[];
    } catch {
      autoItems = [];
    }
    products.upsert({
      id: product.id,
      cat_id: product.cat_id,
      title: product.title,
      title_en: product.title_en,
      description: product.description,
      desc_en: product.desc_en,
      price: product.price,
      delivery: product.delivery,
      stock: Math.max(0, product.stock - qty),
      active: !!product.active,
      auto_items: autoItems,
      pinned: !!product.pinned,
      image_url: product.image_url,
    });
  }

  const title = product.title;
  const time = new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  });
  const balanceUserLabel = user.username
    ? `@${user.username} · ID ${user.id}`
    : `${user.first_name} · ID ${user.id}`;

  adminLogs.add({
    type: "payment",
    uid: user.id,
    username: user.username ?? null,
    kind: "buy",
    amount: total,
    network: "balance",
    status: "success",
    product: title,
  });

  notifyAdmin(
    adminBalanceOrder({
      userLabel: balanceUserLabel,
      product: title,
      qty,
      amountUsd: total,
      orderId: id,
      time,
    }),
  );

  const lang = user.language_code?.toLowerCase().startsWith("ru") ? "ru" : "en";
  notifyUserTemplated(
    user.id,
    "payment_received",
    { amountUsd: total, orderId: id, productTitle: title, network: "balance", time },
    lang,
  );

  res.json({
    ok: true,
    order: {
      id,
      kind: "buy",
      product_id: productId,
      product_title: title,
      amount_usd: total,
      quantity: qty,
      status: "completed",
      network: "balance",
      created_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    },
    balance: debited.balance,
    spent: debited.spent,
    purchases: debited.purchases,
  });
});

// ── POST /api/order/:id/cancel — cancel own pending order ───────────

router.post("/api/order/:id/cancel", orderCancelLimiter, (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const order = orders.get(req.params.id as string);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.uid !== user.id && !isAdmin(user.id)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (order.status !== "pending") {
    res.json({ ok: true, status: order.status, already_closed: true });
    return;
  }

  orders.expire(order.id);
  res.json({ ok: true, status: "expired" });
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
