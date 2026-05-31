import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { verifyInitData, isAdmin, notifyAdmin, notifyUserTemplated, notifyUserBroadcast } from "../telegram.js";
import {
  buildBroadcastReplyMarkup,
  buildSimpleButtonMarkup,
  validateBroadcastKeyboard,
  type BroadcastKeyboardInput,
} from "../../shared/broadcastKeyboard.js";
import {
  adminSupportInbound,
  type NotifyLang,
} from "../../shared/telegramTemplates.js";
import { getUserNotifyLang } from "../userLang.js";
import {
  orders,
  users,
  settings,
  refWithdrawals,
  refDailyStats,
  products,
  categories,
  broadcasts,
  adminLogs,
  support,
  allUsers,
  stats,
  type ProductRow,
  type CategoryRow,
  type AdminLogRow,
} from "../db.js";
import db from "../db.js";
import { ENV } from "../env.js";
import { finalizeCompletedOrder } from "../orderFinalize.js";
import { mapServerOrder } from "../../shared/orderMap.js";

const router = Router();

function safeParseKeyboard(raw: string): BroadcastKeyboardInput | undefined {
  try {
    const parsed = validateBroadcastKeyboard(JSON.parse(raw));
    return parsed.ok ? parsed.value : undefined;
  } catch {
    return undefined;
  }
}

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

function mapProduct(p: ProductRow) {
  let autoItems: string[] = [];
  try {
    autoItems = JSON.parse(p.auto_items || "[]");
  } catch {
    autoItems = [];
  }
  return {
    id: p.id,
    cat_id: p.cat_id,
    title: p.title,
    title_en: p.title_en,
    description: p.description,
    desc_en: p.desc_en,
    price: p.price,
    delivery: p.delivery as "auto" | "manual",
    stock: p.stock,
    active: !!p.active,
    autoItems,
    image_url: p.image_url ?? undefined,
  };
}

function mapCategory(c: CategoryRow) {
  return {
    id: c.id,
    name: c.name,
    name_en: c.name_en,
    emoji: c.emoji,
    active: !!c.active,
  };
}

function mapLog(l: AdminLogRow) {
  return {
    id: l.id,
    ts: l.created_at,
    uid: l.uid ?? 0,
    username: l.username ?? "",
    kind: l.kind ?? "info",
    amount: l.amount ?? 0,
    network: l.network ?? undefined,
    status: l.status,
    tx_hash: l.tx_hash ?? undefined,
    product: l.product ?? undefined,
  };
}

// ── Public products (catalog) ────────────────────────────────────
router.get("/api/products", (_req: Request, res: Response) => {
  const prods = products.getAll().filter((p) => p.active).map(mapProduct);
  const cats = categories.getAll().filter((c) => c.active).map(mapCategory);
  const pinned = products.getAll().filter((p) => p.pinned).map((p) => p.id);
  res.json({ products: prods, categories: cats, pinned });
});

function mapOrderForClient(o: import("../db.js").OrderRow) {
  return mapServerOrder(o as unknown as Record<string, unknown>);
}

// ── Admin Orders ─────────────────────────────────────────────────
router.get("/api/admin/orders", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  orders.expireOld();
  const rows = req.query.all === "1" ? orders.getAll() : orders.getAllPending();
  res.json(rows.map(mapOrderForClient));
});

router.get("/api/admin/sales", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  orders.expireOld();
  const rows = stats.allCompletedOrders();
  res.json(rows.map(mapOrderForClient));
});

router.patch("/api/admin/order/:id", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const id = req.params.id as string;
  const order = orders.get(id);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const body = req.body as { status?: string; tx_hash?: string; delivery_data?: string };
  const delivery =
    typeof body.delivery_data === "string" ? body.delivery_data.trim().slice(0, 8000) : "";
  if (delivery) {
    orders.setDelivery(order.id, delivery);
  }
  const { status } = body;
  if (status === "paid") {
    orders.markPaid(order.id, body.tx_hash || "manual");
  } else if (status === "completed" && !delivery) {
    finalizeCompletedOrder(order, body.tx_hash || "manual");
  } else if (status === "expired") {
    orders.expire(order.id);
  }
  res.json({ ok: true });
});

router.delete("/api/admin/order/:id", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  orders.expire(req.params.id as string);
  res.json({ ok: true });
});

// ── Admin Stats ──────────────────────────────────────────────────
router.get("/api/admin/stats", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const summary = stats.summary();
  const logs = adminLogs.getAll().slice(0, 50).map(mapLog);
  res.json({ ...summary, logs });
});

