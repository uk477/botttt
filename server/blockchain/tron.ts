import { ENV } from "../env.js";
import { matchTransaction, type IncomingTx } from "./matcher.js";

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const BASE = "https://api.trongrid.io";

interface TronTrc20Tx {
  transaction_id: string;
  from: string;
  to: string;
  value: string;
  token_info: { symbol: string; decimals: number; address: string };
  block_timestamp: number;
}

let lastChecked = Date.now() - 120_000;

export async function checkTron(): Promise<void> {
  const addr = ENV.addr.trc20;
  if (!addr) return;

  const since = lastChecked;
  const headers: Record<string, string> = {};
  if (ENV.trongridKey) headers["TRON-PRO-API-KEY"] = ENV.trongridKey;

  try {
    const url =
      `${BASE}/v1/accounts/${addr}/transactions/trc20` +
      `?limit=30&min_timestamp=${since}&contract_address=${USDT_CONTRACT}` +
      `&only_to=true&order_by=block_timestamp,desc`;

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.error(`[tron] API ${res.status}`);
      return;
    }

    const body = (await res.json()) as { data: TronTrc20Tx[] };
    const txs = body.data ?? [];

    for (const tx of txs) {
      if (tx.to.toLowerCase() !== addr.toLowerCase()) continue;

      const decimals = tx.token_info?.decimals ?? 6;
      const amount = Number(tx.value) / 10 ** decimals;

      const incoming: IncomingTx = {
        tx_hash: tx.transaction_id,
        network: "trc20",
        from_addr: tx.from,
        to_addr: tx.to,
        amount,
        token: "USDT",
        block: null,
        ts: new Date(tx.block_timestamp).toISOString(),
      };

      matchTransaction(incoming);
    }

    lastChecked = Date.now();
  } catch (e) {
    console.error("[tron] check error:", e);
  }
}
