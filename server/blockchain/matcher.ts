import { orders, transactions, users, type OrderRow } from "../db.js";
import { notifyAdmin, notifyUser } from "../telegram.js";

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
          orders.markCompleted(order.id);
          console.log(`[matcher] COMPLETED order ${order.id}`);

          // Credit user balance for deposits (idempotent: markCompleted runs once
          // because it only updates rows where status='paid').
          if (order.kind === "deposit") {
            users.credit(order.uid, order.amount_usd);
            console.log(`[matcher] CREDITED uid=${order.uid} +$${order.amount_usd}`);
          }

          notifyAdmin(
            `✅ <b>Payment confirmed</b>\n` +
              `Order: <code>${order.id}</code>\n` +
              `Amount: $${order.amount_usd}\n` +
              `Network: ${order.network}\n` +
              `TX: <code>${tx.tx_hash}</code>\n` +
              `UID: ${order.uid}`,
          );

          notifyUser(
            order.uid,
            `✅ Your deposit of $${order.amount_usd} has been confirmed!\n` +
              `Order: ${order.id}`,
          );
        }
      }, 5000);

      return order;
    }
  }

  transactions.insert({ ...tx, order_id: null });
  return null;
}
