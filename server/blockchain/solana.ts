import { ENV } from "../env.js";
import { matchTransaction, type IncomingTx } from "./matcher.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RPC = process.env.SOL_RPC_URL || "https://api.mainnet-beta.solana.com";

interface SigInfo {
  signature: string;
  blockTime: number | null;
  err: unknown;
}

let lastSigSol: string | undefined;
let lastSigSpl: string | undefined;

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  const body = (await res.json()) as { result: unknown; error?: unknown };
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

export async function checkSolanaNative(): Promise<void> {
  const addr = ENV.addr.sol;
  if (!addr) return;

  try {
    const opts: Record<string, unknown> = { limit: 15 };
    if (lastSigSol) opts.until = lastSigSol;

    const sigs = (await rpc("getSignaturesForAddress", [addr, opts])) as SigInfo[];
    if (!sigs || sigs.length === 0) return;

    lastSigSol = sigs[0].signature;

    for (const sig of sigs) {
      if (sig.err) continue;

      const tx = (await rpc("getTransaction", [
        sig.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ])) as {
        meta: {
          preBalances: number[];
          postBalances: number[];
        };
        transaction: {
          message: {
            accountKeys: { pubkey: string }[];
          };
        };
        blockTime: number;
      } | null;

      if (!tx) continue;

      const keys = tx.transaction.message.accountKeys;
      const idx = keys.findIndex(
        (k) => k.pubkey.toLowerCase() === addr.toLowerCase(),
      );
      if (idx < 0) continue;

      const pre = tx.meta.preBalances[idx] ?? 0;
      const post = tx.meta.postBalances[idx] ?? 0;
      const lamportDiff = post - pre;
      if (lamportDiff <= 0) continue;

      const amount = lamportDiff / 1e9;

      const incoming: IncomingTx = {
        tx_hash: sig.signature,
        network: "sol",
        from_addr: keys[0]?.pubkey ?? "unknown",
        to_addr: addr,
        amount,
        token: "SOL",
        block: null,
        ts: new Date((sig.blockTime ?? 0) * 1000).toISOString(),
      };

      matchTransaction(incoming);
    }
  } catch (e) {
    console.error("[solana-native] check error:", e);
  }
}

export async function checkSolanaUsdc(): Promise<void> {
  const addr = ENV.addr.usdc_sol;
  if (!addr) return;

  try {
    const opts: Record<string, unknown> = { limit: 15 };
    if (lastSigSpl) opts.until = lastSigSpl;

    const sigs = (await rpc("getSignaturesForAddress", [addr, opts])) as SigInfo[];
    if (!sigs || sigs.length === 0) return;

    lastSigSpl = sigs[0].signature;

    for (const sig of sigs) {
      if (sig.err) continue;

      const tx = (await rpc("getTransaction", [
        sig.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ])) as {
        meta: {
          preTokenBalances: {
            accountIndex: number;
            mint: string;
            uiTokenAmount: { uiAmount: number | null };
          }[];
          postTokenBalances: {
            accountIndex: number;
            mint: string;
            uiTokenAmount: { uiAmount: number | null };
          }[];
        };
        blockTime: number;
        transaction: {
          message: {
            accountKeys: { pubkey: string }[];
          };
        };
      } | null;

      if (!tx) continue;

      const preUsdc = tx.meta.preTokenBalances.find(
        (b) => b.mint === USDC_MINT,
      );
      const postUsdc = tx.meta.postTokenBalances.find(
        (b) => b.mint === USDC_MINT,
      );
      if (!postUsdc) continue;

      const preAmt = preUsdc?.uiTokenAmount?.uiAmount ?? 0;
      const postAmt = postUsdc?.uiTokenAmount?.uiAmount ?? 0;
      const diff = postAmt - preAmt;
      if (diff <= 0) continue;

      const incoming: IncomingTx = {
        tx_hash: sig.signature,
        network: "usdc_sol",
        from_addr: tx.transaction.message.accountKeys[0]?.pubkey ?? "unknown",
        to_addr: addr,
        amount: diff,
        token: "USDC",
        block: null,
        ts: new Date((sig.blockTime ?? 0) * 1000).toISOString(),
      };

      matchTransaction(incoming);
    }
  } catch (e) {
    console.error("[solana-usdc] check error:", e);
  }
}