// ── Admin Users ──────────────────────────────────────────────────
router.get("/api/admin/users", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const rows = allUsers.getAll();
  res.json(
    rows.map((u) => ({
      uid: u.uid,
      username: u.username ?? "",
      full_name: u.full_name ?? "",
      balance: u.balance,
      ref_balance: u.ref_balance,
      ref_earned: u.ref_earned,
      ref_count: u.ref_count,
      spent: u.spent,
      purchases: u.purchases,
      last_seen: u.created_at,
    })),
  );
});

router.post("/api/admin/user/:uid/balance", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const uid = Number(req.params.uid);
  if (!uid || isNaN(uid)) { res.status(400).json({ error: "Invalid uid" }); return; }
  const { amount } = req.body as { amount?: number };
  if (!amount || typeof amount !== "number" || amount <= 0 || amount > 100000) {
    res.status(400).json({ error: "Invalid amount" }); return;
  }
  users.upsert({ uid, username: null, full_name: null });
  const updated = users.credit(uid, amount);
  res.json({ ok: true, balance: updated?.balance ?? 0 });
});

router.post("/api/admin/user/:uid/ref-balance", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const uid = Number(req.params.uid);
  if (!uid || isNaN(uid)) { res.status(400).json({ error: "Invalid uid" }); return; }
  const { amount } = req.body as { amount?: number };
  if (!amount || typeof amount !== "number" || amount <= 0 || amount > 10000) {
    res.status(400).json({ error: "Invalid amount" }); return;
  }
  const updated = users.creditRef(uid, amount);
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({
    ok: true,
    ref_balance: updated.ref_balance,
    ref_earned: updated.ref_earned,
  });
});

// ── Admin Products ─────────────────────────────────────────────────
router.get("/api/admin/products", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const prods = products.getAll().map(mapProduct);
  const cats = categories.getAll().map(mapCategory);
  const pinned = products.getAll().filter((p) => p.pinned).map((p) => p.id);
  res.json({ products: prods, categories: cats, pinned });
});

router.post("/api/admin/product", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const b = req.body as Record<string, unknown>;
  const id = Number(b.id) || Date.now();
  if (!b.title || typeof b.title !== "string") {
    res.status(400).json({ error: "Invalid product" }); return;
  }
  products.upsert({
    id,
    cat_id: Number(b.cat_id) || 1,
    title: String(b.title),
    title_en: String(b.title_en ?? ""),
    description: String(b.description ?? ""),
    desc_en: String(b.desc_en ?? ""),
    price: Number(b.price) || 0,
    delivery: String(b.delivery ?? "auto"),
    stock: Number(b.stock) || 0,
    active: b.active !== false,
    auto_items: Array.isArray(b.autoItems) ? (b.autoItems as string[]) : [],
    pinned: !!b.pinned,
    image_url: typeof b.image_url === "string" ? b.image_url : null,
  });
  res.json({ ok: true, id });
});

router.delete("/api/admin/product/:id", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  products.delete(Number(req.params.id));
  res.json({ ok: true });
});

function upsertFromRow(p: ProductRow, pinned: boolean) {
  let autoItems: string[] = [];
  try {
    autoItems = JSON.parse(p.auto_items || "[]");
  } catch {
    autoItems = [];
  }
  products.upsert({
    id: p.id,
    cat_id: p.cat_id,
    title: p.title,
    title_en: p.title_en,
    description: p.description,
    desc_en: p.desc_en,
    price: p.price,
    delivery: p.delivery,
    stock: p.stock,
    active: !!p.active,
    auto_items: autoItems,
    pinned,
    image_url: p.image_url,
  });
}

router.post("/api/admin/product/:id/pin", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const p = products.get(Number(req.params.id));
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  upsertFromRow(p, true);
  res.json({ ok: true });
});

router.delete("/api/admin/product/:id/pin", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const p = products.get(Number(req.params.id));
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  upsertFromRow(p, false);
  res.json({ ok: true });
});

router.post("/api/admin/category", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const b = req.body as Record<string, unknown>;
  categories.upsert({
    id: Number(b.id) || Date.now(),
    name: String(b.name ?? ""),
    name_en: String(b.name_en ?? ""),
    emoji: String(b.emoji ?? ""),
    active: b.active !== false,
    sort_order: Number(b.sort_order) || 0,
  });
  res.json({ ok: true });
});

router.delete("/api/admin/category/:id", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  categories.delete(id);
  res.json({ ok: true });
});

// ── Admin Broadcast ────────────────────────────────────────────────
const broadcastLimiter = rateLimit({ windowMs: 60_000, max: 5 });

