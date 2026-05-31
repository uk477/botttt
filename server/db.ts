import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyDbPath = path.resolve(__dirname, "..", "data", "orders.db");
const DB_PATH = path.resolve(process.env.SQLITE_DB_PATH || process.env.DB_PATH || path.join(process.cwd(), "data", "orders.db"));

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

if (DB_PATH !== legacyDbPath && !fs.existsSync(DB_PATH) && fs.existsSync(legacyDbPath)) {
  fs.copyFileSync(legacyDbPath, DB_PATH);
  for (const suffix of ["-wal", "-shm"]) {
    const from = `${legacyDbPath}${suffix}`;
    if (fs.existsSync(from)) fs.copyFileSync(from, `${DB_PATH}${suffix}`);
  }
  console.log(`[db] migrated legacy SQLite database to persistent path: ${DB_PATH}`);
}

console.log(`[db] using SQLite database: ${DB_PATH}`);

const db = new Database(DB_PATH, { verbose: undefined });
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id            TEXT PRIMARY KEY,
    uid           INTEGER NOT NULL,
    kind          TEXT NOT NULL DEFAULT 'deposit',
    amount_usd    REAL NOT NULL,
    amount_crypto REAL NOT NULL,
    network       TEXT NOT NULL,
    wallet        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    tx_hash       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at    TEXT NOT NULL,
    paid_at       TEXT,
    completed_at  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_network ON orders(network, status);
  CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders(uid);
