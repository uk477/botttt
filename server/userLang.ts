import { settings } from "./db.js";
import type { NotifyLang } from "../shared/telegramTemplates.js";

export function detectLangFromTelegram(languageCode?: string | null): NotifyLang {
  return languageCode?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

/** App language for uid: in-app setting → default ru */
export function getUserNotifyLang(uid: number): NotifyLang {
  const stored = settings.get(`user_lang:${uid}`);
  if (stored === "ru" || stored === "en") return stored;
  return "ru";
}

export function persistUserLangIfMissing(uid: number, languageCode?: string | null): NotifyLang {
  const stored = settings.get(`user_lang:${uid}`);
  if (stored === "ru" || stored === "en") return stored;
  const detected = detectLangFromTelegram(languageCode);
  settings.set(`user_lang:${uid}`, detected);
  return detected;
}
