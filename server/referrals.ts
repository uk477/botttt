import { referrals, referralRewards, refDailyStats, users, orders, type OrderRow } from "./db.js";

export const REF_PURCHASE_BONUS = 5;

/** Parse Telegram start_param from bot link (?start=ref123). */
export function parseReferrerUid(startParam: string): number | null {
  const raw = (startParam || "").trim();
  const m = raw.match(/^ref(\d{1,15})$/i);
  if (!m) return null;
  const uid = Number(m[1]);
  return Number.isInteger(uid) && uid > 0 ? uid : null;
}

/** Link a new visitor to their referrer (once per user). */
export function tryLinkReferral(referredUid: number, referrerUid: number): boolean {
  if (referredUid === referrerUid) return false;
  if (referrals.getByReferred(referredUid)) return false;
  if (!users.get(referrerUid)) return false;
  const referred = users.get(referredUid);
  if (referred && referred.purchases > 0) return false;
  const hasCompletedBuy = orders.hasCompletedBuy(referredUid);
  if (hasCompletedBuy) return false;
  referrals.link(referrerUid, referredUid);
  return true;
}

function mskDateKey(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
}

function currentMonthKey(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" }).slice(0, 7);
}

/** Credit referrer when a referred user completes a product purchase. */
export function processReferralPurchase(order: OrderRow): void {
  if (order.kind !== "buy" || order.status !== "completed") return;
  if (referralRewards.has(order.id)) return;

  const ref = referrals.getByReferred(order.uid);
  if (!ref) return;

  const wasFirst = ref.purchase_count === 0;
  referrals.recordPurchase(ref.referred_uid, order.amount_usd);
  referralRewards.insert({
    order_id: order.id,
    referrer_uid: ref.referrer_uid,
    referred_uid: ref.referred_uid,
    amount: REF_PURCHASE_BONUS,
  });

  users.accrueRef(ref.referrer_uid, REF_PURCHASE_BONUS, wasFirst ? 1 : 0);

  if (wasFirst) {
    refDailyStats.increment(ref.referrer_uid, mskDateKey());
  }

}

export function getReferralPayloadForUid(referrerUid: number) {
  const list = referrals.listByReferrer(referrerUid);
  const refDailyLog = refDailyStats.logForUser(referrerUid);
  const month = currentMonthKey();
  const count = refDailyStats.sumForMonth(referrerUid, month);
  const claimed = refDailyStats.isMonthlyClaimed(referrerUid, month);
  const recentSales = orders.recentCompletedBuys(30);

  return {
    referrals: list.map((r) => {
      const u = users.get(r.referred_uid);
      return {
        uid: r.referred_uid,
        username: u?.username ?? "",
        full_name: u?.full_name ?? "",
        photo_url: undefined as string | undefined,
        joinedAt: r.joined_at,
        totalSpent: r.total_spent,
        purchaseCount: r.purchase_count,
      };
    }),
    refDailyLog,
    refReward: { month, count, claimed },
    recentSales: recentSales.map((o, i) => {
      const u = users.get(o.uid);
      const idx = o.product_id != null && o.product_id <= 1 ? 0 : 1;
      return {
        id: `sale-${o.id}`,
        uid: o.uid,
        username: u?.username ?? "",
        full_name: u?.full_name ?? "",
        productTitle: o.product_title ?? "Purchase",
        productIndex: idx as 0 | 1,
        amount: o.amount_usd,
        ts: new Date(o.completed_at || o.paid_at || o.created_at).getTime() || Date.now() - i,
      };
    }),
  };
}
