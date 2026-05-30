import { useState, useRef, useEffect, useCallback, useMemo, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { useTelegram } from "../hooks/useTelegram";
import { tgNotify } from "../utils/tgNotify";
import { CONFIG } from "../config";
import { normalizeTelegramUrl } from "../utils/telegramLink";
import ConfirmSheet from "../components/ConfirmSheet";
import OrderReceiptMessage from "../components/OrderReceiptMessage";
import { parseMessageDate } from "../utils/date";
import { api } from "../store/api";
import type {
  SupportMessage,
  SupportAttachment,
  SupportTicket,
  SupportTicketCategory,
} from "../store/types";

/* Fanvue Care — premium messenger.
   Features: bot triage, tickets, attachments, replies, deletion,
   read receipts, real presence, no fake typing. */

const ease = [0.22, 1, 0.36, 1] as const;

const C = {
  bg: "#0a0a0b",
  surface: "#161618",
  surfaceHi: "#1d1d20",
  border: "rgba(255,255,255,0.07)",
  borderHi: "rgba(255,255,255,0.14)",
  text: "#f5f5f7",
  soft: "rgba(245,245,247,0.66)",
  muted: "rgba(245,245,247,0.42)",
  faint: "rgba(245,245,247,0.22)",
  green: "#39ff63",
  greenInk: "#062a10",
  greenBubble: "linear-gradient(180deg, #3dff66 0%, #28e052 100%)",
  danger: "#ff5a5f",
};

let _msgCounter = 0;
function newId(): number {
  _msgCounter += 1;
  return Date.now() * 1000 + (_msgCounter % 1000);
}

function fmtTime(iso: string, lang: string) {
  return parseMessageDate(iso).toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtDay(iso: string, lang: string) {
  const d = parseMessageDate(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return lang === "ru" ? "Сегодня" : "Today";
  if (same(d, yest)) return lang === "ru" ? "Вчера" : "Yesterday";
  return d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long" });
}

function fmtPresence(online: boolean, lastSeenIso: string, lang: string): string {
  const ru = lang === "ru";
  if (online) return ru ? "в сети" : "online";
  const last = new Date(lastSeenIso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - last);
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const lastD = new Date(lastSeenIso);

  // RU: правильное склонение
  const plural = (n: number, one: string, few: string, many: string) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  };

  if (diffMin < 1) return ru ? "был(а) только что" : "last seen just now";
  if (diffMin < 60) {
    return ru
      ? `был(а) ${diffMin} ${plural(diffMin, "минуту", "минуты", "минут")} назад`
      : `last seen ${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  }
  if (diffH < 24) {
    return ru
      ? `был(а) ${diffH} ${plural(diffH, "час", "часа", "часов")} назад`
      : `last seen ${diffH} ${diffH === 1 ? "hour" : "hours"} ago`;
  }
  if (diffDays < 7) {
    return ru
      ? `был(а) ${diffDays} ${plural(diffDays, "день", "дня", "дней")} назад`
      : `last seen ${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  }
  return ru
    ? `был(а) ${lastD.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`
    : `last seen ${lastD.toLocaleDateString("en-US", { day: "numeric", month: "short" })}`;
}

type CategoryIconKey = "card" | "package" | "user" | "chat";

const CategoryIcon = ({ icon, size = 18 }: { icon: CategoryIconKey; size?: number }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (icon === "card")
    return (
      <svg {...common}>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
        <path d="M2.5 10h19" />
        <path d="M6 15h3" />
      </svg>
    );
  if (icon === "package")
    return (
      <svg {...common}>
        <path d="M21 8.2v7.6a1.6 1.6 0 0 1-.86 1.42l-7 3.66a1.6 1.6 0 0 1-1.48 0l-7-3.66A1.6 1.6 0 0 1 3.8 15.8V8.2a1.6 1.6 0 0 1 .86-1.42l7-3.66a1.6 1.6 0 0 1 1.48 0l7 3.66A1.6 1.6 0 0 1 21 8.2Z" />
        <path d="M3.8 7.4 12 11.7l8.2-4.3" />
        <path d="M12 21V11.7" />
        <path d="M7.6 5.2l8.4 4.4" />
      </svg>
    );
  if (icon === "user")
    return (
      <svg {...common}>
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M4.6 20c.9-3.7 4-6 7.4-6s6.5 2.3 7.4 6" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M20.5 12.2c0 4.2-3.8 7.6-8.5 7.6-1.2 0-2.4-.2-3.4-.6l-4.6 1.3 1.4-4.2A7.4 7.4 0 0 1 3.5 12.2c0-4.2 3.8-7.6 8.5-7.6s8.5 3.4 8.5 7.6Z" />
    </svg>
  );
};

const CATEGORIES: Array<{
  id: SupportTicketCategory;
  icon: CategoryIconKey;
  ru: string;
  en: string;
  subRu: string;
  subEn: string;
}> = [
  { id: "payment", icon: "card", ru: "Платёж", en: "Payment", subRu: "оплата, зачисление, возврат", subEn: "checkout, credit, refund" },
  { id: "delivery", icon: "package", ru: "Доставка", en: "Delivery", subRu: "статус и сроки заказа", subEn: "order status & ETA" },
  { id: "account", icon: "user", ru: "Аккаунт", en: "Account", subRu: "вход, профиль, верификация", subEn: "login, profile, KYC" },
  { id: "operator", icon: "chat", ru: "Оператор", en: "Operator", subRu: "написать человеку напрямую", subEn: "talk to a human" },
];

/* ── Guided diagnostic flow ─────────────────────────────────────── */

type Bi = { ru: string; en: string };
type FlowAction =
  | { kind: "next"; next: string }
  | { kind: "tip"; tip: Bi; category: SupportTicketCategory }
  | { kind: "escalate"; category: SupportTicketCategory; prompt: Bi; summary?: string };
type FlowOption = { id: string; label: Bi; action: FlowAction };
type FlowNode = { q: Bi; options: FlowOption[] };

const FLOWS: Record<string, FlowNode> = {
  // ─── PAYMENT ───────────────────────────────────────────────────
  "payment:root": {
    q: {
      ru: "Чтобы быстрее помочь — уточните, какая именно проблема с оплатой:",
      en: "To help faster — what exactly is the payment issue?",
    },
    options: [
      {
        id: "not_credited",
        label: { ru: "Оплатил, но баланс не зачислен", en: "Paid, but balance not credited" },
        action: { kind: "next", next: "payment:when" },
      },
      {
        id: "wrong_amount",
        label: { ru: "Списали не ту сумму", en: "Wrong amount charged" },
        action: {
          kind: "escalate",
          category: "payment",
          summary: "Wrong amount",
          prompt: {
            ru: "Укажите дату, сумму, которую ожидали, и сумму, которая списалась. Прикрепите скриншот операции — мы проверим в течение часа.",
            en: "Share the date, expected amount and actually charged amount. Attach a screenshot — we'll review within an hour.",
          },
        },
      },
      {
        id: "failed",
        label: { ru: "Платёж не проходит", en: "Payment fails" },
        action: { kind: "next", next: "payment:fail_kind" },
      },
      {
        id: "refund",
        label: { ru: "Хочу вернуть средства", en: "I need a refund" },
        action: {
          kind: "escalate",
          category: "payment",
          summary: "Refund request",
          prompt: {
            ru: "Опишите ситуацию: дата, сумма, причина возврата. Оператор рассмотрит запрос и ответит.",
            en: "Describe the situation: date, amount, reason for refund. An operator will review and reply.",
          },
        },
      },
    ],
  },
  "payment:when": {
    q: { ru: "Сколько времени прошло после оплаты?", en: "How long ago did you pay?" },
    options: [
      {
        id: "lt_15",
        label: { ru: "Меньше 15 минут", en: "Less than 15 min" },
        action: {
          kind: "tip",
          category: "payment",
          tip: {
            ru: "Криптотранзакции часто подтверждаются 10–30 минут — иногда дольше при загрузке сети. Баланс зачислится автоматически, как только сеть подтвердит платёж. Если через час всё ещё ничего — откроем заявку и проверим вручную.",
            en: "Crypto confirmations usually take 10–30 minutes, sometimes longer during network load. Your balance updates automatically once the network confirms. If nothing appears within an hour — we'll open a ticket and verify manually.",
          },
        },
      },
      {
        id: "mid",
        label: { ru: "15–60 минут", en: "15–60 min" },
        action: { kind: "next", next: "payment:net" },
      },
      {
        id: "gt_1h",
        label: { ru: "Больше часа", en: "More than an hour" },
        action: {
          kind: "escalate",
          category: "payment",
          summary: "Payment not credited >1h",
          prompt: {
            ru: "Пришлите, пожалуйста: TX hash транзакции, сеть и точную сумму. Проверим в блокчейне и зачислим вручную.",
            en: "Please send: TX hash, network and exact amount. We'll check the blockchain and credit manually.",
          },
        },
      },
    ],
  },
  "payment:net": {
    q: { ru: "В какой сети вы платили?", en: "Which network did you use?" },
    options: [
      {
        id: "fast",
        label: { ru: "TRC20 / BEP20 / Solana", en: "TRC20 / BEP20 / Solana" },
        action: {
          kind: "tip",
          category: "payment",
          tip: {
            ru: "В этих сетях платежи обычно зачисляются за пару минут, но при перегрузке возможна задержка до 20–30 минут. Подождите ещё немного — если не зачислится, откроем заявку с TX hash.",
            en: "These networks usually credit within minutes, but congestion can delay it 20–30 min. Wait a bit longer — if it doesn't credit, we'll open a ticket with the TX hash.",
          },
        },
      },
      {
        id: "slow",
        label: { ru: "ERC20 (ETH) / BTC", en: "ERC20 (ETH) / BTC" },
        action: {
          kind: "tip",
          category: "payment",
          tip: {
            ru: "ETH и BTC при загрузке сети могут идти 30–60 минут, иногда дольше. Это нормально — баланс зачислится сам. Если через 1.5 часа всё ещё пусто, пришлёте TX hash — проверим.",
            en: "ETH and BTC may take 30–60 min under load, sometimes longer. This is normal — your balance will update automatically. If it's still empty after 1.5h, send the TX hash and we'll check.",
          },
        },
      },
      {
        id: "other",
        label: { ru: "Другая сеть", en: "Other network" },
        action: {
          kind: "escalate",
          category: "payment",
          summary: "Other network payment stuck",
          prompt: {
            ru: "Уточните сеть, пришлите TX hash и сумму — проверим в блокчейне.",
            en: "Specify the network, TX hash and amount — we'll verify on-chain.",
          },
        },
      },
    ],
  },
  "payment:fail_kind": {
    q: { ru: "Что показывает ошибка?", en: "What does the error say?" },
    options: [
      {
        id: "insufficient",
        label: { ru: "Недостаточно средств / комиссии", en: "Insufficient funds / fee" },
        action: {
          kind: "tip",
          category: "payment",
          tip: {
            ru: "Проверьте, хватает ли средств с учётом комиссии сети (особенно для ERC20 — нужен ETH на gas). Попробуйте сеть с меньшей комиссией (TRC20/BEP20). Если средств достаточно — откроем заявку.",
            en: "Make sure you have enough including network fees (ERC20 needs ETH for gas). Try a cheaper network (TRC20/BEP20). If you have enough — we'll open a ticket.",
          },
        },
      },
      {
        id: "network_err",
        label: { ru: "Ошибка сети / кошелька", en: "Network / wallet error" },
        action: {
          kind: "tip",
          category: "payment",
          tip: {
            ru: "Перезапустите кошелёк, проверьте подключение и попробуйте другую сеть. Если ошибка повторяется — пришлите скриншот, откроем заявку.",
            en: "Restart your wallet, check the connection and try another network. If it persists — send a screenshot and we'll open a ticket.",
          },
        },
      },
      {
        id: "other_err",
        label: { ru: "Другая ошибка", en: "Other error" },
        action: {
          kind: "escalate",
          category: "payment",
          summary: "Payment fails (other)",
          prompt: {
            ru: "Пришлите текст ошибки или скриншот — разберёмся.",
            en: "Send the error text or a screenshot — we'll figure it out.",
          },
        },
      },
    ],
  },

  // ─── DELIVERY ──────────────────────────────────────────────────
  "delivery:root": {
    q: { ru: "Что именно случилось с заказом?", en: "What's wrong with the order?" },
    options: [
      {
        id: "not_received",
        label: { ru: "Заказ оплачен, но не пришёл", en: "Paid but not delivered" },
        action: { kind: "next", next: "delivery:when" },
      },
      {
        id: "wrong_item",
        label: { ru: "Пришло не то / не работает", en: "Wrong item / doesn't work" },
        action: {
          kind: "escalate",
          category: "delivery",
          summary: "Wrong / faulty item",
          prompt: {
            ru: "Укажите номер заказа и что именно не так. Прикрепите скриншот или фото — поможем заменить.",
            en: "Share the order ID and what's wrong. Attach a screenshot or photo — we'll arrange a replacement.",
          },
        },
      },
      {
        id: "howto",
        label: { ru: "Не понимаю, как пользоваться", en: "Not sure how to use it" },
        action: {
          kind: "tip",
          category: "delivery",
          tip: {
            ru: "Откройте «Мои заказы» → нажмите на нужный заказ — внутри есть инструкция, ключ и данные доступа. Если внутри ничего нет или непонятно — откроем заявку.",
            en: "Open “My orders” → tap the order — instructions, keys and access info are inside. If it's empty or unclear — we'll open a ticket.",
          },
        },
      },
    ],
  },
  "delivery:when": {
    q: { ru: "Как давно был оплачен заказ?", en: "How long ago was the order paid?" },
    options: [
      {
        id: "lt_30",
        label: { ru: "Меньше 30 минут", en: "Less than 30 min" },
        action: {
          kind: "tip",
          category: "delivery",
          tip: {
            ru: "Авто-доставка обычно 1–10 минут, ручная — до 24 часов. Откройте «Мои заказы» и потяните вниз, чтобы обновить. Если статус «оплачен» висит дольше 30 минут — откроем заявку.",
            en: "Auto-delivery usually 1–10 min, manual up to 24h. Open “My orders” and pull to refresh. If it's stuck on “paid” over 30 min — we'll open a ticket.",
          },
        },
      },
      {
        id: "lt_24",
        label: { ru: "30 мин – 24 часа", en: "30 min – 24h" },
        action: {
          kind: "escalate",
          category: "delivery",
          summary: "Delivery delayed",
          prompt: {
            ru: "Укажите номер заказа — проверим статус доставки прямо сейчас.",
            en: "Share the order ID — we'll check the delivery status right now.",
          },
        },
      },
      {
        id: "gt_24",
        label: { ru: "Больше 24 часов", en: "More than 24h" },
        action: {
          kind: "escalate",
          category: "delivery",
          summary: "Delivery >24h",
          prompt: {
            ru: "Укажите номер заказа — разберёмся срочно и при необходимости вернём средства.",
            en: "Share the order ID — we'll resolve it urgently and refund if needed.",
          },
        },
      },
    ],
  },

  // ─── ACCOUNT ───────────────────────────────────────────────────
  "account:root": {
    q: { ru: "С чем нужно помочь по аккаунту?", en: "What do you need help with?" },
    options: [
      {
        id: "name",
        label: { ru: "Изменить имя / юзернейм", en: "Change name / username" },
        action: {
          kind: "tip",
          category: "account",
          tip: {
            ru: "Имя и @username берутся из вашего Telegram. Обновите их в Telegram → закройте и снова откройте приложение — данные подтянутся автоматически.",
            en: "Your name and @username come from Telegram. Update them in Telegram → reopen the app — data will sync automatically.",
          },
        },
      },
      {
        id: "verify",
        label: { ru: "Проблема с верификацией", en: "Verification issue" },
        action: {
          kind: "escalate",
          category: "account",
          summary: "Verification problem",
          prompt: {
            ru: "Опишите, что показывает приложение, и приложите скриншот — поможем пройти верификацию.",
            en: "Describe what the app shows and attach a screenshot — we'll help you verify.",
          },
        },
      },
      {
        id: "balance",
        label: { ru: "Не вижу баланс / историю", en: "Can't see balance / history" },
        action: {
          kind: "tip",
          category: "account",
          tip: {
            ru: "Закройте приложение полностью и откройте заново — данные подгрузятся. Если пусто и после этого — откроем заявку, проверим аккаунт.",
            en: "Fully close the app and open it again — data will reload. If still empty — we'll open a ticket and check your account.",
          },
        },
      },
      {
        id: "ref",
        label: { ru: "Реферальная программа", en: "Referral program" },
        action: {
          kind: "tip",
          category: "account",
          tip: {
            ru: "Откройте «Рефералы» — вверху страницы подробная подсказка. Если после этого вопрос остался — откроем заявку.",
            en: "Open “Referrals” — there's a detailed guide at the top. If a question remains — we'll open a ticket.",
          },
        },
      },
    ],
  },
};

function getFlowNode(key: string): FlowNode | null {
  if (FLOWS[key]) return FLOWS[key];
  // Dynamic node: resolve:<category> → 2-button choice after a tip
  if (key.startsWith("resolve:")) {
    const cat = key.split(":")[1] as SupportTicketCategory;
    return {
      q: { ru: "Это решило вопрос?", en: "Did this solve it?" },
      options: [
        {
          id: "ok",
          label: { ru: "Да, разобрался(ась)", en: "Yes, all clear" },
          action: {
            kind: "tip",
            category: cat,
            tip: {
              ru: "Отлично! Если появится новый вопрос — выберите тему ниже.",
              en: "Great! If something else comes up — pick a topic below.",
            },
          },
        },
        {
          id: "escalate",
          label: { ru: "Нет, нужен оператор", en: "No, I need an operator" },
          action: {
            kind: "escalate",
            category: cat,
            prompt: {
              ru: "Подключаю оператора. Опишите вопрос подробно и при необходимости прикрепите скриншот.",
              en: "Connecting an operator. Describe the issue in detail and attach a screenshot if helpful.",
            },
          },
        },
      ],
    };
  }
  return null;
}

// Reverse parent lookup for non-root flow nodes
const FLOW_PARENT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [parentKey, node] of Object.entries(FLOWS)) {
    for (const opt of node.options) {
      if (opt.action.kind === "next") map[opt.action.next] = parentKey;
    }
  }
  return map;
})();