`);

for (const col of [
  { name: "product_id", ddl: "INTEGER" },
  { name: "product_title", ddl: "TEXT" },
  { name: "quantity", ddl: "INTEGER" },
  { name: "delivery_data", ddl: "TEXT" },
] as const) {
  const has = (db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]).some(
    (c) => c.name === col.name,
  );
  if (!has) db.exec(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.ddl}`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    tx_hash   TEXT PRIMARY KEY,
    network   TEXT NOT NULL,
    from_addr TEXT,
    to_addr   TEXT NOT NULL,
    amount    REAL NOT NULL,
    token     TEXT,
    block     INTEGER,
    ts        TEXT NOT NULL,
    order_id  TEXT REFERENCES orders(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tx_order ON transactions(order_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid          INTEGER PRIMARY KEY,
    username     TEXT,
    full_name    TEXT,
    balance      REAL NOT NULL DEFAULT 0,
    spent        REAL NOT NULL DEFAULT 0,
    purchases    INTEGER NOT NULL DEFAULT 0,
    ref_earned   REAL NOT NULL DEFAULT 0,
    ref_count    INTEGER NOT NULL DEFAULT 0,
    ref_balance  REAL NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

for (const col of [
  { name: "username", ddl: "TEXT" },
  { name: "full_name", ddl: "TEXT" },
  { name: "balance", ddl: "REAL NOT NULL DEFAULT 0" },
  { name: "spent", ddl: "REAL NOT NULL DEFAULT 0" },
  { name: "purchases", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { name: "ref_earned", ddl: "REAL NOT NULL DEFAULT 0" },
  { name: "ref_count", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { name: "ref_balance", ddl: "REAL NOT NULL DEFAULT 0" },
  { name: "created_at", ddl: "TEXT NOT NULL DEFAULT (datetime('now'))" },
] as const) {
  const has = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).some(
    (c) => c.name === col.name,
  );
  if (!has) db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.ddl}`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS game_scores (
    uid       INTEGER NOT NULL,
    name      TEXT NOT NULL,
    score     INTEGER NOT NULL DEFAULT 0,
    ts        TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (uid)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS referrals (
    referred_uid   INTEGER PRIMARY KEY,
    referrer_uid   INTEGER NOT NULL,
    joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
    purchase_count INTEGER NOT NULL DEFAULT 0,
    total_spent    REAL NOT NULL DEFAULT 0,
    first_purchase_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_uid);

  CREATE TABLE IF NOT EXISTS referral_rewards (
    order_id       TEXT PRIMARY KEY,
    referrer_uid   INTEGER NOT NULL,
    referred_uid   INTEGER NOT NULL,
    amount         REAL NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ref_daily_stats (
    referrer_uid INTEGER NOT NULL,
    day          TEXT NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (referrer_uid, day)
  );
`);

export interface OrderRow {
  id: string;
  uid: number;
  kind: string;
  amount_usd: number;
  amount_crypto: number;
  network: string;
  wallet: string;
  status: string;
  tx_hash: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  completed_at: string | null;
  product_id: number | null;
  product_title: string | null;
  quantity: number | null;
  delivery_data: string | null;
}

const stmts = {
  insertOrder: db.prepare(`
    INSERT INTO orders (id, uid, kind, amount_usd, amount_crypto, network, wallet, status, expires_at, product_id, product_title, quantity)
    VALUES (@id, @uid, @kind, @amount_usd, @amount_crypto, @network, @wallet, 'pending', @expires_at, @product_id, @product_title, @quantity)
  `),
  getOrder: db.prepare(`SELECT * FROM orders WHERE id = ?`),
  getOrdersByUid: db.prepare(`SELECT * FROM orders WHERE uid = ? ORDER BY created_at DESC LIMIT 50`),
  getPending: db.prepare(
    `SELECT * FROM orders WHERE status = 'pending' AND network = ? ORDER BY created_at ASC`,
  ),
  getAllPending: db.prepare(`SELECT * FROM orders WHERE status = 'pending'`),
  updateStatus: db.prepare(`UPDATE orders SET status = @status WHERE id = @id`),
  markPaid: db.prepare(`
    UPDATE orders SET status = 'paid', tx_hash = @tx_hash, paid_at = datetime('now')
    WHERE id = @id AND status = 'pending'
  `),
  markCompleted: db.prepare(`
    UPDATE orders SET status = 'completed', completed_at = datetime('now')
    WHERE id = @id AND status = 'paid'
  `),
  setDelivery: db.prepare(`
    UPDATE orders SET delivery_data = @delivery_data, status = 'completed', completed_at = COALESCE(completed_at, datetime('now'))
    WHERE id = @id
  `),
  expireOld: db.prepare(`
    UPDATE orders SET status = 'expired'
    WHERE status = 'pending'
      AND datetime(replace(replace(substr(expires_at, 1, 19), 'T', ' '), 'Z', '')) < datetime('now')
  `),
  insertTx: db.prepare(`
    INSERT OR IGNORE INTO transactions (tx_hash, network, from_addr, to_addr, amount, token, block, ts, order_id)
    VALUES (@tx_hash, @network, @from_addr, @to_addr, @amount, @token, @block, @ts, @order_id)
  `),
  getTxByHash: db.prepare(`SELECT * FROM transactions WHERE tx_hash = ?`),
};

const userStmts = {
  upsert: db.prepare(`
    INSERT INTO users (uid, username, full_name) VALUES (@uid, @username, @full_name)
    ON CONFLICT(uid) DO UPDATE SET
      username = COALESCE(excluded.username, users.username),
      full_name = COALESCE(excluded.full_name, users.full_name)
  `),
  get: db.prepare(`SELECT * FROM users WHERE uid = ?`),
  credit: db.prepare(`UPDATE users SET balance = balance + @amount WHERE uid = @uid`),
  debitRefBalance: db.prepare(
    `UPDATE users SET ref_balance = ref_balance - @amount WHERE uid = @uid AND ref_balance >= @amount`,
  ),
  creditRefBalance: db.prepare(
    `UPDATE users SET ref_balance = ref_balance + @amount WHERE uid = @uid`,
  ),
  accrueRef: db.prepare(`
    UPDATE users SET
      ref_balance = ref_balance + @amount,
      ref_earned = ref_earned + @amount,
      ref_count = ref_count + @count
    WHERE uid = @uid
  `),
  debitPurchase: db.prepare(`
    UPDATE users SET
      balance = balance - @amount,
      spent = spent + @amount,
      purchases = purchases + @qty
    WHERE uid = @uid AND balance >= @amount - 0.001
  `),
};

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS ref_withdrawals (
    id          TEXT PRIMARY KEY,
    uid         INTEGER NOT NULL,
    amount      REAL NOT NULL,
    network     TEXT NOT NULL,
    address     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    txid        TEXT,
    reject_reason TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_rw_uid ON ref_withdrawals(uid);
  CREATE INDEX IF NOT EXISTS idx_rw_status ON ref_withdrawals(status);
`);

const settingsStmts = {
  get: db.prepare(`SELECT value FROM settings WHERE key = ?`),
  set: db.prepare(`INSERT INTO settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),
  getAll: db.prepare(`SELECT key, value FROM settings`),
};

const rwStmts = {
  insert: db.prepare(`
    INSERT INTO ref_withdrawals (id, uid, amount, network, address, status)
    VALUES (@id, @uid, @amount, @network, @address, 'pending')
  `),
  get: db.prepare(`SELECT * FROM ref_withdrawals WHERE id = ?`),
  getByUid: db.prepare(`SELECT * FROM ref_withdrawals WHERE uid = ? ORDER BY created_at DESC LIMIT 50`),
  getAll: db.prepare(`SELECT * FROM ref_withdrawals ORDER BY created_at DESC LIMIT 200`),
  approve: db.prepare(`UPDATE ref_withdrawals SET status = 'completed', txid = @txid, completed_at = datetime('now') WHERE id = @id AND status = 'pending'`),
  reject: db.prepare(`UPDATE ref_withdrawals SET status = 'rejected', reject_reason = @reason WHERE id = @id AND status = 'pending'`),
};

export const settings = {
  get(key: string): string | undefined {
    const row = settingsStmts.get.get(key) as { value: string } | undefined;
    return row?.value;
  },
  set(key: string, value: string) {
    settingsStmts.set.run({ key, value });
  },
  getAll(): Record<string, string> {
    const rows = settingsStmts.getAll.all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
};

export interface RefWithdrawalRow {
  id: string;
  uid: number;
  amount: number;
  network: string;
  address: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  txid: string | null;
  reject_reason: string | null;
}

export const refWithdrawals = {
  create(rw: { id: string; uid: number; amount: number; network: string; address: string }): boolean {
    const tx = db.transaction(() => {
      const debited = userStmts.debitRefBalance.run({ uid: rw.uid, amount: rw.amount });
      if (debited.changes === 0) return false;
      rwStmts.insert.run(rw);
      return true;
    });
    return tx();
  },
  get(id: string) {
    return rwStmts.get.get(id) as RefWithdrawalRow | undefined;
  },
  getByUid(uid: number) {
    return rwStmts.getByUid.all(uid) as RefWithdrawalRow[];
  },
  getAll() {
    return rwStmts.getAll.all() as RefWithdrawalRow[];
  },
  approve(id: string, txid: string) {
    rwStmts.approve.run({ id, txid });
  },
  reject(id: string, reason: string): boolean {
    const tx = db.transaction(() => {
      const rw = refWithdrawals.get(id);
      if (!rw || rw.status !== "pending") return false;
      const r = rwStmts.reject.run({ id, reason });
      if (r.changes > 0) {
        userStmts.creditRefBalance.run({ uid: rw.uid, amount: rw.amount });
      }
      return r.changes > 0;
    });
    return tx();
  },
};

export interface UserRow {
  uid: number;
  username: string | null;
  full_name: string | null;
  balance: number;
  spent: number;
  purchases: number;
  ref_earned: number;
  ref_count: number;
  ref_balance: number;
  created_at: string;
}

export const users = {
  upsert(u: { uid: number; username?: string | null; full_name?: string | null }) {
    userStmts.upsert.run({
      uid: u.uid,
      username: u.username ?? null,
      full_name: u.full_name ?? null,
    });
    return userStmts.get.get(u.uid) as UserRow;
  },
  get(uid: number): UserRow | undefined {
    return userStmts.get.get(uid) as UserRow | undefined;
  },
  credit(uid: number, amount: number): UserRow {
    userStmts.upsert.run({ uid, username: null, full_name: null });
    userStmts.credit.run({ uid, amount });
    return userStmts.get.get(uid) as UserRow;
  },
  debitPurchase(uid: number, amount: number, qty: number): UserRow | null {
    userStmts.upsert.run({ uid, username: null, full_name: null });
    const r = userStmts.debitPurchase.run({ uid, amount, qty });
    if (r.changes === 0) return null;
    return userStmts.get.get(uid) as UserRow;
  },
  creditRef(uid: number, amount: number): UserRow | undefined {
    userStmts.upsert.run({ uid, username: null, full_name: null });
    userStmts.creditRefBalance.run({ uid, amount });
    return userStmts.get.get(uid) as UserRow;
  },
  accrueRef(uid: number, amount: number, count = 0): UserRow | undefined {
    userStmts.upsert.run({ uid, username: null, full_name: null });
    userStmts.accrueRef.run({ uid, amount, count });
    return userStmts.get.get(uid) as UserRow;
  },
};

export const orders = {
  create(o: {
    id: string;
    uid: number;
    kind: string;
    amount_usd: number;
    amount_crypto: number;
    network: string;
    wallet: string;
    expires_at: string;
    product_id?: number | null;
    product_title?: string | null;
    quantity?: number | null;
  }) {
    stmts.insertOrder.run({
      ...o,
      product_id: o.product_id ?? null,
      product_title: o.product_title ?? null,
      quantity: o.quantity ?? null,
    });
  },
  get(id: string): OrderRow | undefined {
    return stmts.getOrder.get(id) as OrderRow | undefined;
  },
  getByUid(uid: number): OrderRow[] {
    return stmts.getOrdersByUid.all(uid) as OrderRow[];
  },
  getPending(network: string): OrderRow[] {
    return stmts.getPending.all(network) as OrderRow[];
  },
  getAllPending(): OrderRow[] {
    return stmts.getAllPending.all() as OrderRow[];
  },
  getAll(limit = 500): OrderRow[] {
    return db.prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`).all(limit) as OrderRow[];
  },
  markPaid(id: string, txHash: string) {
    stmts.markPaid.run({ id, tx_hash: txHash });
  },
  markCompleted(id: string) {
    stmts.markCompleted.run({ id });
  },
  setDelivery(id: string, deliveryData: string) {
    stmts.setDelivery.run({ id, delivery_data: deliveryData });
  },
  expire(id: string) {
    stmts.updateStatus.run({ id, status: "expired" });
  },
  /** Cancel all pending crypto invoices (deposit + buy) — only one active счёт per user. */
  expireAllPendingCryptoForUid(uid: number): string[] {
    const rows = db
      .prepare(
        `SELECT id FROM orders WHERE uid = ? AND status = 'pending' AND kind IN ('buy', 'deposit')`,
      )
      .all(uid) as { id: string }[];
    for (const row of rows) {
      stmts.updateStatus.run({ id: row.id, status: "expired" });
    }
    return rows.map((r) => r.id);
  },
  expireOld() {
    return stmts.expireOld.run();
  },
  hasCompletedBuy(uid: number): boolean {
    const row = db
      .prepare(
        `SELECT 1 FROM orders WHERE uid = ? AND kind = 'buy' AND status = 'completed' LIMIT 1`,
      )
      .get(uid) as { 1: number } | undefined;
    return !!row;
  },
  recentCompletedBuys(limit = 30): OrderRow[] {
    return db
      .prepare(
        `SELECT * FROM orders WHERE kind = 'buy' AND status = 'completed'
         ORDER BY COALESCE(completed_at, paid_at, created_at) DESC LIMIT ?`,
      )
      .all(limit) as OrderRow[];
  },
};

const referralStmts = {
  link: db.prepare(`
    INSERT INTO referrals (referred_uid, referrer_uid) VALUES (@referred_uid, @referrer_uid)
  `),
  getByReferred: db.prepare(`SELECT * FROM referrals WHERE referred_uid = ?`),
  listByReferrer: db.prepare(
    `SELECT * FROM referrals WHERE referrer_uid = ? ORDER BY joined_at DESC LIMIT 200`,
  ),
  recordPurchase: db.prepare(`
    UPDATE referrals SET
      purchase_count = purchase_count + 1,
      total_spent = total_spent + @amount,
      first_purchase_at = COALESCE(first_purchase_at, datetime('now'))
    WHERE referred_uid = @referred_uid
  `),
  insertReward: db.prepare(`
    INSERT INTO referral_rewards (order_id, referrer_uid, referred_uid, amount)
    VALUES (@order_id, @referrer_uid, @referred_uid, @amount)
  `),
  hasReward: db.prepare(`SELECT 1 FROM referral_rewards WHERE order_id = ?`),
  incDaily: db.prepare(`
    INSERT INTO ref_daily_stats (referrer_uid, day, count) VALUES (@referrer_uid, @day, 1)
    ON CONFLICT(referrer_uid, day) DO UPDATE SET count = count + 1
  `),
  dailyLog: db.prepare(
    `SELECT day, count FROM ref_daily_stats WHERE referrer_uid = ? ORDER BY day DESC LIMIT 400`,
  ),
  dailySumMonth: db.prepare(`
    SELECT COALESCE(SUM(count), 0) AS total FROM ref_daily_stats
    WHERE referrer_uid = ? AND day LIKE @month || '%'
  `),
};

export interface ReferralRow {
  referred_uid: number;
  referrer_uid: number;
  joined_at: string;
  purchase_count: number;
  total_spent: number;
  first_purchase_at: string | null;
}

export const referrals = {
  link(referrerUid: number, referredUid: number) {
    try {
      referralStmts.link.run({ referrer_uid: referrerUid, referred_uid: referredUid });
      return true;
    } catch {
      return false;
    }
  },
  getByReferred(referredUid: number): ReferralRow | undefined {
    return referralStmts.getByReferred.get(referredUid) as ReferralRow | undefined;
  },
  listByReferrer(referrerUid: number): ReferralRow[] {
    return referralStmts.listByReferrer.all(referrerUid) as ReferralRow[];
  },
  recordPurchase(referredUid: number, amount: number) {
    referralStmts.recordPurchase.run({ referred_uid: referredUid, amount });
  },
};

export const referralRewards = {
  has(orderId: string): boolean {
    return !!referralStmts.hasReward.get(orderId);
  },
  insert(r: { order_id: string; referrer_uid: number; referred_uid: number; amount: number }) {
    referralStmts.insertReward.run(r);
  },
};

export const refDailyStats = {
  increment(referrerUid: number, day: string) {
    referralStmts.incDaily.run({ referrer_uid: referrerUid, day });
  },
  logForUser(referrerUid: number): Record<string, number> {
    const rows = referralStmts.dailyLog.all(referrerUid) as { day: string; count: number }[];
    const out: Record<string, number> = {};
    for (const r of rows) out[r.day] = r.count;
    return out;
  },
  sumForMonth(referrerUid: number, month: string): number {
    const row = referralStmts.dailySumMonth.get(referrerUid, month) as { total: number } | undefined;
    return row?.total ?? 0;
  },
  isMonthlyClaimed(referrerUid: number, month: string): boolean {
    return settings.get(`ref_monthly_claimed:${referrerUid}:${month}`) === "1";
  },
  markMonthlyClaimed(referrerUid: number, month: string) {
    settings.set(`ref_monthly_claimed:${referrerUid}:${month}`, "1");
  },
};

export const transactions = {
  insert(tx: {
    tx_hash: string;
    network: string;
    from_addr: string;
    to_addr: string;
    amount: number;
    token: string | null;
    block: number | null;
    ts: string;
    order_id: string | null;
  }) {
    stmts.insertTx.run(tx);
  },
  exists(hash: string): boolean {
    return !!stmts.getTxByHash.get(hash);
  },
};

// ── Game leaderboard ─────────────────────────────────────────────

const gameStmts = {
  upsert: db.prepare(`
    INSERT INTO game_scores (uid, name, score, ts)
    VALUES (@uid, @name, @score, datetime('now'))
    ON CONFLICT(uid) DO UPDATE SET
      name  = @name,
      score = CASE WHEN @score > game_scores.score THEN @score ELSE game_scores.score END,
      ts    = CASE WHEN @score > game_scores.score THEN datetime('now') ELSE game_scores.ts END
  `),
  top: db.prepare(`SELECT uid, name, score, ts FROM game_scores ORDER BY score DESC LIMIT 30`),
  getByUid: db.prepare(`SELECT uid, name, score, ts FROM game_scores WHERE uid = ?`),
};

export const gameScores = {
  submit(uid: number, name: string, score: number) {
    gameStmts.upsert.run({ uid, name: name.slice(0, 16), score: Math.min(99999, Math.max(0, score)) });
  },
  top(): { uid: number; name: string; score: number; ts: string }[] {
    return gameStmts.top.all() as { uid: number; name: string; score: number; ts: string }[];
  },
  get(uid: number) {
    return gameStmts.getByUid.get(uid) as { uid: number; name: string; score: number; ts: string } | undefined;
  },
};

// ── Products & Categories ────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY,
    cat_id        INTEGER NOT NULL DEFAULT 1,
    title         TEXT NOT NULL DEFAULT '',
    title_en      TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    desc_en       TEXT NOT NULL DEFAULT '',
    price         REAL NOT NULL DEFAULT 0,
    delivery      TEXT NOT NULL DEFAULT 'auto',
    stock         INTEGER NOT NULL DEFAULT 0,
    active        INTEGER NOT NULL DEFAULT 1,
    auto_items    TEXT NOT NULL DEFAULT '[]',
    pinned        INTEGER NOT NULL DEFAULT 0,
    image_url     TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL DEFAULT '',
    name_en   TEXT NOT NULL DEFAULT '',
    emoji     TEXT NOT NULL DEFAULT '',
    active    INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS broadcasts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    text       TEXT NOT NULL,
    sent_to    INTEGER NOT NULL DEFAULT 0,
    failed     INTEGER NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id         TEXT PRIMARY KEY,
    uid        INTEGER NOT NULL,
    category   TEXT NOT NULL DEFAULT 'general',
    status     TEXT NOT NULL DEFAULT 'open',
    summary    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id  TEXT,
    uid        INTEGER NOT NULL,
    sender     TEXT NOT NULL DEFAULT 'user',
    kind       TEXT NOT NULL DEFAULT 'text',
    text       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_by_admin INTEGER NOT NULL DEFAULT 0,
    read_by_user  INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_sm_uid ON support_messages(uid);

  CREATE TABLE IF NOT EXISTS admin_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL DEFAULT 'info',
    uid        INTEGER,
    username   TEXT,
    kind       TEXT,
    amount     REAL,
    network    TEXT,
    status     TEXT NOT NULL DEFAULT 'success',
    tx_hash    TEXT,
    product    TEXT,
    details    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

try {
  db.exec(`ALTER TABLE broadcasts ADD COLUMN keyboard_json TEXT`);
} catch {
  /* column exists */
}

const productStmts = {
  getAll: db.prepare(`SELECT * FROM products ORDER BY created_at DESC`),
  get: db.prepare(`SELECT * FROM products WHERE id = ?`),
  upsert: db.prepare(`
    INSERT INTO products (id, cat_id, title, title_en, description, desc_en, price, delivery, stock, active, auto_items, pinned, image_url)
    VALUES (@id, @cat_id, @title, @title_en, @description, @desc_en, @price, @delivery, @stock, @active, @auto_items, @pinned, @image_url)
    ON CONFLICT(id) DO UPDATE SET
      cat_id = excluded.cat_id, title = excluded.title, title_en = excluded.title_en,
      description = excluded.description, desc_en = excluded.desc_en,
      price = excluded.price, delivery = excluded.delivery, stock = excluded.stock,
      active = excluded.active, auto_items = excluded.auto_items, pinned = excluded.pinned,
      image_url = excluded.image_url
  `),
  del: db.prepare(`DELETE FROM products WHERE id = ?`),
};

const categoryStmts = {
  getAll: db.prepare(`SELECT * FROM categories ORDER BY sort_order, id`),
  upsert: db.prepare(`
    INSERT INTO categories (id, name, name_en, emoji, active, sort_order)
    VALUES (@id, @name, @name_en, @emoji, @active, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, name_en = excluded.name_en, emoji = excluded.emoji,
      active = excluded.active, sort_order = excluded.sort_order
  `),
  del: db.prepare(`DELETE FROM categories WHERE id = ?`),
};

const broadcastStmts = {
  insert: db.prepare(`
    INSERT INTO broadcasts (text, sent_to, failed, status, keyboard_json)
    VALUES (@text, @sent_to, @failed, @status, @keyboard_json)
  `),
  finish: db.prepare(`
    UPDATE broadcasts SET sent_to = @sent_to, failed = @failed, status = @status WHERE id = @id
  `),
  getAll: db.prepare(`SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 100`),
};

const logStmts = {
  insert: db.prepare(`
    INSERT INTO admin_logs (type, uid, username, kind, amount, network, status, tx_hash, product, details)
    VALUES (@type, @uid, @username, @kind, @amount, @network, @status, @tx_hash, @product, @details)
  `),
  getAll: db.prepare(`SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 500`),
};

const supportStmts = {
  getTickets: db.prepare(`SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 200`),
  upsertTicket: db.prepare(`
    INSERT INTO support_tickets (id, uid, category, status, summary)
    VALUES (@id, @uid, @category, @status, @summary)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, closed_at = excluded.closed_at
  `),
  getMessages: db.prepare(`SELECT * FROM support_messages WHERE uid = ? ORDER BY created_at`),
  getAllMessages: db.prepare(`SELECT * FROM support_messages ORDER BY created_at ASC LIMIT 2000`),
  insertMessage: db.prepare(`
    INSERT INTO support_messages (ticket_id, uid, sender, kind, text)
    VALUES (@ticket_id, @uid, @sender, @kind, @text)
  `),
};

export interface ProductRow {
  id: number;
  cat_id: number;
  title: string;
  title_en: string;
  description: string;
  desc_en: string;
  price: number;
  delivery: string;
  stock: number;
  active: number;
  auto_items: string;
  pinned: number;
  image_url: string | null;
  created_at: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  name_en: string;
  emoji: string;
  active: number;
  sort_order: number;
}

export interface BroadcastRow {
  id: number;
  text: string;
  sent_to: number;
  failed: number;
  status: string;
  created_at: string;
  keyboard_json: string | null;
}

export interface AdminLogRow {
  id: number;
  type: string;
  uid: number | null;
  username: string | null;
  kind: string | null;
  amount: number | null;
  network: string | null;
  status: string;
  tx_hash: string | null;
  product: string | null;
  details: string | null;
  created_at: string;
}

export const products = {
  getAll(): ProductRow[] {
    return productStmts.getAll.all() as ProductRow[];
  },
  get(id: number): ProductRow | undefined {
    return productStmts.get.get(id) as ProductRow | undefined;
  },
  upsert(p: {
    id: number; cat_id: number; title: string; title_en: string;
    description: string; desc_en: string; price: number; delivery: string;
    stock: number; active: boolean; auto_items: string[]; pinned: boolean;
    image_url?: string | null;
  }) {
    productStmts.upsert.run({
      ...p,
      active: p.active ? 1 : 0,
      pinned: p.pinned ? 1 : 0,
      auto_items: JSON.stringify(p.auto_items ?? []),
      image_url: p.image_url ?? null,
    });
  },
  delete(id: number) {
    productStmts.del.run(id);
  },
};

export const categories = {
  getAll(): CategoryRow[] {
    return categoryStmts.getAll.all() as CategoryRow[];
  },
  upsert(c: { id: number; name: string; name_en: string; emoji: string; active: boolean; sort_order?: number }) {
    categoryStmts.upsert.run({
      ...c,
      active: c.active ? 1 : 0,
      sort_order: c.sort_order ?? 0,
    });
  },
  delete(id: number) {
    categoryStmts.del.run(id);
  },
};

export const broadcasts = {
  create(b: {
    text: string;
    sent_to: number;
    failed: number;
    status: string;
    keyboard_json?: string | null;
  }): number {
    const r = broadcastStmts.insert.run({
      ...b,
      keyboard_json: b.keyboard_json ?? null,
    });
    return Number(r.lastInsertRowid);
  },
  finish(id: number, sent_to: number, failed: number) {
    broadcastStmts.finish.run({ id, sent_to, failed, status: "completed" });
  },
  getAll(): BroadcastRow[] {
    return broadcastStmts.getAll.all() as BroadcastRow[];
  },
};

export const adminLogs = {
  add(log: {
    type?: string; uid?: number | null; username?: string | null;
    kind?: string | null; amount?: number | null; network?: string | null;
    status?: string; tx_hash?: string | null; product?: string | null;
    details?: string | null;
  }) {
    logStmts.insert.run({
      type: log.type ?? 'info',
      uid: log.uid ?? null,
      username: log.username ?? null,
      kind: log.kind ?? null,
      amount: log.amount ?? null,
      network: log.network ?? null,
      status: log.status ?? 'success',
      tx_hash: log.tx_hash ?? null,
      product: log.product ?? null,
      details: log.details ?? null,
    });
  },
  getAll(): AdminLogRow[] {
    return logStmts.getAll.all() as AdminLogRow[];
  },
};

export const support = {
  getTickets() {
    return supportStmts.getTickets.all();
  },
  upsertTicket(t: { id: string; uid: number; category: string; status: string; summary?: string | null; closed_at?: string | null }) {
    supportStmts.upsertTicket.run({ ...t, summary: t.summary ?? null, closed_at: t.closed_at ?? null });
  },
  closeTicket(id: string) {
    db.prepare(
      `UPDATE support_tickets SET status = 'closed', closed_at = datetime('now') WHERE id = ?`,
    ).run(id);
  },
  getTicket(id: string) {
    return db.prepare(`SELECT * FROM support_tickets WHERE id = ?`).get(id) as {
      id: string;
      uid: number;
      status: string;
    } | undefined;
  },
  getMessages(uid: number) {
    return supportStmts.getMessages.all(uid);
  },
  getOpenTicketByUid(uid: number) {
    return db
      .prepare(
        `SELECT * FROM support_tickets WHERE uid = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
      )
      .get(uid) as {
      id: string;
      uid: number;
      category: string;
      status: string;
      summary: string | null;
      created_at: string;
      closed_at: string | null;
    } | undefined;
  },
  getTicketsByUid(uid: number) {
    return db
      .prepare(`SELECT * FROM support_tickets WHERE uid = ? ORDER BY created_at DESC LIMIT 50`)
      .all(uid) as {
      id: string;
      uid: number;
      category: string;
      status: string;
      summary: string | null;
      created_at: string;
      closed_at: string | null;
    }[];
  },
  getAllMessages() {
    return supportStmts.getAllMessages.all();
  },
  addMessage(m: { ticket_id?: string | null; uid: number; sender: string; kind?: string; text: string }) {
    supportStmts.insertMessage.run({
      ticket_id: m.ticket_id ?? null,
      uid: m.uid,
      sender: m.sender,
      kind: m.kind ?? 'text',
      text: m.text,
    });
  },
};

export const allUsers = {
  getAll(): UserRow[] {
    return db.prepare(`SELECT * FROM users ORDER BY created_at DESC LIMIT 500`).all() as UserRow[];
  },
  count(): number {
    return (db.prepare(`SELECT COUNT(*) as cnt FROM users`).get() as { cnt: number }).cnt;
  },
};

export const stats = {
  summary() {
    const totalUsers = (db.prepare(`SELECT COUNT(*) as cnt FROM users`).get() as { cnt: number }).cnt;
    const totalRevenue = (db.prepare(`SELECT COALESCE(SUM(amount_usd), 0) as total FROM orders WHERE kind='buy' AND (status='completed' OR status='paid')`).get() as { total: number }).total;
    const totalOrders = (db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE kind='buy' AND (status='completed' OR status='paid')`).get() as { cnt: number }).cnt;
    const pendingOrders = (db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE status='pending'`).get() as { cnt: number }).cnt;
    return { totalUsers, totalRevenue, totalOrders, pendingOrders };
  },
  ordersByPeriod(since: string) {
    return db.prepare(`
      SELECT * FROM orders WHERE kind='buy' AND (status='completed' OR status='paid') AND created_at >= ?
      ORDER BY created_at DESC
    `).all(since) as OrderRow[];
  },
  allCompletedOrders() {
    return db.prepare(`
      SELECT * FROM orders WHERE kind='buy' AND (status='completed' OR status='paid')
      ORDER BY created_at DESC LIMIT 500
    `).all() as OrderRow[];
  },
};

export default db;