router.post("/api/admin/broadcast", broadcastLimiter, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { text, buttonText, keyboard } = req.body as {
    text?: string;
    buttonText?: string;
    keyboard?: unknown;
  };
  if (!text || typeof text !== "string" || text.length > 4096) {
    res.status(400).json({ error: "Invalid text" }); return;
  }

  let replyMarkup: ReturnType<typeof buildSimpleButtonMarkup> = undefined;
  let meta: Record<string, unknown> = { enabled: false };

  if (typeof buttonText === "string") {
    const label = buttonText.trim().slice(0, 64);
    if (label) {
      if (!ENV.webAppUrl) {
        const raw = process.env.WEBAPP_URL || process.env.VITE_SITE_URL || "";
        res.status(400).json({
          error: raw.trim()
            ? `WEBAPP_URL неверный: "${raw.trim()}". Нужен https://ваш-домен.com`
            : "WEBAPP_URL не задан в .env на сервере",
        });
        return;
      }
      replyMarkup = buildSimpleButtonMarkup(label, ENV.webAppUrl);
      if (!replyMarkup) {
        res.status(400).json({ error: "Не удалось создать кнопку приложения" });
        return;
      }
      meta = { enabled: true, buttonText: label };
    }
  } else {
    const kbCheck = validateBroadcastKeyboard(keyboard);
    if (!kbCheck.ok) {
      res.status(400).json({ error: kbCheck.error }); return;
    }
    const kb: BroadcastKeyboardInput = kbCheck.value;
    replyMarkup = buildBroadcastReplyMarkup(kb, ENV.webAppUrl);
    meta = kb;
  }

  const userRows = allUsers.getAll();
  const keyboardJson = JSON.stringify(meta);
  const broadcastId = broadcasts.create({
    text,
    sent_to: 0,
    failed: 0,
    status: "running",
    keyboard_json: keyboardJson,
  });

  res.json({
    ok: true,
    status: "running",
    sent_to: 0,
    failed: 0,
    total: userRows.length,
    id: broadcastId,
  });

  void (async () => {
    let sent = 0;
    let failed = 0;
    for (const u of userRows) {
      const ok = await notifyUserBroadcast(u.uid, text, replyMarkup);
      if (ok) sent++;
      else failed++;
      await new Promise((r) => setTimeout(r, 35));
    }
    broadcasts.finish(broadcastId, sent, failed);
  })();
});

router.get("/api/admin/broadcasts", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const rows = broadcasts.getAll();
  res.json(
    rows.map((b) => {
      let buttonText: string | undefined;
      let keyboard: BroadcastKeyboardInput | undefined;
      if (b.keyboard_json) {
        try {
          const meta = JSON.parse(b.keyboard_json) as {
            buttonText?: string;
            enabled?: boolean;
            rows?: unknown;
          };
          if (typeof meta.buttonText === "string") {
            buttonText = meta.buttonText;
          } else {
            const parsed = safeParseKeyboard(b.keyboard_json);
            keyboard = parsed;
            buttonText = parsed?.rows[0]?.[0]?.text;
          }
        } catch {
          /* ignore */
        }
      }
      return {
        id: b.id,
        text: b.text,
        sent_to: b.sent_to,
        ts: b.created_at,
        status: b.status,
        buttonText,
        keyboard,
      };
    }),
  );
});

// ── Admin Settings ─────────────────────────────────────────────────
router.get("/api/admin/settings", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const all = settings.getAll();
  const parsed: Record<string, unknown> = { ...all, addresses: ENV.addr };
  for (const key of ["refWithdrawNetworks", "siteLinks", "siteContent", "photos", "qrOverrides", "maintenance"]) {
    if (all[key]) {
      try {
        parsed[key] = JSON.parse(all[key]);
      } catch {
        parsed[key] = all[key];
      }
    }
  }
  res.json(parsed);
});

router.post("/api/admin/settings", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const body = req.body as Record<string, unknown>;

  if (body.addresses && typeof body.addresses === "object") {
    for (const [net, addr] of Object.entries(body.addresses as Record<string, string>)) {
      if (typeof addr === "string" && addr.length < 500) {
        ENV.setAddr(net, addr);
        settings.set(`addr_${net}`, addr);
      }
    }
  }

  const allowedKeys = [
    "refWithdrawNetworks",
    "siteLinks",
    "siteContent",
    "customization",
    "photos",
    "qrOverrides",
    "maintenance",
  ];
  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      settings.set(key, JSON.stringify(body[key]));
    }
  }

  res.json({ ok: true });
});

