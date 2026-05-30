import "dotenv/config";
import { normalizeWebAppUrl } from "../shared/broadcastKeyboard.js";

function req(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function opt(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}

export const ENV = {
  port: Number(opt("PORT", "3000")),
  botToken: req("BOT_TOKEN"),
  notifyBotToken: opt("NOTIFY_BOT_TOKEN"),
  adminChatId: req("ADMIN_CHAT_ID"),
  notifyGroupId: opt("NOTIFY_GROUP_ID"),
  webAppUrl: (() => {
    const raw = opt("WEBAPP_URL") || opt("VITE_SITE_URL");
    const url = normalizeWebAppUrl(raw);
    if (raw.trim() && !url) {
      console.warn(
        `[env] WEBAPP_URL ignored (invalid for Telegram): "${raw}" — use https://your-domain.com`,
      );
    }
    return url;
  })(),
  webhookSecret: opt("TELEGRAM_WEBHOOK_SECRET"),
  corsOrigin: opt("CORS_ORIGIN"),
  adminHashes: (opt("ADMIN_HASHES") || opt("VITE_ADMIN_HASHES"))
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),

  addr: {
    trc20: opt("ADDR_TRC20") || opt("VITE_ADDR_TRC20"),
    erc20: opt("ADDR_ERC20") || opt("VITE_ADDR_ERC20"),
    bep20: opt("ADDR_BEP20") || opt("VITE_ADDR_BEP20"),
    eth: opt("ADDR_ETH") || opt("VITE_ADDR_ETH"),
    sol: opt("ADDR_SOL") || opt("VITE_ADDR_SOL"),
    btc: opt("ADDR_BTC") || opt("VITE_ADDR_BTC"),
    usdc_eth: opt("ADDR_USDC_ETH") || opt("VITE_ADDR_USDC_ETH"),
    usdc_sol: opt("ADDR_USDC_SOL") || opt("VITE_ADDR_USDC_SOL"),
    ton: opt("ADDR_TON") || opt("VITE_ADDR_TON"),
  } as Record<string, string>,

  setAddr(network: string, address: string) {
    this.addr[network] = address;
  },

  etherscanKey: opt("ETHERSCAN_API_KEY"),
  bscscanKey: opt("BSCSCAN_API_KEY"),
  trongridKey: opt("TRONGRID_API_KEY"),
  solRpcUrl: opt("SOL_RPC_URL"),
};
