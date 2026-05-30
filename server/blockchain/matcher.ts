import { orders, transactions, users, type OrderRow } from "../db.js";
import { notifyAdmin, notifyUserWithButton } from "../telegram.js";

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

          const time = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

          const isDeposit = order.kind === "deposit";

          notifyAdmin(
            isDeposit
              ? `<b>Депозит подтверждён</b>\n\n$${order.amount_usd} · ${order.network.toUpperCase()}\nUID: ${order.uid} · ${time}\n<code>${tx.tx_hash.slice(0, 16)}…</code>`
              : `<b>Оплата подтверждена</b>\n\n$${order.amount_usd} · ${order.network.toUpperCase()}\nUID: ${order.uid} · ${time}\n<code>${tx.tx_hash.slice(0, 16)}…</code>`,
          );

          notifyUserWithButton(
            order.uid,
            isDeposit
              ? `<b>Депозит зачислен</b>\n\n<b>$${order.amount_usd}</b> уже на вашем балансе.\n${time}`
              : `<b>Оплата получена</b>\n\nЗаказ <code>${order.id}</code> на сумму <b>$${order.amount_usd}</b> оплачен.\nМы начали обработку. ${time}`,
            isDeposit ? "Открыть баланс" : "Посмотреть заказ",
          );
        }
      }, 5000);

      return order;
    }
  }

  transactions.insert({ ...tx, order_id: null });
  return null;
}