function getFlowParent(key: string): string | null {
  if (key.startsWith("resolve:")) return null; // no back after tip
  if (key.endsWith(":root")) return "__triage__"; // back to category picker
  return FLOW_PARENT[key] ?? null;
}

const FLOW_TAG = "__flow";

const TRANSIENT_FLOW_TEXTS = new Set<string>([
  "Чтобы написать в поддержку — выберите тему ниже, и мы откроем заявку.",
  "To message support, pick a topic below and we'll open a ticket.",
  "Опишите ваш вопрос подробно — мы постараемся помочь.",
  "Describe your question in detail — we'll do our best.",
  "Это решило вопрос?",
  "Did this solve it?",
  "Да, разобрался(ась)",
  "Yes, all clear",
  "Нет, нужен оператор",
  "No, I need an operator",
  "Отлично! Если появится новый вопрос — выберите тему ниже.",
  "Great! If something else comes up — pick a topic below.",
  "Подключаю оператора. Опишите вопрос подробно и при необходимости прикрепите скриншот.",
  "Connecting an operator. Describe the issue in detail and attach a screenshot if helpful.",
  ...CATEGORIES.flatMap((cat) => [cat.ru, cat.en]),
  ...Object.values(FLOWS).flatMap((node) => [
    node.q.ru,
    node.q.en,
    ...node.options.flatMap((opt) => [
      opt.label.ru,
      opt.label.en,
      ...(opt.action.kind === "tip" ? [opt.action.tip.ru, opt.action.tip.en] : []),
      ...(opt.action.kind === "escalate" ? [opt.action.prompt.ru, opt.action.prompt.en] : []),
    ]),
  ]),
]);

function isTransientFlowMessage(m: SupportMessage): boolean {
  if (m.ticket_id === FLOW_TAG) return true;
  if (m.kind === "system" && (m.text === "triage_prompt" || m.text.startsWith("flow:"))) return true;
  if ((m.sender === "bot" || m.sender === "user") && TRANSIENT_FLOW_TEXTS.has(m.text)) return true;
  return false;
}

