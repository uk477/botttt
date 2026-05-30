import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { ENV } from "./env.js";
import { settings } from "./db.js";
import authRouter from "./routes/auth.js";
import ordersRouter from "./routes/orders.js";
import notifyRouter from "./routes/notify.js";
import telegramRouter from "./routes/telegram.js";
import adminRouter from "./routes/admin.js";
import { startPoller } from "./blockchain/poller.js";

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

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const initData = req.headers["x-telegram-init-data"] as string;
    return initData?.slice(0, 64) || req.ip || "unknown";
  },
});
app.use("/api/", globalLimiter);

app.use(express.json({ limit: "1mb" }));

// ── API routes ──────────────────────────────────────────────────────
app.use(authRouter);
app.use(ordersRouter);
app.use(notifyRouter);
app.use(telegramRouter);
app.use(adminRouter);

// ── Game leaderboard ──────────────────────────────────────────────
import { gameScores } from "./db.js";
import { verifyInitData } from "./telegram.js";

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
  res.json({ ok: true, uptime: process.uptime() });
});

// ── Test notification (admin only, for debugging) ───────────────────
app.get("/api/test-notify", async (_req, res) => {
  const { notifyAdmin } = await import("./telegram.js");
  const ok = await notifyAdmin("✅ Тестовое уведомление — если видишь это, уведомления работают!");
  const rawWebApp = process.env.WEBAPP_URL || process.env.VITE_SITE_URL || "";
  res.json({
    ok,
    adminChatId: ENV.adminChatId,
    botTokenSet: !!ENV.botToken,
    webAppUrl: ENV.webAppUrl || null,
    webAppUrlRaw: rawWebApp || null,
    webAppUrlOk: !!ENV.webAppUrl,
  });
});

// ── Serve static SPA from dist/ ─────────────────────────────────────
app.use(
  express.static(DIST, {
    maxAge: "1y",
    immutable: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
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
  console.log(`\n  Server running on http://localhost:${ENV.port}`);
  console.log(`  Serving SPA from ${DIST}`);
  console.log(`  Admin hashes: ${ENV.adminHashes.length} configured`);

  const configuredNetworks = Object.entries(ENV.addr)
    .filter(([, v]) => !!v)
    .map(([k]) => k);
  console.log(`  Wallets configured: ${configuredNetworks.join(", ") || "none"}`);
  console.log(`  ADMIN_CHAT_ID: ${ENV.adminChatId || "⚠️  NOT SET"}`);
  console.log(`  WEBAPP_URL: ${ENV.webAppUrl || "⚠️  NOT SET"}`);
  console.log(`  NOTIFY_GROUP_ID: ${ENV.notifyGroupId || "not set"}`);
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
