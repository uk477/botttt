import { ENV } from "../env.js";
import { matchTransaction, type IncomingTx } from "./matcher.js";

const BASE = "https://blockstream.info/api";

interface BtcTx {
  txid: string;
  status: { confirmed: boolean; block_time?: number; block_height?: number };
  vout: { scriptpubkey_address?: string; value: number }[];
  vin: { prevout?: { scriptpubkey_address?: string } }[];
}

const seenTxids = new Set<string>();

export async function checkBitcoin(): Promise<void> {
  const addr = ENV.addr.btc;
  if (!addr) return;

  try {
    const res = await fetch(`${BASE}/address/${addr}/txs`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;

    const txs = (await res.json()) as BtcTx[];

    for (const tx of txs) {
      if (seenTxids.has(tx.txid)) continue;
      seenTxids.add(tx.txid);

      if (seenTxids.size > 500) {
        const first = seenTxids.values().next().value;
        if (first !== undefined) seenTxids.delete(first);
      }

      let totalReceived = 0;
      for (const out of tx.vout) {
        if (
          out.scriptpubkey_address &&
          out.scriptpubkey_address.toLowerCase() === addr.toLowerCase()
        ) {
          totalReceived += out.value;
        }
      }

      if (totalReceived <= 0) continue;

      const amountBtc = totalReceived / 1e8;
      const sender =
        tx.vin[0]?.prevout?.scriptpubkey_address ?? "unknown";

      const incoming: IncomingTx = {
        tx_hash: tx.txid,
        network: "btc",
        from_addr: sender,
        to_addr: addr,
        amount: amountBtc,
        token: "BTC",
        block: tx.status.block_height ?? null,
        ts: new Date((tx.status.block_time ?? Date.now() / 1000) * 1000).toISOString(),
      };

      matchTransaction(incoming);
    }
  } catch (e) {
    console.error("[bitcoin] check error:", e);
  }
}