export default function Support() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const messages = useStore((s) => s.supportMessages);
  const tickets = useStore((s) => s.supportTickets);
  const presence = useStore((s) => s.adminPresence);
  const adminTyping = useStore((s) => s.adminTyping);
  const addSupportMessage = useStore((s) => s.addSupportMessage);
  const deleteSupportMessage = useStore((s) => s.deleteSupportMessage);
  const markAdminMessagesReadByUser = useStore((s) => s.markAdminMessagesReadByUser);
  const setUserTyping = useStore((s) => s.setUserTyping);
  const openSupportTicket = useStore((s) => s.openSupportTicket);
  const closeSupportTicket = useStore((s) => s.closeSupportTicket);
  const resolvePostDelivery = useStore((s) => s.resolvePostDelivery);
  const lang = useStore((s) => s.lang);
  const user = useStore((s) => s.user);
  const orders = useStore((s) => s.orders);

  const t = (ru: string, en: string) => (lang === "ru" ? ru : en);

  const [text, setText] = useState("");
  const [kbHeight, setKbHeight] = useState(0);
  const [focused, setFocused] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<SupportAttachment[]>([]);
  const [replyTo, setReplyTo] = useState<SupportMessage | null>(null);
  const [actionMsg, setActionMsg] = useState<SupportMessage | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [revealedDeleted, setRevealedDeleted] = useState<Set<number>>(new Set());
  // Тик каждые 30с — чтобы строка "был только что / в этом часу / сегодня в …" обновлялась без новых событий
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingDebounce = useRef<number | null>(null);
  const triagePromptQueuedRef = useRef(false);

  // Active ticket = newest non-closed
  const activeTicket = useMemo(
    () => tickets.find((t) => t.status !== "closed") ?? null,
    [tickets],
  );

  const lastClosedTicketAt = useMemo(
    () => Math.max(0, ...tickets.map((t) => (t.closed ? new Date(t.closed).getTime() : 0))),
    [tickets],
  );

  // Открытый заказ разрешает писать без тикета только пока админ не закрыл текущее обращение.
  const hasOpenOrder = useMemo(
    () => orders.some((o) => o.kind === "buy" && o.status === "paid" && new Date(o.created).getTime() > lastClosedTicketAt),
    [orders, lastClosedTicketAt],
  );
  const canWrite = !!activeTicket || hasOpenOrder;
  const needsTriage = !activeTicket && !hasOpenOrder;

  useEffect(() => {
    if (api.isEnabled()) void useStore.getState().pullServerSession();
  }, []);

  // Mark admin/bot messages as read on entry + when new arrive
  useEffect(() => {
    markAdminMessagesReadByUser();
  }, [markAdminMessagesReadByUser, messages.length]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = bottomRef.current?.parentElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages, adminTyping]);

  // Real typing flag (debounced)
  useEffect(() => {
    if (!text) {
      setUserTyping(false);
      return;
    }
    setUserTyping(true);
    if (typingDebounce.current) window.clearTimeout(typingDebounce.current);
    typingDebounce.current = window.setTimeout(() => setUserTyping(false), 1500);
    return () => {
      if (typingDebounce.current) window.clearTimeout(typingDebounce.current);
    };
  }, [text, setUserTyping]);

  // Cleanup typing on unmount
  useEffect(() => () => setUserTyping(false), [setUserTyping]);

  // Keyboard handling
  const onResize = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const diff = window.innerHeight - vv.height;
    setKbHeight(diff > 50 ? diff : 0);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, [onResize]);

  // Bot greeting if no active ticket and no triage prompt outstanding
  const lastBotPrompt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind === "system" && m.text.startsWith("triage_prompt")) return m;
      if (m.kind === "system" && m.text.startsWith("ticket_opened")) return null;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (activeTicket || hasOpenOrder) {
      triagePromptQueuedRef.current = false;
      return;
    }
    const last = messages[messages.length - 1];
    const lastIsInteractive =
      last?.kind === "system" &&
      (last.text === "triage_prompt" ||
        last.text.startsWith("flow:") ||
        last.text.startsWith("post_delivery_actions:"));
    if (lastIsInteractive) return;
    // Skip if user just answered a flow chip — next flow node is on its way.
    // But only if there's still an interactive prompt outstanding earlier in history.
    if (last?.sender === "user" && lastBotPrompt) return;
    if (triagePromptQueuedRef.current) return;
    triagePromptQueuedRef.current = true;

    if (messages.length === 0) {
      // initial greeting
      addSupportMessage({
        id: newId(),
        sender: "bot",
        kind: "text",
        text: t(
          `Привет${user?.full_name ? ", " + user.full_name : ""} 👋\nЯ — бот-помощник Fanvue Care. Подскажите, с чем нужна помощь, чтобы быстрее подключить нужного оператора.`,
          `Hi${user?.full_name ? ", " + user.full_name : ""} 👋\nI'm the Fanvue Care assistant. Tell me what's going on so I can route you to the right operator.`,
        ),
        created: new Date().toISOString(),
      });
    } else if (!lastBotPrompt) {
      // returning after closed ticket
      addSupportMessage({
        id: newId(),
        sender: "bot",
        kind: "text",
        text: t(
          "Чтобы написать в поддержку — выберите тему ниже, и мы откроем заявку.",
          "To message support, pick a topic below and we'll open a ticket.",
        ),
        created: new Date().toISOString(),
      });
    }
    addSupportMessage({
      id: newId(),
      sender: "bot",
      kind: "system",
      text: "triage_prompt",
      created: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicket?.id, messages.length, lang]);

  // Rebuild triage UI when language changes (avoid stale RU chips on EN)
  useEffect(() => {
    if (activeTicket || hasOpenOrder) return
    triagePromptQueuedRef.current = false
    useStore.setState((s) => ({
      supportMessages: s.supportMessages.filter((m) => !isTransientFlowMessage(m)),
    }))
  }, [lang, activeTicket?.id, hasOpenOrder]);

  const botMessage = (text: string, ticketId = FLOW_TAG): SupportMessage => ({
    id: newId(),
    sender: "bot",
    kind: "text",
    text,
    created: new Date().toISOString(),
    ticket_id: ticketId,
  });

  const flowNodeMessage = (flowKey: string): SupportMessage => ({
    id: newId(),
    sender: "bot",
    kind: "system",
    text: `flow:${flowKey}`,
    created: new Date().toISOString(),
    ticket_id: FLOW_TAG,
  });

  const userEchoMessage = (label: string): SupportMessage => ({
    id: newId(),
    sender: "user",
    kind: "text",
    text: label,
    created: new Date().toISOString(),
    read_by_admin: true,
    ticket_id: FLOW_TAG,
  });

  const replaceFlowMessages = useCallback((nextMessages: SupportMessage[]) => {
    useStore.setState((s) => ({
      supportMessages: [
        ...s.supportMessages.filter((m) => !isTransientFlowMessage(m)),
        ...nextMessages,
      ],
    }));
  }, []);

  const handlePickCategory = (cat: (typeof CATEGORIES)[number]) => {
    haptic("light");

    // Operator → straight to ticket (skip diagnostics)
    if (cat.id === "operator") {
      const ticket = openSupportTicket(cat.id);
      replaceFlowMessages([
        botMessage(
          t(
          "Подключаю оператора. Опишите вопрос подробно — ответим в ближайшее время.",
          "Connecting an operator. Describe your question in detail — we'll reply shortly.",
          ),
          ticket.id,
        ),
      ]);
      tgNotify(
        `🆕 Новая заявка ${ticket.id}\n📂 ${cat.ru}\n👤 ${user?.username ? "@" + user.username : user?.full_name ?? "—"} (ID: ${user?.uid})`,
      );
      return;
    }

    // Start guided diagnostic flow
    const rootKey = `${cat.id}:root`;
    const root = getFlowNode(rootKey);
    if (!root) {
      // Fallback — open ticket directly
      const ticket = openSupportTicket(cat.id);
      replaceFlowMessages([botMessage(t("Опишите ваш вопрос подробно — мы постараемся помочь.", "Describe your question in detail — we'll do our best."), ticket.id)]);
      tgNotify(
        `🆕 Новая заявка ${ticket.id}\n📂 ${cat.ru}\n👤 ${user?.username ? "@" + user.username : user?.full_name ?? "—"} (ID: ${user?.uid})`,
      );
      return;
    }
    replaceFlowMessages([botMessage(t(root.q.ru, root.q.en)), flowNodeMessage(rootKey)]);
  };

  const handleFlowAnswer = (flowKey: string, opt: FlowOption) => {
    haptic("light");

    const a = opt.action;
    if (a.kind === "next") {
      const node = getFlowNode(a.next);
      if (!node) return;
      // Wipe prior Q&A so chat stays clean; keep only the freshest step
      replaceFlowMessages([botMessage(t(node.q.ru, node.q.en)), flowNodeMessage(a.next)]);
    } else if (a.kind === "tip") {
      if (!flowKey.startsWith("resolve:")) {
        // First tip → ask "did it help?"
        replaceFlowMessages([botMessage(t(a.tip.ru, a.tip.en)), flowNodeMessage(`resolve:${a.category}`)]);
      } else {
        // User confirmed "Yes, all clear" → offer a fresh topic picker
        replaceFlowMessages([
          { id: newId(), sender: "bot", kind: "system", text: "triage_prompt", created: new Date().toISOString() },
        ]);
      }
    } else if (a.kind === "escalate") {
      const ticket = openSupportTicket(a.category, a.summary);
      // Clear all diagnostic clutter — only the ticket prompt remains
      replaceFlowMessages([botMessage(t(a.prompt.ru, a.prompt.en), ticket.id)]);
      const catLabel = CATEGORIES.find((c) => c.id === a.category);
      tgNotify(
        `🆕 Новая заявка ${ticket.id}\n📂 ${catLabel?.ru ?? a.category}${a.summary ? " · " + a.summary : ""}\n👤 ${user?.username ? "@" + user.username : user?.full_name ?? "—"} (ID: ${user?.uid})`,
      );
    }
  };

  const handleFlowBack = (currentKey: string) => {
    const parent = getFlowParent(currentKey);
    if (!parent) return;
    haptic("light");
    if (parent === "__triage__") {
      replaceFlowMessages([
        { id: newId(), sender: "bot", kind: "system", text: "triage_prompt", created: new Date().toISOString() },
      ]);
    } else {
      const node = getFlowNode(parent);
      if (!node) return;
      replaceFlowMessages([botMessage(t(node.q.ru, node.q.en)), flowNodeMessage(parent)]);
    }
  };


  const sendMessage = () => {
    if (!canWrite) return;
    const trimmed = text.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    haptic("light");

    // Determine kind
    const onlyImages = pendingFiles.length > 0 && pendingFiles.every((f) => f.mime.startsWith("image/"));
    const kind = pendingFiles.length === 0 ? "text" : onlyImages ? "image" : "file";

    addSupportMessage({
      id: newId(),
      sender: "user",
      kind,
      text: trimmed,
      attachments: pendingFiles.length > 0 ? pendingFiles : undefined,
      created: new Date().toISOString(),
      reply_to: replyTo?.id,
      ticket_id: activeTicket?.id,
      read_by_admin: false,
    });

    const replyExcerpt = replyTo ? `\n↪ ${(replyTo.text || "[вложение]").slice(0, 80)}` : "";
    const filesNote = pendingFiles.length > 0 ? `\n📎 ${pendingFiles.length} файл(ов)` : "";
    tgNotify(
      `💬 Сообщение в поддержку${activeTicket ? ` · ${activeTicket.id}` : ""}\n👤 ${user?.username ? "@" + user.username : user?.full_name ?? "—"} (ID: ${user?.uid})${replyExcerpt}${filesNote}\n\n${trimmed || "—"}`,
    );

    setText("");
    setPendingFiles([]);
    setReplyTo(null);
    if (taRef.current) taRef.current.style.height = "auto";
    setUserTyping(false);
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const out: SupportAttachment[] = [];
    for (const f of Array.from(files).slice(0, 4)) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      out.push({
        id: String(newId()),
        name: f.name,
        mime: f.type || "application/octet-stream",
        size: f.size,
        dataUrl,
      });
    }
    setPendingFiles((p) => [...p, ...out].slice(0, 6));
    haptic("light");
  };

  const handleDelete = (msg: SupportMessage, mode: "user" | "all") => {
    haptic("medium");
    deleteSupportMessage(msg.id, mode);
    setActionMsg(null);
  };

  const handleReplyAction = (msg: SupportMessage) => {
    haptic("light");
    setReplyTo(msg);
    setActionMsg(null);
    taRef.current?.focus();
  };

  // Group messages by day + sender
  const groups = useMemo(() => {
    type DayItem = { type: "day"; key: string; label: string };
    type GroupItem = { type: "group"; key: string; sender: SupportMessage["sender"]; items: SupportMessage[] };
    type SystemItem = { type: "system"; key: string; msg: SupportMessage };
    const out: Array<DayItem | GroupItem | SystemItem> = [];
    let lastDay = "";
    let cur: GroupItem | null = null;
    messages.forEach((m) => {
      const day = parseMessageDate(m.created).toDateString();
      if (day !== lastDay) {
        out.push({ type: "day", key: "d-" + day, label: fmtDay(m.created, lang) });
        lastDay = day;
        cur = null;
      }
      if (m.kind === "order_receipt") {
        out.push({ type: "system", key: "r-" + m.id, msg: m });
        cur = null;
        return;
      }
      if (m.kind === "system") {
        // Dedupe consecutive identical system pills (e.g. multiple "ticket_closed:")
        const prev = out[out.length - 1];
        const sysKey = m.text.split(":")[0];
        if (
          prev &&
          prev.type === "system" &&
          prev.msg.kind === "system" &&
          prev.msg.text.split(":")[0] === sysKey
        ) {
          cur = null;
          return;
        }
        out.push({ type: "system", key: "s-" + m.id, msg: m });
        cur = null;
        return;
      }
      if (!cur || cur.sender !== m.sender) {
        cur = { type: "group", key: "g-" + m.id, sender: m.sender, items: [] };
        out.push(cur);
      }
      cur.items.push(m);
    });
    return out;
  }, [messages, lang]);

  const lastUserId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === "user") return messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        paddingTop: "var(--tg-top)",
        paddingBottom: kbHeight > 0 ? kbHeight : 0,
        overflow: "hidden",
        background: C.bg,
        color: C.text,
      }}
    >
      <Header
        presence={presence}
        adminTyping={adminTyping}
        lang={lang}
        t={t}
        hasActiveTicket={!!activeTicket}
        onCloseTicket={() => {
          if (!activeTicket) return;
          haptic("medium");
          setConfirmClose(true);
        }}
        onBack={() => {
          haptic("light");
          if (window.history.length > 1) navigate(-1);
          else navigate("/");
        }}
        onInfo={() => {
          haptic("light");
          setShowInfo(true);
        }}
      />

      <main
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          padding: "16px 14px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <AnimatePresence initial={false}>
          {groups.map((g) => {
            if (g.type === "day") return <DaySeparator key={g.key} label={g.label} />;
            if (g.type === "system") {
              if (g.msg.kind === "order_receipt" && g.msg.order_receipt) {
                return (
                  <div key={g.key} style={{ display: 'flex', justifyContent: 'center', padding: '8px 12px' }}>
                    <OrderReceiptMessage payload={g.msg.order_receipt} />
                  </div>
                );
              }
              return (
                <SystemMessage
                  key={g.key}
                  msg={g.msg}
                  lang={lang}
                  t={t}
                  tickets={tickets}
                  isLastMessage={g.msg.id === messages[messages.length - 1]?.id}
                  onPickCategory={handlePickCategory}
                  onFlowAnswer={handleFlowAnswer}
                  onFlowBack={handleFlowBack}
                  onResolveDelivery={(orderId, choice) => {
                    haptic("light");
                    resolvePostDelivery(orderId, choice);
                  }}
                />
              );
            }
            return (
              <MessageGroup
                key={g.key}
                group={g}
                allMessages={messages}
                lang={lang}
                t={t}
                lastUserId={lastUserId}
                revealedDeleted={revealedDeleted}
                onLongPress={(m) => {
                  haptic("medium");
                  setActionMsg(m);
                }}
                onRevealDeleted={(id) =>
                  setRevealedDeleted((prev) => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                  })
                }
              />
            );
          })}
          {adminTyping && <TypingBubble key="typing" />}
        </AnimatePresence>
        <div ref={bottomRef} />
      </main>

      {needsTriage && (
        <TriageCategoryPanel
          lang={lang}
          t={t}
          onPickCategory={handlePickCategory}
        />
      )}

      <Composer
        focused={focused}
        text={text}
        setText={setText}
        setFocused={setFocused}
        handleSend={sendMessage}
        haptic={haptic}
        taRef={taRef}
        fileInputRef={fileInputRef}
        onPickFiles={onPickFiles}
        pendingFiles={pendingFiles}
        removePending={(id) => setPendingFiles((p) => p.filter((x) => x.id !== id))}
        replyTo={replyTo}
        cancelReply={() => setReplyTo(null)}
        t={t}
        disabled={!canWrite}
      />

      {/* Action sheet for message */}
      <AnimatePresence>
        {actionMsg && (
          <MessageActionSheet
            msg={actionMsg}
            lang={lang}
            t={t}
            onClose={() => setActionMsg(null)}
            onReply={() => handleReplyAction(actionMsg)}
            onDelete={(mode) => handleDelete(actionMsg, mode)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInfo && (
          <InfoSheet
            t={t}
            onClose={() => setShowInfo(false)}
            onCloseTicket={activeTicket ? () => { setShowInfo(false); haptic("medium"); setConfirmClose(true); } : undefined}
          />
        )}
      </AnimatePresence>

      <ConfirmSheet
        open={confirmClose}
        title={t("Завершить заявку?", "Close this ticket?")}
        message={t(
          "Если вопрос ещё актуален — лучше оставить её открытой. Закрытую заявку нельзя продолжить, потребуется создать новую.",
          "If your question is still relevant, keep it open. A closed ticket can't be reopened — you'll need to start a new one.",
        )}
        confirmLabel={t("Закрыть заявку", "Close ticket")}
        cancelLabel={t("Отмена", "Cancel")}
        danger
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          if (!activeTicket) return;
          closeSupportTicket(activeTicket.id);
          tgNotify(
            `✅ Клиент закрыл заявку ${activeTicket.id}\n👤 ${user?.username ? "@" + user.username : user?.full_name ?? "—"} (ID: ${user?.uid})`,
          );
        }}
      />
    </div>
  );
}

