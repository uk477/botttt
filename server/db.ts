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

db.exec(`
  CREATE TABLE IF NOT EXISTS game_scores (
    uid       INTEGER NOT NULL,
    name      TEXT NOT NULL,
    score     INTEGER NOT NULL DEFAULT 0,
    ts        TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (uid)
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
}

const stmts = {
  insertOrder: db.prepare(`
    INSERT INTO orders (id, uid, kind, amount_usd, amount_crypto, network, wallet, status, expires_at)
    VALUES (@id, @uid, @kind, @amount_usd, @amount_crypto, @network, @wallet, 'pending', @expires_at)
  `),
  getOrder: db.prepare(`SELECT * FROM orders WHERE id = ?`),
  getOrdersByUid: db.prepare(`SELECT * FROM orders WHERE uid = ? ORDER BY created_at DESC LIMIT 50`),
  getPending: db.prepare(`SELECT * FROM orders WHERE status = 'pending' AND network = ?`),
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
  expireOld: db.prepare(`
    UPDATE orders SET status = 'expired'
    WHERE status = 'pending' AND expires_at < datetime('now')
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
  create(rw: { id: string; uid: number; amount: number; network: string; address: string }) {
    rwStmts.insert.run(rw);
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
  reject(id: string, reason: string) {
    rwStmts.reject.run({ id, reason });
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
  }) {
    stmts.insertOrder.run(o);
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
  markPaid(id: string, txHash: string) {
    stmts.markPaid.run({ id, tx_hash: txHash });
  },
  markCompleted(id: string) {
    stmts.markCompleted.run({ id });
  },
  expire(id: string) {
    stmts.updateStatus.run({ id, status: "expired" });
  },
  expireOld() {
    return stmts.expireOld.run();
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

export default db;
