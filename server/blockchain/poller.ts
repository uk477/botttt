import { orders } from "../db.js";
import { checkTron } from "./tron.js";
import { checkEthereumErc20, checkEthereumNative } from "./ethereum.js";
import { checkBsc } from "./bsc.js";
import { checkSolanaNative, checkSolanaUsdc } from "./solana.js";
import { checkBitcoin } from "./bitcoin.js";
import { checkTon } from "./ton.js";
import { fetchLiveRates } from "./rates.js";

const POLL_INTERVAL = 20_000;

interface ChainChecker {
  name: string;
  fn: () => Promise<void>;
}

const checkers: ChainChecker[] = [
  { name: "tron-trc20", fn: checkTron },
  { name: "eth-erc20", fn: checkEthereumErc20 },
  { name: "eth-native", fn: checkEthereumNative },
  { name: "bsc-bep20", fn: checkBsc },
  { name: "sol-native", fn: checkSolanaNative },
  { name: "sol-usdc", fn: checkSolanaUsdc },
  { name: "btc", fn: checkBitcoin },
  { name: "ton", fn: checkTon },
];

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;

  try {
    orders.expireOld();

    const pending = orders.getAllPending();
    if (pending.length === 0) {
      running = false;
      return;
    }

    // Refresh rates for amount conversion
    await fetchLiveRates().catch(() => {});

    const activeNetworks = new Set(pending.map((o) => o.network));

    // Map networks to checkers
    const networkToChecker: Record<string, string[]> = {
      trc20: ["tron-trc20"],
      erc20: ["eth-erc20"],
      usdc_eth: ["eth-erc20"],
      eth: ["eth-native"],
      bep20: ["bsc-bep20"],
      sol: ["sol-native"],
      usdc_sol: ["sol-usdc"],
      btc: ["btc"],
      ton: ["ton"],
    };

    const checkersToRun = new Set<string>();
    for (const net of activeNetworks) {
      const names = networkToChecker[net] ?? [];
      for (const n of names) checkersToRun.add(n);
    }

    // Run applicable checkers sequentially to respect rate limits
    for (const checker of checkers) {
      if (!checkersToRun.has(checker.name)) continue;

      try {
        await checker.fn();
      } catch (e) {
        console.error(`[poller] ${checker.name} error:`, e);
      }

      // Small delay between chain checks to avoid rate limit issues
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (e) {
    console.error("[poller] tick error:", e);
  } finally {
    running = false;
  }
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startPoller(): void {
  if (interval) return;
  console.log(`[poller] Starting blockchain poller (interval: ${POLL_INTERVAL}ms)`);

  // Run first tick after a short delay
  setTimeout(tick, 3000);
  interval = setInterval(tick, POLL_INTERVAL);
}

export function stopPoller(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
    console.log("[poller] Stopped");
  }
}