/* ── Header ─────────────────────────────────────────────────────── */

function BrandAvatar({ size = 38 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #1a1a1c 0%, #0e0e10 100%)",
        border: "1px solid rgba(57,255,99,0.28)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.4) inset, 0 4px 16px -6px rgba(57,255,99,0.35)",
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -2,
          background:
            "radial-gradient(circle at 30% 20%, rgba(57,255,99,0.22), transparent 55%), radial-gradient(circle at 70% 80%, rgba(57,255,99,0.10), transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        style={{ position: "relative", zIndex: 1 }}
      >
        <defs>
          <linearGradient id="fv-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a8ffba" />
            <stop offset="60%" stopColor="#39ff63" />
            <stop offset="100%" stopColor="#0fbf3a" />
          </linearGradient>
        </defs>
        <path
          d="M5 3h14v4H10v4h7v4h-7v6H5z"
          fill="url(#fv-grad)"
        />
      </svg>
    </div>
  );
}

function Header({
  presence,
  adminTyping,
  lang,
  t,
  onBack,
  onInfo,
}: {
  presence: { online: boolean; lastSeen: string };
  adminTyping: boolean;
  lang: string;
  t: (ru: string, en: string) => string;
  hasActiveTicket?: boolean;
  onCloseTicket?: () => void;
  onBack: () => void;
  onInfo: () => void;
}) {
  const status = adminTyping ? t("печатает…", "typing…") : fmtPresence(presence.online, presence.lastSeen, lang);
  const statusColor = adminTyping || presence.online ? C.green : C.soft;

  return (
    <motion.header
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease }}
      style={{
        flexShrink: 0,
        background: "rgba(10,10,11,0.85)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px 10px 8px",
      }}
    >
      <motion.button
        onClick={onBack}
        whileTap={{ scale: 0.88 }}
        aria-label={t("Назад", "Back")}
        style={iconBtn()}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </motion.button>

      <div style={{ position: "relative", flexShrink: 0 }}>
        <BrandAvatar />
        {presence.online && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: -1,
              bottom: -1,
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: C.green,
              border: `2px solid ${C.bg}`,
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: C.text,
            fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
            fontSize: 15.5,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {t("Поддержка Fanvue", "Fanvue Support")}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={status}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{
              marginTop: 2,
              fontSize: 12,
              fontWeight: 450,
              color: statusColor,
              lineHeight: 1.2,
              letterSpacing: "-0.005em",
            }}
          >
            {status}
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.button onClick={onInfo} whileTap={{ scale: 0.92 }} aria-label={t("Информация", "Info")} style={iconBtn(C.soft)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </motion.button>
    </motion.header>
  );
}