// ── Admin Support ──────────────────────────────────────────────────
router.get("/api/admin/support", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const tickets = support.getTickets() as {
    id: string;
    uid: number;
    category: string;
    status: string;
    summary: string | null;
    created_at: string;
    closed_at: string | null;
  }[];
  const messages = support.getAllMessages() as { uid: number }[];
  const uidSet = new Set<number>();
  for (const tk of tickets) uidSet.add(tk.uid);
  for (const m of messages) uidSet.add(m.uid);

  const usersMeta: Record<
    string,
    { lang: NotifyLang; username?: string; full_name?: string }
  > = {};
  for (const uid of uidSet) {
    const row = users.get(uid);
    usersMeta[String(uid)] = {
      lang: getUserNotifyLang(uid),
      username: row?.username ?? undefined,
      full_name: row?.full_name ?? undefined,
    };
  }

  res.json({
    tickets: tickets.map((tk) => ({
      id: tk.id,
      uid: tk.uid,
      category: tk.category,
      status: tk.status === "closed" ? "closed" : "open",
      opened: tk.created_at,
      closed: tk.closed_at ?? undefined,
      summary: tk.summary ?? undefined,
    })),
    messages,
    users: usersMeta,
  });
});

router.post("/api/admin/support/ticket/:id/close", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }
  const row = support.getTicket(id);
  if (!row) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (row.status === "closed") {
    res.json({ ok: true, alreadyClosed: true });
    return;
  }
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.slice(0, 200) : "admin";
  support.closeTicket(id);
  support.addMessage({
    uid: row.uid,
    sender: "bot",
    kind: "system",
    text: `ticket_closed:${id}:${reason}`,
    ticket_id: id,
  });
  res.json({ ok: true });
});

router.post("/api/support/ticket/:id/close", (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = String(req.params.id ?? "").trim();
  const row = support.getTicket(id);
  if (!row || row.uid !== user.id) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (row.status === "closed") {
    res.json({ ok: true });
    return;
  }
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.slice(0, 200) : "user";
  support.closeTicket(id);
  support.addMessage({
    uid: user.id,
    sender: "bot",
    kind: "system",
    text: `ticket_closed:${id}:${reason}`,
    ticket_id: id,
  });
  res.json({ ok: true });
});

router.post("/api/admin/support/:uid", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const uid = Number(req.params.uid);
  const { text } = req.body as { text?: string };
  if (!uid || !text || typeof text !== "string") {
    res.status(400).json({ error: "Invalid" }); return;
  }
  support.addMessage({ uid, sender: "admin", text });
  const notifyLang = getUserNotifyLang(uid);
  await notifyUserTemplated(uid, "support_reply", { preview: text }, notifyLang);
  res.json({ ok: true });
});

// User support API
router.get("/api/support/messages", (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = support.getMessages(user.id) as {
    id: number; uid: number; sender: string; kind: string; text: string; created_at: string;
    read_by_admin: number; read_by_user: number; ticket_id: string | null;
  }[];
  const ticketRows = support.getTicketsByUid(user.id);
  res.json({
    messages: rows.map((m) => ({
      id: m.id,
      sender: m.sender,
      kind: m.kind,
      text: m.text,
      created: m.created_at,
      read_by_admin: !!m.read_by_admin,
      read_by_user: !!m.read_by_user,
      ticket_id: m.ticket_id ?? undefined,
    })),
    tickets: ticketRows.map((tk) => ({
      id: tk.id,
      category: tk.category,
      status: tk.status === "closed" ? "closed" : "open",
      opened: tk.created_at,
      closed: tk.closed_at ?? undefined,
      summary: tk.summary ?? undefined,
    })),
  });
});

router.post("/api/support/ticket", async (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { category, summary, id: clientId } = req.body as {
    category?: string;
    summary?: string;
    id?: string;
  };
  const valid = new Set(["payment", "delivery", "account", "operator", "other"]);
  if (!category || !valid.has(category)) {
    res.status(400).json({ error: "Invalid category" }); return;
  }

  const existingOpen = support.getOpenTicketByUid(user.id);
  if (existingOpen) {
    res.json({
      ok: true,
      ticket: {
        id: existingOpen.id,
        category: existingOpen.category,
        status: "open" as const,
        opened: existingOpen.created_at,
        summary: existingOpen.summary ?? undefined,
      },
      existing: true,
    });
    return;
  }

  const id =
    typeof clientId === "string" && /^FV-\d{4}$/.test(clientId)
      ? clientId
      : `FV-${Math.floor(1000 + Math.random() * 9000)}`;

  support.upsertTicket({
    id,
    uid: user.id,
    category,
    status: "open",
    summary: typeof summary === "string" ? summary.slice(0, 500) : null,
  });
  support.addMessage({
    uid: user.id,
    sender: "bot",
    kind: "system",
    text: `ticket_opened:${id}`,
    ticket_id: id,
  });

  const row = support.getTicketsByUid(user.id).find((t) => t.id === id);
  res.json({
    ok: true,
    ticket: {
      id,
      category,
      status: "open" as const,
      opened: row?.created_at ?? new Date().toISOString(),
      summary: summary ?? undefined,
    },
  });
});

