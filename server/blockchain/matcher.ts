import { orders, transactions, type OrderRow } from "../db.js";
import { finalizeCompletedOrder } from "../orderFinalize.js";

export interface IncomingTx {
  tx_hash: string;
  network: string;
  from_addr: string;
  to_addr: string;
  amount: number;
  token: string | null;
  block: number | null;
  ts: string;
}

const STABLECOINS = new Set(["trc20", "erc20", "bep20", "usdc_eth", "usdc_sol"]);

function amountMatches(order: OrderRow, txAmount: number): boolean {
  if (STABLECOINS.has(order.network)) {
    return Math.abs(txAmount - order.amount_usd) < 0.01;
  }
  const expected = order.amount_crypto;
  if (expected <= 0) return false;
  const tolerance = expected * 0.005; // 0.5% for volatile coins
  return Math.abs(txAmount - expected) < tolerance;
}

export function matchTransaction(tx: IncomingTx): OrderRow | null {
  if (transactions.exists(tx.tx_hash)) return null;

  const pending = orders.getPending(tx.network);
  if (pending.length === 0) return null;

  for (const order of pending) {
    if (amountMatches(order, tx.amount)) {
      orders.markPaid(order.id, tx.tx_hash);
      transactions.insert({ ...tx, order_id: order.id });

      console.log(
        `[matcher] MATCHED tx ${tx.tx_hash} -> order ${order.id} | ` +
          `${tx.amount} ${tx.network} | uid=${order.uid}`,
      );

      // Auto-complete after match (for networks with fast finality)
      // For BTC you might want to wait for confirmations, but for stablecoins/fast chains
      // marking as completed immediately is acceptable for a mini-app
      setTimeout(() => {
        const fresh = orders.get(order.id);
        if (fresh && fresh.status === "paid") {
          console.log(`[matcher] COMPLETED order ${order.id}`);
          finalizeCompletedOrder(order, tx.tx_hash);
        }
      }, 5000);

      return order;
    }
  }

  transactions.insert({ ...tx, order_id: null });
  return null;
}
