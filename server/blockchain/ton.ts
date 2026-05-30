import { ENV } from "../env.js";
import { matchTransaction, type IncomingTx } from "./matcher.js";

const BASE = "https://toncenter.com/api/v2";

interface TonTx {
  transaction_id: { hash: string };
  in_msg?: {
    source: string;
    destination: string;
    value: string;
    message?: string;
  };
  utime: number;
}

let lastUtime = Math.floor(Date.now() / 1000) - 120;

export async function checkTon(): Promise<void> {
  const addr = ENV.addr.ton;
  if (!addr) return;

  try {
    const qs = new URLSearchParams({
      address: addr,
      limit: "20",
      archival: "false",
    });

    const res = await fetch(`${BASE}/getTransactions?${qs}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;

    const body = (await res.json()) as { ok: boolean; result: TonTx[] };
    if (!body.ok || !Array.isArray(body.result)) return;

    for (const tx of body.result) {
      if (tx.utime <= lastUtime) continue;
      if (!tx.in_msg || !tx.in_msg.value) continue;

      const dest = tx.in_msg.destination;
      if (!dest) continue;

      // TON addresses can have different representations; do a simple normalized comparison
      const normalDest = dest.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const normalAddr = addr.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      if (normalDest !== normalAddr) continue;

      const amountNano = BigInt(tx.in_msg.value);
      const amountTon = Number(amountNano) / 1e9;
      if (amountTon <= 0) continue;

      const incoming: IncomingTx = {
        tx_hash: tx.transaction_id.hash,
        network: "ton",
        from_addr: tx.in_msg.source || "unknown",
        to_addr: dest,
        amount: amountTon,
        token: "TON",
        block: null,
        ts: new Date(tx.utime * 1000).toISOString(),
      };

      matchTransaction(incoming);
    }

    if (body.result.length > 0) {
      const maxUtime = Math.max(...body.result.map((t) => t.utime));
      if (maxUtime > lastUtime) lastUtime = maxUtime;
    }
  } catch (e) {
    console.error("[ton] check error:", e);
  }
}
