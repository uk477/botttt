import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { ENV } from "./env.js";
import authRouter from "./routes/auth.js";
import ordersRouter from "./routes/orders.js";
import notifyRouter from "./routes/notify.js";
import telegramRouter from "./routes/telegram.js";
import adminRouter from "./routes/admin.js";
import { startPoller } from "./blockchain/poller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "..", "dist");

const app = express();

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

// ── Start ───────────────────────────────────────────────────────────
app.listen(ENV.port, () => {
  console.log(`\n  Server running on http://localhost:${ENV.port}`);
  console.log(`  Serving SPA from ${DIST}`);
  console.log(`  Admin hashes: ${ENV.adminHashes.length} configured`);

  const configuredNetworks = Object.entries(ENV.addr)
    .filter(([, v]) => !!v)
    .map(([k]) => k);
  console.log(`  Wallets configured: ${configuredNetworks.join(", ") || "none"}`);
  console.log();

  startPoller();
});
