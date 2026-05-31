/** Bulk tiers — must match ProductDetail.tsx */
export const BULK_TIERS = [
  { min: 3, pct: 5 },
  { min: 5, pct: 10 },
  { min: 10, pct: 15 },
] as const;

export function bulkDiscountPct(qty: number): number {
  const tier = [...BULK_TIERS].reverse().find((t) => qty >= t.min);
  return tier?.pct ?? 0;
}

export function expectedOrderTotalUsd(price: number, qty: number): number {
  const pct = bulkDiscountPct(qty);
  return Math.round(price * qty * (1 - pct / 100) * 100) / 100;
}