function iconBtn(color: string = C.text): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: 999,
    border: "none",
    background: "transparent",
    color,
    cursor: "pointer",
    padding: 0,
  };
}

/* ── Day pill ───────────────────────────────────────────────────── */

function DaySeparator({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 500,
          color: C.muted,
          padding: "5px 12px",
          borderRadius: 999,
          background: C.surface,
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Category picker (pinned above input when no open ticket) ─── */

function TriageCategoryPanel({
  lang,
  t,
  onPickCategory,
}: {
  lang: string;
  t: (ru: string, en: string) => string;
  onPickCategory: (cat: (typeof CATEGORIES)[number]) => void;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "10px 14px 8px",
        borderTop: `1px solid ${C.border}`,
        background: C.surface,
      }}
    >
      <p style={{ margin: "0 0 10px", fontSize: 12, color: C.muted, lineHeight: 1.4 }}>
        {t("Выберите тему — откроем заявку и можно будет писать в чат.", "Pick a topic — we'll open a ticket so you can chat.")}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {CATEGORIES.map((c) => (
          <motion.button
            key={c.id}
            type="button"
            onClick={() => onPickCategory(c)}
            whileTap={{ scale: 0.97 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              padding: "13px 13px 12px",
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              background: `linear-gradient(180deg, ${C.surfaceHi} 0%, ${C.surface} 100%)`,
              color: C.text,
              cursor: "pointer",
              textAlign: "left",
              lineHeight: 1.25,
              minHeight: 86,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: "rgba(57,255,99,0.10)",
                border: "1px solid rgba(57,255,99,0.20)",
                color: C.green,
              }}
            >
              <CategoryIcon icon={c.icon} size={18} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
              {t(c.ru, c.en)}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 450, color: C.muted, letterSpacing: "-0.005em" }}>
              {t(c.subRu, c.subEn)}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ── System message (triage prompt + ticket events) ─────────────── */

function SystemMessage({
  msg,
  lang,
  t,
  tickets,
  isLastMessage,
  onPickCategory,
  onFlowAnswer,
  onFlowBack,
  onResolveDelivery,
}: {
  msg: SupportMessage;
  lang: string;
  t: (ru: string, en: string) => string;
  tickets: SupportTicket[];
  isLastMessage: boolean;
  onPickCategory: (cat: (typeof CATEGORIES)[number]) => void;
  onFlowAnswer: (flowKey: string, opt: FlowOption) => void;
  onFlowBack: (currentKey: string) => void;
  onResolveDelivery: (orderId: string, choice: 'close' | 'continue') => void;
}) {
  if (msg.text === "triage_prompt") {
    if (!isLastMessage) return null;
    const locked = false;
    return (
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease }}
        style={{
          alignSelf: "stretch",
          margin: "10px 0 6px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {CATEGORIES.map((c, i) => (
          <motion.button
            key={c.id}
            onClick={() => !locked && onPickCategory(c)}
            disabled={locked}
            initial={false}
            animate={{ opacity: locked ? 0.4 : 1, y: 0 }}
            transition={{ duration: 0.16, ease }}
            whileTap={locked ? undefined : { scale: 0.97 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              padding: "13px 13px 12px",
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              background: `linear-gradient(180deg, ${C.surfaceHi} 0%, ${C.surface} 100%)`,
              color: C.text,
              cursor: locked ? "default" : "pointer",
              textAlign: "left",
              lineHeight: 1.25,
              minHeight: 86,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: "rgba(57,255,99,0.10)",
                border: "1px solid rgba(57,255,99,0.20)",
                color: C.green,
              }}
            >
              <CategoryIcon icon={c.icon} size={18} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
              {t(c.ru, c.en)}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 450, color: C.muted, letterSpacing: "-0.005em" }}>
              {t(c.subRu, c.subEn)}
            </span>
          </motion.button>
        ))}
      </motion.div>
    );
  }
  if (msg.text.startsWith("flow:")) {
    const flowKey = msg.text.slice(5);
    const node = getFlowNode(flowKey);
    if (!node) return null;
    if (!isLastMessage) return null; // stale flow — hide
    const parent = getFlowParent(flowKey);
    return (
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease }}
        style={{
          alignSelf: "stretch",
          margin: "6px 0 6px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {node.options.map((opt, i) => (
          <motion.button
            key={opt.id}
            onClick={() => onFlowAnswer(flowKey, opt)}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, ease }}
            whileTap={{ scale: 0.98 }}
            style={{
              alignSelf: "flex-end",
              maxWidth: "82%",
              padding: "10px 14px",
              borderRadius: 18,
              border: `1px solid ${C.green}55`,
              background: `${C.green}12`,
              color: C.green,
              fontSize: 13.5,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              cursor: "pointer",
              textAlign: "right",
              lineHeight: 1.3,
            }}
          >
            {t(opt.label.ru, opt.label.en)}
          </motion.button>
        ))}
        {parent && (
          <motion.button
            onClick={() => onFlowBack(flowKey)}
            initial={false}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{ duration: 0.14, ease }}
            whileTap={{ scale: 0.98 }}
            style={{
              alignSelf: "flex-end",
              padding: "8px 12px",
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.soft,
              fontSize: 12.5,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {t("Назад", "Back")}
          </motion.button>
        )}
      </motion.div>
    );
  }
  if (msg.text.startsWith("post_delivery_actions:")) {
    const orderId = msg.text.slice("post_delivery_actions:".length);
    const ru = lang === "ru";
    return (
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease }}
        style={{
          alignSelf: "stretch",
          margin: "10px 0 6px",
          padding: "14px 14px 12px",
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.surfaceHi} 0%, ${C.surface} 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span
            style={{
              width: 28, height: 28, borderRadius: 9, display: "grid", placeItems: "center",
              background: "rgba(57,255,99,0.12)", color: C.green,
              border: "1px solid rgba(57,255,99,0.25)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>
              {ru ? "Заказ выдан" : "Order delivered"}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2, lineHeight: 1.25 }}>
              {ru ? "Всё получилось? Если остались вопросы — можно продолжить переписку." : "All good? You can keep chatting if you still need help."}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <motion.button
            onClick={() => onResolveDelivery(orderId, "continue")}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: "10px 12px", borderRadius: 12,
              border: `1px solid ${C.border}`, background: "transparent",
              color: C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            {ru ? "У меня ещё вопрос" : "I have another question"}
          </motion.button>
          <motion.button
            onClick={() => onResolveDelivery(orderId, "close")}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: "10px 12px", borderRadius: 12, border: "none",
              background: C.greenBubble, color: C.greenInk,
              fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            {ru ? "Закрыть обращение" : "Close ticket"}
          </motion.button>
        </div>
      </motion.div>
    );
  }
  if (msg.text.startsWith("post_delivery_resolved:")) {
    const [, , choice] = msg.text.split(":");
    const ru = lang === "ru";
    const text = choice === "close"
      ? (ru ? "Обращение закрыто" : "Ticket closed")
      : (ru ? "Можно продолжать переписку" : "Chat is open — keep messaging");
    return <SysPill text={text} accent={choice !== "close"} />;
  }
  if (msg.text.startsWith("ticket_opened:")) {
    // Hidden — opened tickets are implicit; closing is handled via header button.
    void tickets;
    return null;
  }
  if (msg.text.startsWith("ticket_closed:")) {
    return <SysPill text={t("Заявка закрыта", "Ticket closed")} />;
  }
  if (msg.text.startsWith("verification_intake")) {
    const ru = lang === "ru";
    return (
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, ease }}
        style={{
          alignSelf: "stretch",
          margin: "10px 0 8px",
          padding: "16px 16px 14px",
          borderRadius: 18,
          border: `1px solid rgba(57,255,99,0.28)`,
          background:
            "linear-gradient(180deg, rgba(57,255,99,0.10) 0%, rgba(57,255,99,0.03) 60%, rgba(255,255,255,0.02) 100%)",
          boxShadow: "0 6px 24px rgba(57,255,99,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span
            style={{
              width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center",
              background: "rgba(57,255,99,0.16)", color: C.green,
              border: "1px solid rgba(57,255,99,0.32)",
              fontSize: 17,
            }}
          >
            🛡️
          </span>
          <div style={{ minWidth: 0, lineHeight: 1.2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
              {ru ? "Заявка на верификацию принята" : "Verification request received"}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
              {ru
                ? "Несколько простых шагов — и аккаунт будет готов"
                : "A few simple steps and your account will be ready"}
            </div>
          </div>
        </div>

        {/* Step 1 — email */}
        <div
          style={{
            display: "flex", gap: 11, padding: "11px 12px", borderRadius: 13,
            background: C.surface, border: `1px solid ${C.border}`, marginBottom: 8,
          }}
        >
          <span
            style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
              background: C.greenBubble, color: C.greenInk,
              display: "grid", placeItems: "center",
              fontSize: 11.5, fontWeight: 800,
            }}
          >
            1
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
              {ru ? "Отправьте e-mail от Fanvue" : "Send your Fanvue e-mail"}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.45, marginTop: 4 }}>
              {ru
                ? "Прямо в этот чат — только адрес, без пароля. Пароль от почты нам не нужен, e-mail используется только для входа в Fanvue."
                : "Right here in this chat — just the address, no password. We don't need your e-mail password; the address is used only to sign in to Fanvue."}
            </div>
          </div>
        </div>

        {/* Step 2 — wait */}
        <div
          style={{
            display: "flex", gap: 11, padding: "11px 12px", borderRadius: 13,
            background: C.surface, border: `1px solid ${C.border}`, marginBottom: 8,
          }}
        >
          <span
            style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", color: C.text,
              display: "grid", placeItems: "center",
              fontSize: 11.5, fontWeight: 800,
              border: `1px solid ${C.border}`,
            }}
          >
            2
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
              {ru ? "Мы проводим верификацию" : "We run the verification"}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.45, marginTop: 4 }}>
              {ru
                ? "Подберём чистые документы, пройдём face-match и разблокируем монетизацию. Среднее время — 2–6 часов, мы напишем сюда, как только всё готово."
                : "We supply clean documents, pass the face-match and unlock monetisation. Typically 2–6 hours — we'll message you here the moment it's done."}
            </div>
          </div>
        </div>

        {/* Step 3 — secure */}
        <div
          style={{
            display: "flex", gap: 11, padding: "11px 12px", borderRadius: 13,
            background: C.surface, border: `1px solid ${C.border}`,
          }}
        >
          <span
            style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", color: C.text,
              display: "grid", placeItems: "center",
              fontSize: 11.5, fontWeight: 800,
              border: `1px solid ${C.border}`,
            }}
          >
            3
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
              {ru ? "Зайдите в Fanvue и закройте аккаунт на замок" : "Log into Fanvue and lock it down"}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.45, marginTop: 4 }}>
              {ru
                ? "Когда верификация пройдена — войдите в свой Fanvue и максимально обезопасьте аккаунт:"
                : "Once verification is done — sign in to Fanvue and secure the account as much as possible:"}
            </div>
            <ul
              style={{
                margin: "8px 0 0", padding: 0, listStyle: "none",
                display: "flex", flexDirection: "column", gap: 5,
              }}
            >
              {[
                ru ? "Привяжите свой номер телефона" : "Add your phone number",
                ru ? "Включите двухфакторную аутентификацию (2FA)" : "Turn on two-factor authentication (2FA)",
                ru ? "Смените пароль на новый, известный только вам" : "Change the password to a new one only you know",
                ru ? "Выйдите со всех чужих устройств в настройках сессий" : "Log out all other devices from session settings",
              ].map((line, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    fontSize: 12, color: C.text, lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: C.green, fontSize: 13, lineHeight: 1.2, marginTop: 1 }}>✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          style={{
            marginTop: 12, fontSize: 11, color: C.muted, textAlign: "center",
            letterSpacing: "-0.005em",
          }}
        >
          {ru
            ? "Так аккаунт останется только вашим — никто из посторонних не сможет в него войти."
            : "That way the account stays only yours — nobody else can get in."}
        </div>
      </motion.div>
    );
  }
  return null;
}

