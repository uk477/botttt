import { ENV } from "../env.js";
import { matchTransaction, type IncomingTx } from "./matcher.js";

const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955".toLowerCase();
const BASE = "https://api.bscscan.com/api";

interface BscTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenDecimal?: string;
  contractAddress?: string;
  blockNumber: string;
  timeStamp: string;
}

let lastBlock = "0";

export async function checkBsc(): Promise<void> {
  const addr = ENV.addr.bep20;
  if (!addr) return;

  try {
    const qs = new URLSearchParams({
      module: "account",
      action: "tokentxlist",
      address: addr,
      startblock: lastBlock,
      endblock: "99999999",
      sort: "desc",
      page: "1",
      offset: "30",
      ...(ENV.bscscanKey ? { apikey: ENV.bscscanKey } : {}),
    });

    const res = await fetch(`${BASE}?${qs}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return;
    const body = (await res.json()) as { status: string; result: BscTx[] | string };
    if (body.status !== "1" || !Array.isArray(body.result)) return;

    for (const tx of body.result) {
      if (tx.to.toLowerCase() !== addr.toLowerCase()) continue;
      if ((tx.contractAddress ?? "").toLowerCase() !== USDT_CONTRACT) continue;

      const decimals = Number(tx.tokenDecimal ?? "18");
      const amount = Number(tx.value) / 10 ** decimals;

      const incoming: IncomingTx = {
        tx_hash: tx.hash,
        network: "bep20",
        from_addr: tx.from,
        to_addr: tx.to,
        amount,
        token: "USDT",
        block: Number(tx.blockNumber),
        ts: new Date(Number(tx.timeStamp) * 1000).toISOString(),
      };

      matchTransaction(incoming);
    }

    if (body.result.length > 0) {
      lastBlock = body.result[0].blockNumber;
    }
  } catch (e) {
    console.error("[bsc] check error:", e);
  }
}