router.post("/api/support/message", async (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string" || text.length > 4000) {
    res.status(400).json({ error: "Invalid text" }); return;
  }
  support.addMessage({ uid: user.id, sender: "user", text });
  const userName = user.username ? `@${user.username}` : user.first_name;
  const preview = text.length > 400 ? text.slice(0, 400) + "…" : text;
  notifyAdmin(
    adminSupportInbound({ userLabel: userName, uid: user.id, preview }),
  );
  res.json({ ok: true });
});

// ── Ref withdraw settings ────────────────────────────────────────
router.get("/api/ref/settings", (_req: Request, res: Response) => {
  const raw = settings.get("refWithdrawNetworks");
  let networks: string[];
  try { networks = raw ? JSON.parse(raw) : ["trc20", "btc"]; } catch { networks = ["trc20", "btc"]; }
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
  const ok = refWithdrawals.create({ id, uid: user.id, amount, network, address });
  if (!ok) {
    res.status(400).json({ error: "Insufficient ref balance" });
    return;
  }

  res.json({ ok: true, id });
});

router.get("/api/ref/withdrawals", (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = refWithdrawals.getByUid(user.id);
  res.json(
    rows.map((r) => ({
      id: r.id,
      uid: r.uid,
      amount: r.amount,
      network: r.network,
      address: r.address,
      status: r.status,
      createdAt: r.created_at,
      completedAt: r.completed_at ?? undefined,
      txid: r.txid ?? undefined,
      rejectReason: r.reject_reason ?? undefined,
    })),
  );
});

const refRewardLimiter = rateLimit({ windowMs: 60_000, max: 20 });

router.post("/api/ref/reward", refRewardLimiter, (req: Request, res: Response) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as { kind?: string; date?: string; count?: number };
  const kind = body.kind;
  if (kind === "daily") {
    res.status(400).json({ error: "Referral rewards are credited automatically on purchase" });
    return;
  }

  if (kind === "monthly_bonus") {
    const month = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" }).slice(0, 7);
    const count = refDailyStats.sumForMonth(user.id, month);
    if (count < 10) {
      res.status(400).json({ error: "Need 10 qualifying referrals this month" });
      return;
    }
    const result = db.transaction(() => {
      if (refDailyStats.isMonthlyClaimed(user.id, month)) return { already: true } as const;
      const updated = users.accrueRef(user.id, 100, 0);
      refDailyStats.markMonthlyClaimed(user.id, month);
      return { already: false, updated } as const;
    })();
    if (result.already) {
      const row = users.get(user.id);
      res.json({
        ok: true,
        already: true,
        ref_balance: row?.ref_balance ?? 0,
        ref_earned: row?.ref_earned ?? 0,
      });
      return;
    }
    const updated = result.updated;
    res.json({
      ok: true,
      ref_balance: updated?.ref_balance ?? 0,
      ref_earned: updated?.ref_earned ?? 0,
    });
    return;
  }

  res.status(400).json({ error: "Invalid kind" });
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
    notifyUserTemplated(rw.uid, "ref_approved", {
      amountUsd: rw.amount,
      txid: txid || undefined,
      refId: rw.id,
    });
  } else if (action === "reject") {
    refWithdrawals.reject(rw.id, reason || "");
    notifyUserTemplated(rw.uid, "ref_rejected", {
      amountUsd: rw.amount,
      refId: rw.id,
      reason: reason || undefined,
    });
  }

  res.json({ ok: true });
});

// ── Admin Logs ───────────────────────────────────────────────────
router.get("/api/admin/logs", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json(adminLogs.getAll().map(mapLog));
});

router.post("/api/admin/log", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const b = req.body as {
    uid?: number
    username?: string
    kind?: string
    amount?: number
    network?: string
    status?: string
    tx_hash?: string
    product?: string
    type?: string
  };
  adminLogs.add({
    type: b.type ?? "payment",
    uid: b.uid ?? null,
    username: b.username ?? null,
    kind: b.kind ?? null,
    amount: typeof b.amount === "number" ? b.amount : null,
    network: b.network ?? null,
    status: b.status ?? "success",
    tx_hash: b.tx_hash ?? null,
    product: b.product ?? null,
  });
  res.json({ ok: true });
});

export default router;