function SysPill({ text, sub, accent }: { text: string; sub?: string; accent?: boolean }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.24, ease }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "10px 0 6px",
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: accent ? C.green : C.soft,
          padding: "5px 12px",
          borderRadius: 999,
          background: accent ? "rgba(57,255,99,0.10)" : C.surface,
          border: accent ? `1px solid rgba(57,255,99,0.28)` : `1px solid ${C.border}`,
          letterSpacing: 0,
        }}
      >
        {text}
      </span>
      {sub && <span style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</span>}
    </motion.div>
  );
}

/* ── Message group ──────────────────────────────────────────────── */

function MessageGroup({
  group,
  allMessages,
  lang,
  t,
  lastUserId,
  revealedDeleted,
  onLongPress,
  onRevealDeleted,
}: {
  group: { sender: SupportMessage["sender"]; items: SupportMessage[] };
  allMessages: SupportMessage[];
  lang: string;
  t: (ru: string, en: string) => string;
  lastUserId: number | null;
  revealedDeleted: Set<number>;
  onLongPress: (msg: SupportMessage) => void;
  onRevealDeleted: (id: number) => void;
}) {
  const isUser = group.sender === "user";

  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14, ease }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 2,
        marginTop: 8,
        marginBottom: 2,
      }}
    >
      {group.items.map((msg, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === group.items.length - 1;
        const showCheck = isUser;
        const replyMsg = msg.reply_to ? allMessages.find((x) => x.id === msg.reply_to) : null;

        // Deleted-for-user → for the user, replace with placeholder
        if (msg.deleted_for === "user" && !revealedDeleted.has(msg.id)) {
          return (
            <DeletedPlaceholder
              key={msg.id}
              isUser={isUser}
              t={t}
              onReveal={() => onRevealDeleted(msg.id)}
            />
          );
        }

        return (
          <Bubble
            key={msg.id}
            msg={msg}
            isUser={isUser}
            isFirst={isFirst}
            isLast={isLast}
            isBot={msg.sender === "bot"}
            showCheck={showCheck}
            replyMsg={replyMsg}
            time={fmtTime(msg.created, lang)}
            t={t}
            onLongPress={() => onLongPress(msg)}
            wasDeletedForUser={msg.deleted_for === "user"}
          />
        );
      })}
    </motion.section>
  );
}

function DeletedPlaceholder({
  isUser,
  t,
  onReveal,
}: {
  isUser: boolean;
  t: (ru: string, en: string) => string;
  onReveal: () => void;
}) {
  return (
    <motion.button
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onReveal}
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "78%",
        padding: "8px 14px",
        borderRadius: 18,
        background: "transparent",
        border: `1px dashed ${C.borderHi}`,
        color: C.muted,
        fontSize: 12.5,
        fontStyle: "italic",
        cursor: "pointer",
        marginTop: 2,
      }}
    >
      {t("Сообщение удалено · показать", "Message deleted · reveal")}
    </motion.button>
  );
}

function Bubble({
  msg,
  isUser,
  isFirst,
  isLast,
  isBot,
  showCheck,
  replyMsg,
  time,
  t,
  onLongPress,
  wasDeletedForUser,
}: {
  msg: SupportMessage;
  isUser: boolean;
  isFirst: boolean;
  isLast: boolean;
  isBot: boolean;
  showCheck: boolean;
  replyMsg: SupportMessage | null | undefined;
  time: string;
  t: (ru: string, en: string) => string;
  onLongPress: () => void;
  wasDeletedForUser: boolean;
}) {
  const pressTimer = useRef<number | null>(null);
  const startPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => onLongPress(), 420);
  };
  const cancelPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };

  const R = 18;
  const S = 6;
  const radiusUser = `${R}px ${isFirst ? R : S}px ${isLast ? R : S}px ${R}px`;
  const radiusOther = `${isFirst ? R : S}px ${R}px ${R}px ${isLast ? R : S}px`;


  const bg = isUser ? C.greenBubble : isBot ? "rgba(57,255,99,0.06)" : C.surface;
  const color = isUser ? C.greenInk : C.text;
  const border = isBot ? "1px solid rgba(57,255,99,0.16)" : "none";

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, ease }}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
      style={{
        maxWidth: "82%",
        padding: msg.attachments && msg.attachments.length > 0 ? "4px 4px 6px" : "7px 12px",
        borderRadius: isUser ? radiusUser : radiusOther,
        background: bg,
        color,
        border,
        fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
        fontSize: 15,
        lineHeight: 1.32,
        fontWeight: isUser ? 500 : 450,
        letterSpacing: "-0.005em",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        boxShadow: "none",
        position: "relative",
        opacity: wasDeletedForUser ? 0.6 : 1,
        userSelect: "none",
        cursor: "pointer",
      }}
    >
      {replyMsg && (
        <div
          style={{
            margin: "0 0 6px",
            padding: "6px 10px",
            borderLeft: `3px solid ${isUser ? C.greenInk : C.green}`,
            background: isUser ? "rgba(6,42,16,0.16)" : "rgba(255,255,255,0.04)",
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 500,
            color: isUser ? "rgba(6,42,16,0.78)" : C.soft,
            lineHeight: 1.3,
            maxHeight: 48,
            overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 1 }}>
            {replyMsg.sender === "user" ? t("Вы", "You") : replyMsg.sender === "bot" ? t("Бот", "Bot") : t("Поддержка", "Support")}
          </div>
          {replyMsg.text || (replyMsg.attachments?.length ? t("📎 вложение", "📎 attachment") : "—")}
        </div>
      )}

      {msg.attachments && msg.attachments.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: msg.attachments.length === 1 ? "1fr" : "1fr 1fr",
            gap: 4,
            marginBottom: msg.text ? 6 : 0,
          }}
        >
          {msg.attachments.map((a) =>
            a.mime.startsWith("image/") ? (
              <img
                key={a.id}
                src={a.dataUrl}
                alt={a.name}
                style={{
                  width: "100%",
                  maxHeight: 220,
                  objectFit: "cover",
                  borderRadius: 14,
                  display: "block",
                }}
              />
            ) : (
              <a
                key={a.id}
                href={a.dataUrl}
                download={a.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.25)",
                  color: isUser ? C.greenInk : C.text,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 18 }}>📄</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {a.name}
                </span>
              </a>
            ),
          )}
        </div>
      )}

      {msg.text && (
        <span
          style={{
            padding: msg.attachments && msg.attachments.length > 0 ? "0 8px" : 0,
            display: "inline",
          }}
        >
          {msg.text}
        </span>
      )}

      {/* Inline timestamp + check */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginLeft: msg.text ? 10 : 0,
          padding: msg.attachments && msg.attachments.length > 0 && !msg.text ? "0 8px 0 0" : 0,
          fontSize: 10.5,
          fontWeight: 500,
          color: isUser ? "rgba(6,42,16,0.58)" : C.muted,
          verticalAlign: "baseline",
          whiteSpace: "nowrap",
          position: "relative",
          top: 2,
          float: msg.text ? "right" : "none",
        }}
      >
        {time}
        {showCheck && (
          <ReadCheck read={!!msg.read_by_admin} />
        )}
      </span>
    </motion.div>
  );
}

