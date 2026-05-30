const e = import.meta.env

export const CONFIG = {
  brandName:    e.VITE_BRAND_NAME    ?? 'FANVUE MARKET',
  brandSubtitle: e.VITE_BRAND_SUBTITLE ?? 'MARKET · 2.0',
  botUsername:     e.VITE_BOT_USERNAME     ?? 'FanvueMarketBot',
  adminUsername:   e.VITE_ADMIN_USERNAME   ?? 'FanvueAdmin',
  supportUsername: e.VITE_SUPPORT_USERNAME ?? 'FanvueSupport',
  channelUsername: e.VITE_CHANNEL_USERNAME ?? 'FanvueStore',
  communityUsername: e.VITE_COMMUNITY_USERNAME ?? 'FanvueCommunity',

  /**
   * SHA-256 hashes of admin UIDs (format: SHA-256("fanvue:admin:v1:<uid>")).
   * Plain UIDs are NEVER shipped in the client bundle.
   * Generate yours:  node -e "require('crypto').createHash('sha256').update('fanvue:admin:v1:YOUR_UID').digest('hex')"
   */
  adminHashes: (e.VITE_ADMIN_HASHES ?? '')
    .split(',')
    .map((h: string) => h.trim().toLowerCase())
    .filter(Boolean) as string[],

  siteUrl:  e.VITE_SITE_URL ?? '',
  apiUrl:   e.VITE_API_URL  ?? '',

  addresses: {
    trc20:    e.VITE_ADDR_TRC20    ?? '',
    erc20:    e.VITE_ADDR_ERC20    ?? '',
    bep20:    e.VITE_ADDR_BEP20    ?? '',
    eth:      e.VITE_ADDR_ETH      ?? '',
    sol:      e.VITE_ADDR_SOL      ?? '',
    btc:      e.VITE_ADDR_BTC      ?? '',
    usdc_eth: e.VITE_ADDR_USDC_ETH ?? '',
    usdc_sol: e.VITE_ADDR_USDC_SOL ?? '',
    ton:      e.VITE_ADDR_TON      ?? '',
  },

  /** QR code image URLs per network (from .env). Empty = auto-generate via QRCodeSVG. */
  qrCodes: {
    trc20:    e.VITE_QR_TRC20    ?? '',
    erc20:    e.VITE_QR_ERC20    ?? '',
    bep20:    e.VITE_QR_BEP20    ?? '',
    eth:      e.VITE_QR_ETH      ?? '',
    sol:      e.VITE_QR_SOL      ?? '',
    btc:      e.VITE_QR_BTC      ?? '',
    usdc_eth: e.VITE_QR_USDC_ETH ?? '',
    usdc_sol: e.VITE_QR_USDC_SOL ?? '',
    ton:      e.VITE_QR_TON      ?? '',
  },

  paymentTimeoutMinutes: Number(e.VITE_PAYMENT_TIMEOUT_MINUTES ?? 30),
  refBonusPct:           Number(e.VITE_REF_BONUS_PCT           ?? 5),
  bulkDiscountPct:       Number(e.VITE_BULK_DISCOUNT_PCT       ?? 5),
  bulkDiscountMinQty:    Number(e.VITE_BULK_DISCOUNT_MIN_QTY   ?? 3),
  pollIntervalMs:        Number(e.VITE_POLL_INTERVAL_MS        ?? 6000),
  securityInstructionUrl: e.VITE_SECURITY_INSTRUCTION_URL ?? 'https://telegra.ph/Instrukciya-po-bezopasnosti-01-01',
} as const

// Курсы USD → крипто (ориентировочные, бэкенд должен вернуть точную сумму)
export const APPROX_RATES: Record<string, number> = {
  trc20: 1.0,
  erc20: 1.0,
  bep20: 1.0,
  usdc_eth: 1.0,
  usdc_sol: 1.0,
  eth: 0.00031,
  sol: 0.0058,
  btc: 0.0000098,
  ton: 0.18,
}
