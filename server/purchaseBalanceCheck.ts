import { verifyInitData, isAdmin, type TelegramUser } from "./telegram.js";
import { readMaintenanceFlag } from "./storeConfig.js";
import { ENV } from "./env.js";
import { users, products } from "./db.js";
import { expectedOrderTotalUsd } from "../shared/orderPricing.js";
import { APP_BUILD } from "./buildVersion.js";

export type BalancePurchaseIssue =
  | "bot_token_missing"
  | "init_data_empty"
  | "session_invalid"
  | "maintenance"
  | "invalid_product"
  | "product_not_found"
  | "amount_mismatch"
  | "out_of_stock"
  | "insufficient_balance";

export type BalancePurchaseCheck = {
  ok: boolean;
  error?: string;
  appBuild: string;
  issues: BalancePurchaseIssue[];
  checks: {
    botConfigured: boolean;
    session: boolean;
    product: boolean;
    amount: boolean;
    stock: boolean;
    balance: boolean;
  };
  uid?: number;
  balance?: number;
  required?: number;
  expected?: number;
  received?: number;
  product_id?: number;
  product_price?: number;
  product_title?: string;
};

export function checkBalancePurchase(input: {
  initData: string;
  product_id: number;
  quantity: number;
  amount_usd: number;
}): BalancePurchaseCheck {
  const issues: BalancePurchaseIssue[] = [];
  const checks = {
    botConfigured: !!ENV.botToken?.trim(),
    session: false,
    product: false,
    amount: false,
    stock: false,
    balance: false,
  };

  const base: BalancePurchaseCheck = {
    ok: false,
    appBuild: APP_BUILD,
    issues,
    checks,
    received: Number(input.amount_usd),
  };

  if (!checks.botConfigured) {
    issues.push("bot_token_missing");
    return { ...base, error: "Server misconfigured", issues };
  }

  if (!input.initData?.trim()) {
    issues.push("init_data_empty");
    return { ...base, error: "Unauthorized", issues };
  }

  const tgUser: TelegramUser | null = verifyInitData(input.initData);
  if (!tgUser) {
    issues.push("session_invalid");
    return { ...base, error: "Unauthorized", issues };
  }
  checks.session = true;

  const qty = Math.max(1, Math.min(99, Math.floor(Number(input.quantity) || 1)));
  const productId = Number(input.product_id);
  const total = Number(input.amount_usd);

  if (readMaintenanceFlag() && !isAdmin(tgUser.id)) {
    issues.push("maintenance");
    return { ...base, error: "maintenance", uid: tgUser.id, issues, checks };
  }

  if (!productId || productId <= 0) {
    issues.push("invalid_product");
    return { ...base, error: "Invalid product", uid: tgUser.id, issues, checks };
  }

  const product = products.get(productId);
  if (!product || Number(product.active) !== 1) {
    issues.push("product_not_found");
    return {
      ...base,
      error: "Product not found",
      uid: tgUser.id,
      product_id: productId,
      issues,
      checks,
    };
  }
  checks.product = true;

  const expected = expectedOrderTotalUsd(product.price, qty);
  if (!total || Math.abs(total - expected) > 0.02) {
    issues.push("amount_mismatch");
    return {
      ...base,
      error: "Invalid amount",
      uid: tgUser.id,
      product_id: productId,
      product_price: product.price,
      product_title: product.title,
      expected,
      required: expected,
      received: total,
      issues,
      checks,
    };
  }
  checks.amount = true;

  if (product.delivery === "auto" && product.stock < qty) {
    issues.push("out_of_stock");
    return {
      ...base,
      error: "Out of stock",
      uid: tgUser.id,
      product_id: productId,
      product_price: product.price,
      product_title: product.title,
      expected,
      required: expected,
      issues,
      checks,
    };
  }
  checks.stock = true;

  const userRow = users.upsert({
    uid: tgUser.id,
    username: tgUser.username ?? null,
    full_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || null,
  });

  if (userRow.balance < expected - 0.001) {
    issues.push("insufficient_balance");
    return {
      ...base,
      error: "Insufficient balance",
      uid: tgUser.id,
      balance: userRow.balance,
      required: expected,
      expected,
      product_id: productId,
      product_price: product.price,
      product_title: product.title,
      issues,
      checks,
    };
  }
  checks.balance = true;

  return {
    ok: true,
    appBuild: APP_BUILD,
    issues: [],
    checks,
    uid: tgUser.id,
    balance: userRow.balance,
    required: expected,
    expected,
    received: total,
    product_id: productId,
    product_price: product.price,
    product_title: product.title,
  };
}
