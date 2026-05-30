import { orders, users, adminLogs, type OrderRow } from "./db.js";
import { notifyAdmin, notifyUserTemplated } from "./telegram.js";

/** After order is `paid`, mark completed, credit deposits, log, and notify. */
export function finalizeCompletedOrder(order: OrderRow, txHash?: string): boolean {
  const fresh = orders.get(order.id);
  if (!fresh) return false;

  if (fresh.status === "pending") {
    orders.markPaid(fresh.id, txHash || "manual");
  }

  const afterPaid = orders.get(order.id);
  if (!afterPaid || afterPaid.status !== "paid") return false;

  orders.markCompleted(order.id);
  const done = orders.get(order.id);
  if (!done || done.status !== "completed") return false;

  if (order.kind === "deposit") {
    users.credit(order.uid, order.amount_usd);
    console.log(`[finalize] CREDITED uid=${order.uid} +$${order.amount_usd}`);
  }

  const u = users.get(order.uid);
  adminLogs.add({
    type: "payment",
    uid: order.uid,
    username: u?.username ?? null,
    kind: order.kind,
    amount: order.amount_usd,
    network: order.network,
    status: "success",
    tx_hash: txHash ?? afterPaid.tx_hash ?? null,
  });

  const time = new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

  const isDeposit = order.kind === "deposit";

  notifyAdmin(
    isDeposit
      ? `<b>Депозит подтверждён</b>\n\n$${order.amount_usd} · ${order.network.toUpperCase()}\nUID: ${order.uid} · ${time}`
      : `<b>Оплата подтверждена</b>\n\n$${order.amount_usd} · ${order.network.toUpperCase()}\nUID: ${order.uid} · ${time}`,
  );

  notifyUserTemplated(
    order.uid,
    isDeposit ? "deposit_credited" : "payment_received",
    {
      amountUsd: order.amount_usd,
      orderId: isDeposit ? undefined : order.id,
      time,
    },
  );

  return true;
}
