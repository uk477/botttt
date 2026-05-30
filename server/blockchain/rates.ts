export interface LiveRates {
  btc: number;
  eth: number;
  sol: number;
  bnb: number;
  ton: number;
}

const FALLBACK: LiveRates = { btc: 105000, eth: 3800, sol: 180, bnb: 650, ton: 6.2 };
let cache: LiveRates = { ...FALLBACK };
let lastFetch = 0;
const TTL = 30_000;

async function fetchBinance(signal: AbortSignal): Promise<Partial<LiveRates> | null> {
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22,%22BNBUSDT%22,%22TONUSDT%22%5D",
      { signal },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { symbol: string; price: string }[];
    const out: Partial<LiveRates> = {};
    for (const t of data) {
      const p = parseFloat(t.price);
      if (t.symbol === "BTCUSDT") out.btc = p;
      else if (t.symbol === "ETHUSDT") out.eth = p;
      else if (t.symbol === "SOLUSDT") out.sol = p;
      else if (t.symbol === "BNBUSDT") out.bnb = p;
      else if (t.symbol === "TONUSDT") out.ton = p;
    }
    return out;
  } catch {
    return null;
  }
}

async function fetchCoinGecko(signal: AbortSignal): Promise<Partial<LiveRates> | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,the-open-network&vs_currencies=usd",
      { signal },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, { usd: number }>;
    return {
      btc: d.bitcoin?.usd,
      eth: d.ethereum?.usd,
      sol: d.solana?.usd,
      bnb: d.binancecoin?.usd,
      ton: d["the-open-network"]?.usd,
    };
  } catch {
    return null;
  }
}

export async function fetchLiveRates(): Promise<LiveRates> {
  if (Date.now() - lastFetch < TTL) return cache;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 8000);

  const [binance, gecko] = await Promise.allSettled([
    fetchBinance(ac.signal),
    fetchCoinGecko(ac.signal),
  ]);
  clearTimeout(timeout);

  const b = binance.status === "fulfilled" ? binance.value : null;
  const g = gecko.status === "fulfilled" ? gecko.value : null;

  const merged: LiveRates = { ...cache };
  for (const key of ["btc", "eth", "sol", "bnb", "ton"] as const) {
    merged[key] = b?.[key] ?? g?.[key] ?? cache[key] ?? FALLBACK[key];
  }

  cache = merged;
  lastFetch = Date.now();
  return cache;
}

export function getCachedRates(): LiveRates {
  return cache;
}

const STABLECOINS = new Set(["trc20", "erc20", "bep20", "usdc_eth", "usdc_sol"]);

export function usdToCrypto(
  usd: number,
  network: string,
  rates: LiveRates | null,
): number {
  if (STABLECOINS.has(network)) return usd;
  const r = rates ?? cache;
  switch (network) {
    case "btc":
      return r.btc > 0 ? usd / r.btc : 0;
    case "eth":
      return r.eth > 0 ? usd / r.eth : 0;
    case "sol":
      return r.sol > 0 ? usd / r.sol : 0;
    case "ton":
      return r.ton > 0 ? usd / r.ton : 0;
    default:
      return usd;
  }
}
