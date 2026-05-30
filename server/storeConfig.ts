import { settings } from "./db.js";
import { ENV } from "./env.js";

export function parseJsonSetting<T>(key: string): T | undefined {
  const raw = settings.get(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function readMaintenanceFlag(): boolean {
  const raw = settings.get("maintenance");
  if (!raw) return false;
  try {
    return JSON.parse(raw) === true;
  } catch {
    return raw === "true";
  }
}

/** Public storefront config (addresses, links, texts, media). */
export function getPublicStoreConfig() {
  return {
    maintenance: readMaintenanceFlag(),
    addresses: { ...ENV.addr },
    siteLinks: parseJsonSetting<Record<string, string>>("siteLinks"),
    siteContent: parseJsonSetting<Record<string, string>>("siteContent"),
    photos: parseJsonSetting<Record<string, string>>("photos"),
    qrOverrides: parseJsonSetting<Record<string, string>>("qrOverrides"),
    refWithdrawNetworks: parseJsonSetting<string[]>("refWithdrawNetworks"),
  };
}
