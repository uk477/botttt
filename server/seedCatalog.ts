import { categories, products } from "./db.js";

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Аккаунты", name_en: "Accounts", emoji: "👤", active: true, sort_order: 0 },
  { id: 2, name: "Верификация", name_en: "Verification", emoji: "✓", active: true, sort_order: 1 },
] as const;

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    cat_id: 1,
    title: "Готовый верифицированный аккаунт",
    title_en: "Ready verified account",
    description: "Полностью готовый аккаунт Fanvue с пройденной верификацией.",
    desc_en: "A fully ready Fanvue account with verification already passed.",
    price: 35,
    delivery: "auto",
    stock: 14,
    active: true,
    auto_items: [] as string[],
    pinned: true,
    image_url: null as string | null,
  },
  {
    id: 2,
    cat_id: 2,
    title: "Верификация вашего аккаунта",
    title_en: "Verify your account",
    description: "Проводим верификацию уже существующего аккаунта Fanvue.",
    desc_en: "We verify your existing Fanvue account.",
    price: 50,
    delivery: "manual",
    stock: 99,
    active: true,
    auto_items: [] as string[],
    pinned: false,
    image_url: null as string | null,
  },
] as const;

/** Default lots — same IDs/prices as client MOCK_PRODUCTS when DB catalog is empty. */
export function seedCatalogIfEmpty(): void {
  const empty = products.getAll().length === 0;
  if (!empty) {
    for (const p of DEFAULT_PRODUCTS) {
      if (!products.get(p.id)) products.upsert(p);
    }
    return;
  }

  for (const c of DEFAULT_CATEGORIES) {
    categories.upsert(c);
  }
  for (const p of DEFAULT_PRODUCTS) {
    products.upsert(p);
  }

  console.log("[db] seeded default catalog (products table was empty)");
}