function ReadCheck({ read }: { read: boolean }) {
  if (!read) {
    return (
      <svg width="12" height="9" viewBox="0 0 12 9" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 1, opacity: 0.9 }}>
        <path d="M1 5 L4.2 8 L11 1" />
      </svg>
    );
  }
  return (
    <svg width="17" height="9" viewBox="0 0 17 9" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 1, opacity: 0.9 }}>
      <path d="M1 5 L4.2 8 L11 1" />
      <path d="M6 5 L9.2 8 L16 1" />
    </svg>
  );
}

/* ── Typing bubble ──────────────────────────────────────────────── */

function TypingBubble() {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      style={{
        alignSelf: "flex-start",
        marginTop: 8,
        padding: "12px 14px",
        borderRadius: "22px 22px 22px 6px",
        background: C.surface,
        color: C.soft,
        boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }}
            animate={{ opacity: [0.32, 1, 0.32], y: [0, -3, 0] }}
            transition={{ duration: 1.05, repeat: Infinity, delay: i * 0.14, ease: "easeInOut" }}
          />
        ))}
      </span>
    </motion.div>
  );
}

/* ── Composer ───────────────────────────────────────────────────── */

function Composer({
  focused,
  text,
  setText,
  setFocused,
  handleSend,
  haptic,
  taRef,
  fileInputRef,
  onPickFiles,
  pendingFiles,
  removePending,
  replyTo,
  cancelReply,
  t,
  disabled,
}: {
  focused: boolean;
  text: string;
  setText: (value: string) => void;
  setFocused: (value: boolean) => void;
  handleSend: () => void;
  haptic: (type?: "light" | "medium" | "heavy" | "success" | "error" | "warning") => void;
  taRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPickFiles: (files: FileList | null) => void;
  pendingFiles: SupportAttachment[];
  removePending: (id: string) => void;
  replyTo: SupportMessage | null;
  cancelReply: () => void;
  t: (ru: string, en: string) => string;
  disabled?: boolean;
}) {
  const canSend = !disabled && (text.trim().length > 0 || pendingFiles.length > 0);
  const [attachOpen, setAttachOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  return (
    <footer
      style={{
        flexShrink: 0,
        background: "rgba(10,10,11,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderTop: `1px solid ${C.border}`,
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={false}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: "8px 14px 0",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "6px 10px",
                borderLeft: `3px solid ${C.green}`,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 8,
                fontSize: 12.5,
                color: C.soft,
                lineHeight: 1.3,
                maxHeight: 48,
                overflow: "hidden",
              }}
            >
              <div style={{ fontSize: 10.5, opacity: 0.7, marginBottom: 1, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t("Ответ", "Reply")} · {replyTo.sender === "user" ? t("вам", "you") : t("поддержке", "support")}
              </div>
              {(replyTo.text || t("📎 вложение", "📎 attachment")).slice(0, 100)}
            </div>
            <button onClick={cancelReply} style={{ ...iconBtn(C.soft), width: 28, height: 28 }} aria-label={t("Отмена", "Cancel")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingFiles.length > 0 && (
          <motion.div
            initial={false}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ display: "flex", gap: 8, padding: "10px 14px 0", overflowX: "auto" }}
          >
            {pendingFiles.map((f) => (
              <div key={f.id} style={{ position: "relative", flexShrink: 0 }}>
                {f.mime.startsWith("image/") ? (
                  <img
                    src={f.dataUrl}
                    alt={f.name}
                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 22,
                    }}
                  >
                    📄
                  </div>
                )}
                <button
                  onClick={() => removePending(f.id)}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${C.bg}`,
                    background: C.danger,
                    color: "#fff",
                    cursor: "pointer",
                    padding: 0,
                    display: "grid",
                    placeItems: "center",
                  }}
                  aria-label={t("Удалить", "Remove")}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "10px 12px" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
        />

        <div style={{ position: "relative" }}>
          <motion.button
            whileTap={disabled ? undefined : { scale: 0.88 }}
            onClick={() => { if (disabled) return; haptic("light"); setAttachOpen((v) => !v); }}
            disabled={disabled}
            aria-label={t("Прикрепить", "Attach")}
            style={{ ...iconBtn(C.soft), marginBottom: 2, opacity: disabled ? 0.35 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
          >
            <motion.span animate={{ rotate: attachOpen ? 45 : 0 }} transition={{ duration: 0.2 }} style={{ display: "inline-flex" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </motion.span>
          </motion.button>

          <AnimatePresence>
            {attachOpen && (
              <>
                <motion.div
                  initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setAttachOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                />
                <motion.div
                  initial={false}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.16 }}
                  style={{
                    position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 50,
                    background: "rgba(22,23,26,0.96)", backdropFilter: "blur(20px)",
                    border: `1px solid ${C.borderHi}`, borderRadius: 16,
                    padding: 6, minWidth: 200,
                    boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
                  }}
                >
                  {[
                    { k: "camera", label: t("Камера", "Camera"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>, color: "#39ff63", ref: cameraInputRef },
                    { k: "gallery", label: t("Фото / Видео", "Photo / Video"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>, color: "#7cd1ff", ref: galleryInputRef },
                    { k: "file", label: t("Документ", "Document"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M10 13h4M10 17h4"/></svg>, color: "#ffb020", ref: fileInputRef },
                  ].map((opt) => (
                    <button
                      key={opt.k}
                      onClick={() => {
                        haptic("light");
                        setAttachOpen(false);
                        const el = opt.ref.current;
                        if (!el) return;
                        // На некоторых WebView (Telegram, in-app) capture срабатывает только если выставить его прямо перед кликом
                        if (opt.k === "camera") {
                          el.setAttribute("capture", "environment");
                        } else {
                          el.removeAttribute("capture");
                        }
                        el.click();
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, width: "100%",
                        padding: "11px 12px", background: "transparent", border: "none",
                        color: C.text, fontSize: 14, fontWeight: 500, textAlign: "left",
                        borderRadius: 10, cursor: "pointer",
                      }}
                    >
                      <span style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: `${opt.color}1f`, color: opt.color,
                        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          animate={{ borderColor: focused ? "rgba(57,255,99,0.35)" : "transparent" }}
          transition={{ duration: 0.16 }}
          style={{
            flex: 1,
            minHeight: 38,
            background: C.surface,
            border: "1.5px solid transparent",
            borderRadius: 22,
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <textarea
            ref={taRef}
            placeholder={disabled ? t("Сначала создайте заявку", "Create a ticket first") : t("Сообщение", "Message")}
            value={text}
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setText(e.target.value);
              const el = e.target as HTMLTextAreaElement;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!disabled) handleSend();
              }
            }}
            rows={1}
            className="scrollbar-hide"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              color: C.text,
              fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
              fontSize: 15,
              fontWeight: 450,
              lineHeight: 1.4,
              padding: "9px 0",
              maxHeight: 120,
              letterSpacing: "-0.005em",
              width: "100%",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              caretColor: C.green,
            }}
          />
        </motion.div>

        <motion.button
          onClick={handleSend}
          disabled={!canSend}
          animate={{
            scale: canSend ? 1 : 0,
            opacity: canSend ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          whileTap={canSend ? { scale: 0.88 } : undefined}
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: "50%",
            border: "none",
            background: C.green,
            color: C.greenInk,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canSend ? "pointer" : "default",
            padding: 0,
            boxShadow: "0 4px 14px -4px rgba(57,255,99,0.6)",
            pointerEvents: canSend ? "auto" : "none",
          }}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </motion.button>
      </div>
    </footer>
  );
}

/* ── Action sheet ───────────────────────────────────────────────── */

function MessageActionSheet({
  msg,
  lang,
  t,
  onClose,
  onReply,
  onDelete,
}: {
  msg: SupportMessage;
  lang: string;
  t: (ru: string, en: string) => string;
  onClose: () => void;
  onReply: () => void;
  onDelete: (mode: "user" | "all") => void;
}) {
  const isOwn = msg.sender === "user";
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <motion.div
        initial={false}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 8px max(10px, env(safe-area-inset-bottom))",
          background: "linear-gradient(180deg, rgba(30,32,36,0.96), rgba(22,24,28,0.96))",
          borderRadius: 20,
          padding: 6,
          border: `1px solid ${C.borderHi}`,
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
          overflow: "hidden",
        }}
      >
        {/* Preview */}
        <div
          style={{
            padding: "12px 14px",
            margin: "2px 2px 6px",
            background: "rgba(255,255,255,0.035)",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: isOwn ? C.green : C.soft, opacity: 0.7 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 3, fontWeight: 600, letterSpacing: "0.02em" }}>
              {isOwn ? t("Вы", "You") : t("Fanvue · Забота", "Fanvue · Care")} · {fmtTime(msg.created, lang)}
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: C.text,
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {msg.text || t("Вложение", "Attachment")}
            </div>
          </div>
        </div>

        <ActionRow
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
          }
          label={t("Ответить", "Reply")}
          onClick={onReply}
        />

        <div style={{ height: 1, background: C.border, margin: "2px 14px" }} />

        <ActionRow
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          }
          label={isOwn ? t("Удалить у всех", "Delete for everyone") : t("Скрыть у себя", "Hide for me")}
          onClick={() => onDelete("user")}
          danger
        />

        <div style={{ height: 1, background: C.border, margin: "2px 14px" }} />

        <ActionRow
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          }
          label={t("Отмена", "Cancel")}
          onClick={onClose}
          muted
        />
      </motion.div>
    </motion.div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  danger,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.985, background: "rgba(255,255,255,0.04)" }}
      style={{
        width: "100%",
        padding: "13px 16px",
        background: "transparent",
        border: "none",
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        gap: 14,
        color: danger ? C.danger : muted ? C.soft : C.text,
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: "-0.005em",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: 0.95 }}>
        {icon}
      </span>
      {label}
    </motion.button>
  );
}

/* ── Info sheet ─────────────────────────────────────────────────── */

function InfoSheet({ t, onClose, onCloseTicket }: { t: (ru: string, en: string) => string; onClose: () => void; onCloseTicket?: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  const siteLinks = useStore((s) => s.siteLinks);
  const supportHref = normalizeTelegramUrl(siteLinks.supportUrl) || normalizeTelegramUrl(`@${CONFIG.supportUsername}`);

  // Считаем "сейчас работаем" по GMT+3, 8:00–22:00
  const nowMskHour = (() => {
    const d = new Date();
    const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
    const mskMin = (utcMin + 3 * 60) % (24 * 60);
    return mskMin / 60;
  })();
  const isWorking = nowMskHour >= 8 && nowMskHour < 22;

  const faq = [
    {
      q: t("Как составить заявку?", "How do I file a ticket?"),
      a: t(
        "Опишите вопрос одним сообщением: что произошло, когда, при каком заказе. Прикрепите скриншот через скрепку слева. Чем подробнее — тем быстрее ответ.",
        "Describe the issue in one message: what happened, when, on which order. Attach a screenshot via the paperclip on the left. More detail = faster reply.",
      ),
    },
    {
      q: t("Время работы поддержки", "Support hours"),
      a: t(
        "Работаем ежедневно с 8:00 до 22:00 (GMT+3). Среднее время первого ответа — около 5 минут.",
        "We work daily 8:00–22:00 (GMT+3). Average first reply ≈ 5 minutes.",
      ),
    },
    {
      q: t("Где мой заказ?", "Where is my order?"),
      a: t(
        "Авто-доставка приходит за 2–10 минут после оплаты. Ручная — от 1 до 24 часов. Если ждёте дольше — пришлите номер заказа.",
        "Auto delivery arrives within 2–10 min of payment. Manual delivery 1–24h. Waiting longer? Send the order ID.",
      ),
    },
    {
      q: t("Платёж не зачислился", "Payment didn't credit"),
      a: t(
        "Пришлите скриншот транзакции и сеть. Транзакция в blockchain должна получить минимум 1 подтверждение.",
        "Send a transaction screenshot and the network. The blockchain transaction needs at least 1 confirmation.",
      ),
    },
    {
      q: t("Возвраты и гарантии", "Refunds & guarantees"),
      a: t(
        "Если услуга не оказана — возвращаем 100% средств на баланс или в крипту. Условия — в разделе «Правила».",
        "If a service isn't delivered — full refund to balance or crypto. See the Rules section.",
      ),
    },
  ];

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(57,255,99,0.08) 0%, rgba(57,255,99,0) 55%), linear-gradient(180deg, #131418 0%, #0d0e11 100%)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: "10px 18px max(24px, env(safe-area-inset-bottom))",
          border: `1px solid ${C.borderHi}`,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <motion.div
          drag="y"
          dragDirectionLock
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.y > 80 || info.velocity.y > 500) {
              onClose();
            }
          }}
          style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)", margin: "4px auto 18px", cursor: "grab", touchAction: "none" }}
        />

        {/* Header */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}
        >
          <LiveChatLogo size={56} active={isWorking} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
              {t("Поддержка Fanvue", "Fanvue Support")}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 12.5 }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: isWorking ? "#39ff63" : "#ffb020",
                boxShadow: isWorking ? "0 0 8px #39ff63" : "none",
              }} />
              <span style={{ color: isWorking ? "#39ff63" : "#ffb020", fontWeight: 600 }}>
                {isWorking
                  ? t("сейчас отвечаем", "answering now")
                  : t("ответим завтра", "we'll reply tomorrow")}
              </span>
              <span style={{ color: C.muted }}>· 8:00–22:00 GMT+3</span>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ display: "flex", gap: 8, marginBottom: 22 }}
        >
          <Stat icon="bolt"  label={t("Ответ", "Reply")} value={t("≈ 5 мин", "≈ 5 min")} />
          <Stat icon="clock" label={t("Часы", "Hours")} value="8–22" />
          <Stat icon="globe" label={t("Язык", "Lang")}  value="RU / EN" />
        </motion.div>

        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", margin: "8px 0 10px" }}>
          {t("Частые вопросы", "FAQ")}
        </div>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } } }}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {faq.map((f, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={i}
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                style={{
                  background: isOpen
                    ? "linear-gradient(180deg, rgba(57,255,99,0.06), rgba(57,255,99,0.02))"
                    : "rgba(255,255,255,0.025)",
                  border: `1px solid ${isOpen ? "rgba(57,255,99,0.25)" : C.border}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  transition: "background 200ms ease, border-color 200ms ease",
                }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "13px 14px",
                    background: "transparent",
                    border: "none",
                    color: C.text,
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span>{f.q}</span>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }} style={{ display: "inline-flex", color: isOpen ? "#39ff63" : C.soft, flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={false}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ padding: "0 14px 14px", fontSize: 13.5, color: C.soft, lineHeight: 1.5 }}>{f.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.a
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          whileTap={{ scale: 0.98 }}
          whileHover="hover"
          href={supportHref || '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: 20,
            padding: "14px 16px",
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(55,187,254,0.18), rgba(55,187,254,0.08))",
            border: "1px solid rgba(55,187,254,0.38)",
            color: "#7cd1ff",
            fontSize: 14.5,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 8px 24px rgba(55,187,254,0.15)",
          }}
        >
          {/* Dashed flight trail */}
          <motion.svg
            aria-hidden
            width="100%" height="14" viewBox="0 0 300 14" preserveAspectRatio="none"
            style={{ position: "absolute", left: 0, right: 0, top: "50%", marginTop: -7, opacity: 0.35, pointerEvents: "none" }}
          >
            <motion.path
              d="M0 7 Q 75 -2 150 7 T 300 7"
              fill="none" stroke="#7cd1ff" strokeWidth="1" strokeDasharray="3 5"
              animate={{ strokeDashoffset: [0, -16] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            />
          </motion.svg>
          <motion.span
            style={{ display: "inline-flex" }}
            animate={{ x: [-3, 3, -3], y: [1, -1, 1], rotate: [-6, 6, -6] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            variants={{ hover: { x: 4, y: -2, rotate: 8, transition: { duration: 0.3 } } }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7cd1ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" fill="rgba(124,209,255,0.15)" />
            </svg>
          </motion.span>
          <span style={{ position: "relative" }}>{t("Связаться в Telegram", "Open in Telegram")}</span>
        </motion.a>

        {onCloseTicket && (
          <motion.button
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={onCloseTicket}
            whileTap={{ scale: 0.98 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              marginTop: 10,
              padding: "13px 16px",
              borderRadius: 14,
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.soft,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {t("Завершить заявку", "Close ticket")}
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: "bolt" | "clock" | "globe" }) {
  const Icon = () => {
    if (icon === "bolt") return <svg width="14" height="14" viewBox="0 0 24 24" fill="#39ff63"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
    if (icon === "clock") return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#39ff63" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    if (icon === "globe") return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#39ff63" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    return null;
  };
  return (
    <motion.div
      whileHover={{ y: -2 }}
      style={{
        flex: 1,
        padding: "12px 8px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        textAlign: "center",
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>
        <Icon />
        {value}
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
    </motion.div>
  );
}

function LiveChatLogo({ size = 56, active = true }: { size?: number; active?: boolean }) {
  const ring = active ? "#39ff63" : "rgba(255,255,255,0.18)";
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {/* Outer pulsing ring */}
      {active && (
        <>
          <motion.span
            aria-hidden
            animate={{ scale: [1, 1.45, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `2px solid ${ring}`,
              pointerEvents: "none",
            }}
          />
          <motion.span
            aria-hidden
            animate={{ scale: [1, 1.7, 1], opacity: [0.35, 0, 0.35] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
            style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `1px solid ${ring}`,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Rotating conic accent */}
      <motion.div
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: active
            ? "conic-gradient(from 0deg, rgba(57,255,99,0.55), rgba(57,255,99,0) 35%, rgba(57,255,99,0) 65%, rgba(57,255,99,0.4) 100%)"
            : "conic-gradient(from 0deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 60%)",
          filter: "blur(0.5px)",
        }}
      />

      {/* Inner disc */}
      <div
        style={{
          position: "absolute",
          inset: 2,
          borderRadius: "50%",
          background: "radial-gradient(120% 90% at 30% 20%, #1d1f24 0%, #0c0d10 75%)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          boxShadow: active
            ? "inset 0 0 18px rgba(57,255,99,0.18), 0 6px 20px -8px rgba(57,255,99,0.45)"
            : "inset 0 0 12px rgba(0,0,0,0.6)",
        }}
      >
        {/* Two stacked chat bubbles forming an infinity-like dialog */}
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 40 40" fill="none">
          <defs>
            <linearGradient id="lc-a" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a8ffba" />
              <stop offset="100%" stopColor="#39ff63" />
            </linearGradient>
            <linearGradient id="lc-b" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7cd1ff" />
              <stop offset="100%" stopColor="#3aa6ff" />
            </linearGradient>
          </defs>
          {/* Left/upper bubble */}
          <motion.path
            d="M4 9c0-2.2 1.8-4 4-4h13c2.2 0 4 1.8 4 4v6c0 2.2-1.8 4-4 4h-9l-5 4v-4c-1.7-.3-3-1.8-3-3.6V9z"
            fill="url(#lc-a)"
            animate={active ? { y: [0, -1.2, 0] } : {}}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Right/lower bubble */}
          <motion.path
            d="M36 23c0-2.2-1.8-4-4-4H19c-2.2 0-4 1.8-4 4v6c0 2.2 1.8 4 4 4h9l5 4v-4c1.7-.3 3-1.8 3-3.6v-6.4z"
            fill="url(#lc-b)"
            animate={active ? { y: [0, 1.2, 0] } : {}}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          />
          {/* Typing dots in the lower bubble */}
          {active && (
            <g>
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={21 + i * 4}
                  cy={28}
                  r={1.4}
                  fill="#0b0c0f"
                  animate={{ opacity: [0.3, 1, 0.3], cy: [28, 26.5, 28] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                />
              ))}
            </g>
          )}
        </svg>
      </div>

      {/* Online dot */}
      <span
        style={{
          position: "absolute",
          right: 1,
          bottom: 1,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: active ? "#39ff63" : "#ffb020",
          border: "2px solid #0d0e11",
          boxShadow: active ? "0 0 8px #39ff63" : "none",
        }}
      />
    </div>
  );
}
