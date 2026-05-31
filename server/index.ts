import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cors from "cors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { ENV } from "./env.js";
import { settings } from "./db.js";
import authRouter from "./routes/auth.js";
import ordersRouter from "./routes/orders.js";
import notifyRouter from "./routes/notify.js";
import telegramRouter from "./routes/telegram.js";
import adminRouter from "./routes/admin.js";
import referralsRouter from "./routes/referrals.js";
import { startPoller } from "./blockchain/poller.js";
import { isValidTronBase58Address } from "./blockchain/tronAddress.js";
import { seedCatalogIfEmpty } from "./seedCatalog.js";
import { APP_BUILD } from "./buildVersion.js";

seedCatalogIfEmpty();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "..", "dist");

const app = express();

// Caddy / nginx send X-Forwarded-For — required for express-rate-limit
app.set("trust proxy", process.env.TRUST_PROXY === "0" ? false : 1);

// ── Security middleware ──────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: ENV.corsOrigin || true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  }),
);

function clientRateLimitKey(req: express.Request): string {
  const initData = req.headers["x-telegram-init-data"] as string;
  if (initData) {
    const u = verifyInitData(initData);
    if (u) return `uid:${u.id}`;
    return initData.slice(0, 64);
  }
  const fwd = req.headers["x-forwarded-for"];
  const raw =
    (typeof fwd === "string" ? fwd.split(",")[0]?.trim() : null) ||
    req.socket.remoteAddress ||
    "unknown";
  return ipKeyGenerator(raw, 56);
}

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: clientRateLimitKey,
});
app.use("/api/", globalLimiter);

app.use(express.json({ limit: "1mb" }));

// ── API routes ──────────────────────────────────────────────────────
app.use(authRouter);
app.use(ordersRouter);
app.use(notifyRouter);
app.use(telegramRouter);
app.use(adminRouter);
app.use(referralsRouter);

// ── Game leaderboard ──────────────────────────────────────────────
import { gameScores } from "./db.js";
import { verifyInitData, isAdmin } from "./telegram.js";

app.get("/api/game/leaderboard", (_req, res) => {
  res.json(gameScores.top());
});

app.post("/api/game/score", (req, res) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, score } = req.body as { name?: string; score?: number };
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Invalid name" }); return;
  }
  if (!score || typeof score !== "number" || score < 0) {
    res.status(400).json({ error: "Invalid score" }); return;
  }
  gameScores.submit(user.id, name.trim(), Math.floor(score));
  res.json({ ok: true });
});

app.get("/api/game/me", (req, res) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const user = verifyInitData(initData);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const data = gameScores.get(user.id);
  res.json(data ?? null);
});

// ── Health check ────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ appBuild: APP_BUILD, dist: DIST });
});

// ── Test notification (admin only) ───────────────────────────────
app.get("/api/test-notify", async (req, res) => {
  const initData = (req.headers["x-telegram-init-data"] as string) || "";
  const u = verifyInitData(initData);
  if (!u || !isAdmin(u.id)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { notifyAdmin } = await import("./telegram.js");
  const ok = await notifyAdmin(
    "<b>Fanvue Market</b>\n\nТестовое уведомление. Канал доставки работает.",
  );
  res.json({ ok });
});

// ── Serve static SPA from dist/ ─────────────────────────────────────
app.use(
  express.static(DIST, {
    maxAge: 0,
    setHeaders(res, filePath) {
      if (
        filePath.endsWith(".html") ||
        filePath.endsWith(".js") ||
        filePath.endsWith(".css")
      ) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
    },
  }),
);

app.get("/{*splat}", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(DIST, "index.html"));
});

// Load persisted wallet addresses from SQLite
for (const net of Object.keys(ENV.addr)) {
  const saved = settings.get(`addr_${net}`);
  if (saved) ENV.setAddr(net, saved);
}

// ── Start ───────────────────────────────────────────────────────────
app.listen(ENV.port, () => {
  console.log(`\n  App build: ${APP_BUILD}`);
  console.log(`  Server running on http://localhost:${ENV.port}`);
  console.log(`  Serving SPA from ${DIST}`);
  console.log(`  Admin hashes: ${ENV.adminHashes.length} configured`);

  const configuredNetworks = Object.entries(ENV.addr)
    .filter(([, v]) => !!v)
    .map(([k]) => k);
  console.log(`  Wallets configured: ${configuredNetworks.join(", ") || "none"}`);
  if (ENV.addr.trc20) {
    const ok = isValidTronBase58Address(ENV.addr.trc20);
    console.log(
      `  TRC20 wallet: ${ok ? "✅ valid" : "❌ INVALID (poller will not detect USDT)"} · ${ENV.addr.trc20.slice(0, 10)}…`,
    );
  }
  console.log(`  TRONGRID_API_KEY: ${ENV.trongridKey ? "set" : "not set (optional)"}`);
  console.log(`  ADMIN_CHAT_ID: ${ENV.adminChatId || "⚠️  NOT SET"}`);
  console.log(`  WEBAPP_URL: ${ENV.webAppUrl || "⚠️  NOT SET"}`);
  console.log(`  NOTIFY_GROUP_ID: ${ENV.notifyGroupId || "not set"}`);
  console.log(`  Admin notify: headline + action (build 2026-05-30-b)`);
  console.log();

  startPoller();

  if (ENV.webAppUrl) {
    const webhookUrl = `${ENV.webAppUrl}/api/telegram/webhook`;
    fetch(`https://api.telegram.org/bot${ENV.botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        ...(ENV.webhookSecret ? { secret_token: ENV.webhookSecret } : {}),
      }),
    })
      .then((r) => r.json())
      .then((d: unknown) => {
        const res = d as { ok: boolean; description?: string };
        console.log(`  Webhook: ${res.ok ? "✅ set" : "❌ " + res.description} → ${webhookUrl}`);
      })
      .catch((e) => console.error("  Webhook setup failed:", e));
  }
});
