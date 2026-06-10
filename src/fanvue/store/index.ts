import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CONFIG } from '../config'
import { api } from './api'
import { isPendingCryptoInvoice } from '../utils/pendingOrder'
import {
  verifyAdminHash,
  sanitizeText,
  rateLimit,
  isValidAmount,
  createFinancialNonce,
  audit,
  hasTelegramContext,
  waitForTelegramContext,
} from '../utils/security'
import type {
  Lang, User, Category, Product, Order, SupportMessage, CartItem, CryptoOption,
  CryptoNetwork, PaymentLog, Broadcast, PaymentNotification, RefReward, RefWithdrawal,
  SupportTicket, SupportTicketCategory, AdminPresence, OrderReceiptPayload,
  Referral, RealSale, SiteContent, SiteLinks,
} from './types'
import { defaultSiteLinks, mergeStoreConfigPatch, type PublicStoreConfig } from './storeConfigSync'
import { applySupportSessionPayload, resolveActiveTicket } from './supportSync'

export const CRYPTO_OPTIONS: CryptoOption[] = [
  { id: 'trc20',    name: 'USDT TRC20',  symbol: 'USDT', color: '#26A17B', icon: '₮', address: CONFIG.addresses.trc20 },
  { id: 'erc20',    name: 'USDT ERC20',  symbol: 'USDT', color: '#627EEA', icon: '₮', address: CONFIG.addresses.erc20 },
  { id: 'bep20',    name: 'USDT BEP20',  symbol: 'USDT', color: '#F0B90B', icon: '₮', address: CONFIG.addresses.bep20 },
  { id: 'usdc_eth', name: 'USDC ERC20',  symbol: 'USDC', color: '#2775CA', icon: '$', address: CONFIG.addresses.usdc_eth },
  { id: 'usdc_sol', name: 'USDC SPL',    symbol: 'USDC', color: '#9945FF', icon: '$', address: CONFIG.addresses.usdc_sol },
  { id: 'eth',      name: 'Ethereum',    symbol: 'ETH',  color: '#627EEA', icon: 'Ξ', address: CONFIG.addresses.eth },
  { id: 'ton',      name: 'Toncoin',     symbol: 'TON',  color: '#0098EA', icon: '💎', address: CONFIG.addresses.ton },
  { id: 'sol',      name: 'Solana',      symbol: 'SOL',  color: '#9945FF', icon: '◎', address: CONFIG.addresses.sol },
  { id: 'btc',      name: 'Bitcoin',     symbol: 'BTC',  color: '#F7931A', icon: '₿', address: CONFIG.addresses.btc },
]

const MOCK_USER: User = {
  uid: 0,
  username: '',
  full_name: '',
  lang: 'ru',
  balance: 0,
  spent: 0,
  purchases: 0,
  ref_earned: 0,
  ref_count: 0,
  ref_balance: 0,
  created: new Date().toISOString().slice(0, 10),
}

const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'Аккаунты', name_en: 'Accounts', emoji: '👑', active: true },
  { id: 2, name: 'Верификация', name_en: 'Verification', emoji: '✅', active: true },
]

const MOCK_PRODUCTS: Product[] = [
  {
    id: 1, cat_id: 1,
    title: 'Готовый верифицированный аккаунт',
    title_en: 'Ready verified account',
    description: 'Полностью готовый аккаунт Fanvue с пройденной верификацией. Чистая история, подтверждён 18+, разблокированы все способы монетизации (Subscriptions, PPV, Tips). Передача — логин, пароль, почта, пароль от почты, инструкция. Средняя выдача 5–15 минут после оплаты. Никаких ожиданий, никаких рисков отказа.',
    desc_en: 'A fully ready Fanvue account with verification already passed. Clean history, age-confirmed (18+), all monetisation features unlocked (Subscriptions, PPV, Tips). Hand-off is e-mail & password change under your control, average delivery 5–15 minutes after payment. No waiting, no rejection risk.',
    price: 35.00, delivery: 'auto', stock: 14, active: true,
  },
  {
    id: 2, cat_id: 2,
    title: 'Верификация вашего аккаунта',
    title_en: 'Verify your account',
    description: 'Проводим верификацию уже существующего аккаунта Fanvue. Подбираем чистые документы, проходим face-match, разблокируем монетизацию. Гарантия результата — если верификация не прошла, возвращаем 100% оплаты. Среднее время выполнения — 2–6 часов.',
    desc_en: 'We verify your existing Fanvue account. We supply clean documents, pass the face-match and unlock monetisation. Result guaranteed — full refund if verification fails. Average turnaround 2–6 hours.',
    price: 50.00, delivery: 'manual', stock: 99, active: true,
  },
]

const MOCK_ORDERS: Order[] = []

// Empty by default — bot triage greeting will be shown
const MOCK_SUPPORT: SupportMessage[] = []

/** Server wins on conflict; never resurrect expired-by-time local pending. */
function mergeServerOrders(local: Order[], server: Order[]): Order[] {
  const localById = new Map(local.map((o) => [o.id, o]))
  const byId = new Map<string, Order>()
  for (const o of server) {
    const loc = localById.get(o.id)
    byId.set(
      o.id,
      loc
        ? {
            ...o,
            product_id: o.product_id ?? loc.product_id,
            product_title: o.product_title || loc.product_title,
            quantity: o.quantity ?? loc.quantity,
          }
        : o,
    )
  }
  const now = Date.now()
  for (const o of local) {
    if (byId.has(o.id)) continue
    if (!isPendingCryptoInvoice(o)) continue
    const age = now - new Date(o.created).getTime()
    if (age > 3 * 3600_000) continue
    byId.set(o.id, o)
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
  )
}

function syncNotificationsWithOrders(
  notifications: PaymentNotification[],
  orders: Order[],
): PaymentNotification[] {
  const terminal = new Set<Order['status']>(['completed', 'failed', 'expired'])
  let next = notifications.filter((n) => {
    const o = orders.find((x) => x.id === n.orderId)
    return !o || !terminal.has(o.status)
  })
  for (const o of orders) {
    if (!isPendingCryptoInvoice(o)) continue
    if (next.some((n) => n.orderId === o.id)) continue
    const network = (o.provider || 'trc20') as CryptoNetwork
    next = [{
      orderId: o.id,
      kind: o.kind,
      amountUsd: o.amount,
      uniqueAmount: o.amount,
      network,
      read: false,
      createdAt: o.created,
    }, ...next]
  }
  return next.slice(0, 30)
}

import { mapServerOrder as mapServerOrderRow } from '../../../shared/orderMap'

function mapServerOrder(o: Record<string, unknown>): Order {
  return mapServerOrderRow(o) as Order
}

export type { SiteContent, SiteLinks } from './types'

interface AppStore {
  lang: Lang
  langUserSet: boolean
  user: User | null
  categories: Category[]
  products: Product[]
  orders: Order[]
  supportMessages: SupportMessage[]
  supportTickets: SupportTicket[]
  adminPresence: AdminPresence
  userTyping: boolean
  adminTyping: boolean
  cart: CartItem | null
  isLoading: boolean
  referrals: Referral[]
  realSales: RealSale[]
  _adminVerified: boolean
  _adminCheckDone: boolean

  // Admin-editable state
  cryptoAddresses: Record<CryptoNetwork, string>
  maintenance: boolean
  /** True after first /api/config/app fetch (do not use localStorage for maintenance). */
  storeConfigLoaded: boolean
  logs: PaymentLog[]
  broadcasts: Broadcast[]
  qrOverrides: Partial<Record<CryptoNetwork, string>>
  photos: Record<string, string>
  siteContent: SiteContent
  siteLinks: SiteLinks

  notifications: PaymentNotification[]
  refReward: RefReward
  refWithdrawals: RefWithdrawal[]
  refWithdrawNetworks: CryptoNetwork[]
  refDailyLog: Record<string, number>
  supportForwardedOrders: string[]
  pinnedProductIds: number[]
  supportUnread: number
  stickHeroScores: { name: string; score: number; ts: number }[]
  stickHeroName: string | null
  /** Admin panel: uid → display name (from server). */
  adminUserByUid: Record<number, { username: string; full_name: string }>
  _serverPullInFlight: boolean

  // User actions
  setLang: (lang: Lang) => void
  initUser: () => void
  bootstrapSession: () => Promise<void>
  /** Re-fetch balance, orders, admin data (safe on every mini-app reopen). */
  pullServerSession: () => Promise<void>
  /** Referrals, calendar, home sales feed — always from server when API on. */
  syncReferralsFromServer: () => Promise<boolean>
  setCart: (cart: CartItem | null) => void
  addOrder: (order: Order) => void
  addSupportMessage: (msg: SupportMessage) => void
  updateSupportMessage: (id: number, updates: Partial<SupportMessage>) => void
  deleteSupportMessage: (id: number, mode: 'user' | 'all') => void
  sendOrderReceipt: (payload: OrderReceiptPayload) => boolean
  setOrderReceiptStage: (orderId: string, stage: OrderReceiptPayload['stage']) => void
  markUserMessagesReadByAdmin: () => void
  markAdminMessagesReadByUser: () => void
  setUserTyping: (v: boolean) => void
  setAdminTyping: (v: boolean) => void
  setAdminPresence: (p: Partial<AdminPresence>) => void
  openSupportTicket: (category: SupportTicketCategory, summary?: string) => SupportTicket
  closeSupportTicket: (id: string, reason?: string) => Promise<boolean>
  resetSupportSession: () => void
  clearSupportUnread: () => void
  updateBalance: (delta: number) => void
  addNotification: (n: Omit<PaymentNotification, 'read' | 'createdAt'>) => void
  markNotificationsRead: () => void
  removeNotification: (orderId: string) => void
  creditDeposit: (orderId: string, amount: number, txid?: string) => void
  refreshUser: () => Promise<void>
  creditRefBalance: (amount: number) => void
  spendRefBalance: (amount: number) => void
  addRefWithdrawal: (w: Omit<RefWithdrawal, 'id' | 'createdAt'>) => void
  updateRefWithdrawal: (id: string, updates: Partial<RefWithdrawal>) => void
  completeRefWithdrawal: (id: string, txid: string) => void
  checkAndResetMonthlyReward: () => void
  logDailyRef: (date: string, count?: number) => void
  cancelPendingDeposits: () => Promise<void>
  cancelPendingBuyOrders: () => Promise<void>
  /** Отменить все pending счета: пополнение + покупка криптой (один активный). */
  cancelAllPendingCrypto: () => Promise<void>
  /** Пометить просроченные счета expired + подтянуть список с сервера. */
  reconcilePendingOrders: () => Promise<void>

  // Admin actions
  setCryptoAddress: (network: CryptoNetwork, address: string) => void
  setSiteLink: (key: keyof SiteLinks, value: string) => void
  setQrOverride: (network: CryptoNetwork, dataUri: string | null) => void
  setPhoto: (key: string, dataUri: string | null) => void
  toggleMaintenance: () => Promise<boolean>
  setOrderStatus: (id: string, status: Order['status']) => void
  setOrderDelivery: (id: string, deliveryData: string) => void
  /** Если у заказа есть product_id и товар на автовыдаче — забирает первую
   *  запись из autoItems пула, привязывает к заказу и помечает completed.
   *  Возвращает true, если автовыдача прошла. */
  tryAutoFulfill: (orderId: string) => boolean
  resolvePostDelivery: (orderId: string, choice: 'close' | 'continue') => void
  deleteOrder: (id: string) => void
  upsertProduct: (p: Product) => void
  deleteProduct: (id: number) => void
  upsertCategory: (c: Category) => void
  deleteCategory: (id: number) => void
  addLog: (log: Omit<PaymentLog, 'id'>) => void
  addBroadcast: (text: string, sent_to: number, keyboard?: import('../../../shared/broadcastKeyboard').BroadcastKeyboardInput) => void
  setSiteContent: (key: keyof SiteContent, value: string) => void
  markOrderForwarded: (orderId: string) => void
  pinProduct: (id: number) => void
  unpinProduct: (id: number) => void
  setRefWithdrawNetworks: (networks: CryptoNetwork[]) => void
  isAdmin: () => boolean
  isAdminCheckDone: () => boolean
  createFinancialNonce: () => string
  addReferral: (ref: Referral) => void
  updateReferral: (uid: number, updates: Partial<Referral>) => void
  getActiveReferrals: () => Referral[]
  addRealSale: (sale: RealSale) => void
  addStickHeroScore: (score: number) => void
  setStickHeroName: (name: string) => void
  syncAdminData: () => Promise<void>
  syncStoreConfig: () => Promise<void>
  persistAdminSettings: (body: Record<string, unknown>) => Promise<boolean>
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      lang: 'ru',
      langUserSet: false,
      user: MOCK_USER,
      categories: MOCK_CATEGORIES,
      products: MOCK_PRODUCTS,
      orders: MOCK_ORDERS,
      supportMessages: MOCK_SUPPORT,
      supportTickets: [],
      adminPresence: { online: false, lastSeen: new Date().toISOString() },
      userTyping: false,
      adminTyping: false,
      cart: null,
      isLoading: false,
      referrals: [],
      realSales: [],
      _adminVerified: false,
      _adminCheckDone: false,
      adminUserByUid: {},
      _serverPullInFlight: false,

      cryptoAddresses: { ...CONFIG.addresses },
      maintenance: false,
      storeConfigLoaded: false,
      logs: [],
      broadcasts: [],
      qrOverrides: Object.fromEntries(
        Object.entries(CONFIG.qrCodes).filter(([, v]) => !!v),
      ),
      photos: {},
      notifications: [],
      refReward: { month: '', count: 0, claimed: false },
      refWithdrawals: [],
      refWithdrawNetworks: ['trc20', 'btc'] as CryptoNetwork[],
      refDailyLog: {},
      supportForwardedOrders: [],
      pinnedProductIds: [],
      supportUnread: 0,
      siteContent: {
        offer_ru: '', offer_en: '',
        rules_ru: '', rules_en: '',
        contacts_ru: '', contacts_en: '',
        referral_rules_ru: '', referral_rules_en: '',
      },
      siteLinks: defaultSiteLinks(),

      setLang: (lang) => {
        set({ lang, langUserSet: true })
        if (api.isEnabled()) api.setUserLang(lang)
      },

      initUser: () => {
        const cur = get().stickHeroScores
        if (Array.isArray(cur) && cur.length > 0) {
          const best = new Map<string, { name: string; score: number; ts: number }>()
          for (const r of cur) {
            if (!r || typeof r.name !== 'string') continue
            const nm = r.name.trim(); if (!nm) continue
            const sc = Math.max(0, Math.min(99999, Math.floor(Number(r.score) || 0)))
            const k = nm.toLowerCase()
            const prev = best.get(k)
            if (!prev || prev.score < sc) best.set(k, { name: nm, score: sc, ts: Number(r.ts) || Date.now() })
          }
          const deduped = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 100)
          if (deduped.length !== cur.length) set({ stickHeroScores: deduped })
        }
      },

      pullServerSession: async () => {
        if (!api.isEnabled() || get()._serverPullInFlight) return
        set({ _serverPullInFlight: true })
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

        try {
          await waitForTelegramContext(5000)
          if (!hasTelegramContext()) return

          await get().syncStoreConfig()

          const tgStart =
            (window as Window & { Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } } })
              .Telegram?.WebApp?.initDataUnsafe?.start_param ?? ''

          let serverUser: Record<string, unknown> | null = null
          for (let attempt = 0; attempt < 8; attempt++) {
            if (attempt > 0) await sleep(300)
            const res = await api.auth({ start_param: tgStart })
            if (res && typeof res === 'object') {
              serverUser = res as Record<string, unknown>
              break
            }
          }

          if (serverUser) {
            const u = serverUser
            const uid = Number(u.uid)
            if (!get().langUserSet && (u.preferred_lang === 'ru' || u.preferred_lang === 'en')) {
              set({ lang: u.preferred_lang as Lang })
            }
            if (u.isAdmin === true) {
              set({ _adminVerified: true, _adminCheckDone: true })
            }
            if (typeof u.maintenance === 'boolean') {
              set({ maintenance: u.maintenance as boolean })
            }
            set((s) => ({
              user: {
                ...(s.user && s.user.uid === uid ? s.user : { ...MOCK_USER, uid }),
                uid,
                username: String(u.username ?? s.user?.username ?? ''),
                full_name: String(
                  [u.first_name, u.last_name].filter(Boolean).join(' ') || s.user?.full_name || '',
                ),
                photo_url: (u.photo_url as string | undefined) ?? s.user?.photo_url,
                balance: Number(u.balance ?? 0),
                spent: Number(u.spent ?? 0),
                purchases: Number(u.purchases ?? 0),
                ref_earned: Number(u.ref_earned ?? 0),
                ref_count: Number(u.ref_count ?? 0),
                ref_balance: Number(u.ref_balance ?? 0),
              },
            }))
          }

          const ordersRes = await api.getMyOrders()
          if (ordersRes && typeof ordersRes === 'object' && Array.isArray((ordersRes as { orders?: unknown }).orders)) {
            const mapped = ((ordersRes as { orders: Record<string, unknown>[] }).orders).map(mapServerOrder)
            const merged = mergeServerOrders(get().orders, mapped)
            set({
              orders: merged,
              notifications: syncNotificationsWithOrders(get().notifications, merged),
            })
          }

          if (!get()._adminVerified) {
            const msgRes = await api.getMessages()
            const supportSession = applySupportSessionPayload(
              msgRes as { messages?: unknown[]; tickets?: unknown[] } | null,
            )
            if (supportSession) {
              set({
                supportMessages: supportSession.messages,
                supportTickets: supportSession.tickets,
              })
            }
          }

          const catalog = await api.getProducts()
          if (catalog && typeof catalog === 'object') {
            const update: Partial<AppStore> = {}
            if (Array.isArray((catalog as { products?: Product[] }).products) && (catalog as { products: Product[] }).products.length > 0) {
              update.products = (catalog as { products: Product[] }).products
            }
            if (Array.isArray((catalog as { categories?: Category[] }).categories) && (catalog as { categories: Category[] }).categories.length > 0) {
              update.categories = (catalog as { categories: Category[] }).categories
            }
            if (Array.isArray((catalog as { pinned?: number[] }).pinned)) {
              update.pinnedProductIds = (catalog as { pinned: number[] }).pinned
            }
            if (Object.keys(update).length > 0) set(update)
          }

          const refWRes = await api.refWithdrawals()
          if (Array.isArray(refWRes)) {
            set({
              refWithdrawals: refWRes as AppStore['refWithdrawals'],
            })
          }

          await get().syncReferralsFromServer()

          if (get()._adminVerified) {
            await get().syncAdminData()
          }
        } finally {
          set({ _serverPullInFlight: false })
        }
      },

      syncReferralsFromServer: async () => {
        if (!api.isEnabled()) return false
        const refBundle = await api.getReferrals()
        if (!refBundle || typeof refBundle !== 'object') return false
        set({
          referrals: Array.isArray(refBundle.referrals) ? refBundle.referrals : [],
          refDailyLog:
            refBundle.refDailyLog && typeof refBundle.refDailyLog === 'object'
              ? refBundle.refDailyLog
              : {},
          refReward:
            refBundle.refReward && typeof refBundle.refReward === 'object'
              ? {
                  month: String(refBundle.refReward.month ?? ''),
                  count: Number(refBundle.refReward.count ?? 0),
                  claimed: !!refBundle.refReward.claimed,
                }
              : get().refReward,
          realSales: Array.isArray(refBundle.recentSales) ? refBundle.recentSales : [],
        })
        return true
      },

      bootstrapSession: async () => {
        set({ isLoading: true })

        type TGUser = {
          id?: number
          username?: string
          first_name?: string
          last_name?: string
          language_code?: string
          photo_url?: string
        }
        const tg = (window as Window & { Telegram?: { WebApp?: { initDataUnsafe?: { user?: TGUser; start_param?: string } } } }).Telegram?.WebApp
        const tgUser = tg?.initDataUnsafe?.user
        const startParam = tg?.initDataUnsafe?.start_param ?? ''
        const state = get()

        try {
          if (tgUser?.id) {
            const uid = tgUser.id
            const detectedLang: Lang = tgUser.language_code?.startsWith('ru') ? 'ru' : 'en'
            const initialLang: Lang = state.langUserSet
              ? state.lang
              : (startParam === 'en' || startParam === 'lang_en' ? 'en'
                : startParam === 'ru' || startParam === 'lang_ru' ? 'ru'
                : detectedLang)

            const prev = get().user
            set({
              lang: initialLang,
              langUserSet: state.langUserSet,
              user: {
                ...(prev && prev.uid === uid ? prev : { ...MOCK_USER, uid }),
                uid,
                username: tgUser.username ?? prev?.username ?? '',
                full_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || prev?.full_name || '',
                photo_url: tgUser.photo_url ?? prev?.photo_url,
              },
            })

            verifyAdminHash(uid, CONFIG.adminHashes).then((ok) => {
              set({ _adminVerified: ok, _adminCheckDone: true })
            }).catch(() => set({ _adminCheckDone: true }))
          } else {
            set({ _adminCheckDone: true })
          }

          if (api.isEnabled()) {
            await get().pullServerSession()
          }
        } catch {
          /* ignore */
        } finally {
          set({
            isLoading: false,
            storeConfigLoaded: true,
            _adminCheckDone: true,
          })
        }
      },

      setCart: (cart) => set({ cart }),

      addOrder: (order) => {
        if (!isValidAmount(order.amount, 0.001, 100_000)) return
        if (!rateLimit('addOrder', 5, 60_000)) {
          audit('rate_limited', get().user?.uid, { action: 'addOrder' })
          return
        }
        audit('order_created', get().user?.uid, { orderId: order.id, kind: order.kind, amount: order.amount })
        set((s) => ({ orders: [order, ...s.orders] }))
      },

      addSupportMessage: (msg) => {
        const sanitized: SupportMessage = {
          ...msg,
          text: sanitizeText(msg.text),
        }
        set((s) => ({
          supportMessages: [...s.supportMessages, sanitized],
          supportUnread: sanitized.sender === 'admin' ? s.supportUnread + 1 : s.supportUnread,
        }))
        if (api.isEnabled() && sanitized.sender === 'user') {
          api.sendMessage(sanitized.text)
        }
      },

      clearSupportUnread: () => set({ supportUnread: 0 }),

      updateSupportMessage: (id, updates) =>
        set((s) => ({
          supportMessages: s.supportMessages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),

      deleteSupportMessage: (id, mode) =>
        set((s) => ({
          supportMessages:
            mode === 'all'
              ? s.supportMessages.filter((m) => m.id !== id)
              : s.supportMessages.map((m) => (m.id === id ? { ...m, deleted_for: 'user' } : m)),
        })),

      sendOrderReceipt: (payload) => {
        const s = get()
        const exists = s.supportMessages.some(
          (m) => m.kind === 'order_receipt' && m.order_receipt?.orderId === payload.orderId,
        )
        if (exists) return false
        const msg: SupportMessage = {
          id: Date.now(),
          sender: 'bot',
          kind: 'order_receipt',
          text: `order_receipt:${payload.orderId}`,
          created: new Date().toISOString(),
          order_receipt: payload,
        }
        set((st) => ({
          supportMessages: [...st.supportMessages, msg],
          supportUnread: st.supportUnread + 1,
        }))
        return true
      },

      setOrderReceiptStage: (orderId, stage) =>
        set((s) => ({
          supportMessages: s.supportMessages.map((m) =>
            m.kind === 'order_receipt' && m.order_receipt?.orderId === orderId
              ? {
                  ...m,
                  order_receipt: {
                    ...m.order_receipt,
                    stage,
                    deliveredAt: stage === 'delivered' ? new Date().toISOString() : m.order_receipt.deliveredAt,
                  },
                }
              : m,
          ),
        })),


      markUserMessagesReadByAdmin: () =>
        set((s) => ({
          supportMessages: s.supportMessages.map((m) =>
            m.sender === 'user' && !m.read_by_admin ? { ...m, read_by_admin: true } : m,
          ),
        })),

      markAdminMessagesReadByUser: () =>
        set((s) => ({
          supportMessages: s.supportMessages.map((m) =>
            (m.sender === 'admin' || m.sender === 'bot') && !m.read_by_user ? { ...m, read_by_user: true } : m,
          ),
          supportUnread: 0,
        })),

      setUserTyping: (v) => set({ userTyping: v }),
      setAdminTyping: (v) => set({ adminTyping: v }),
      setAdminPresence: (p) => set((s) => ({ adminPresence: { ...s.adminPresence, ...p } })),

      openSupportTicket: (category, summary) => {
        const existing = resolveActiveTicket(get().supportTickets, get().supportMessages)
        if (existing) return existing

        const id = 'FV-' + Math.floor(1000 + Math.random() * 9000)
        const uid = get().user?.uid
        const ticket: SupportTicket = {
          id, uid, category, status: 'open',
          opened: new Date().toISOString(),
          summary,
        }
        set((s) => ({
          supportTickets: [ticket, ...s.supportTickets.filter((t) => t.id !== id)],
          supportMessages: [
            ...s.supportMessages,
            {
              id: Date.now(),
              sender: 'bot',
              kind: 'system',
              text: `ticket_opened:${id}`,
              created: new Date().toISOString(),
              ticket_id: id,
            },
          ],
        }))
        if (api.isEnabled()) {
          void api.openSupportTicket({ id, category, summary })
        }
        return ticket
      },

      closeSupportTicket: async (id, reason) => {
        if (api.isEnabled()) {
          const res = get()._adminVerified
            ? await api.adminCloseTicket(id, reason)
            : await api.closeSupportTicket(id, reason)
          if (!res?.ok) return false
        }
        const closedAt = new Date().toISOString()
        const reasonTag = reason ? `:${reason}` : ''
        set((s) => ({
          supportTickets: s.supportTickets.map((t) =>
            t.id === id ? { ...t, status: 'closed', closed: closedAt } : t,
          ),
          supportMessages: [
            ...s.supportMessages,
            {
              id: Date.now(),
              sender: 'bot',
              kind: 'system',
              text: `ticket_closed:${id}${reasonTag}`,
              created: closedAt,
              ticket_id: id,
            },
          ],
        }))
        return true
      },

      resetSupportSession: () =>
        set((s) => ({
          supportTickets: s.supportTickets.map((t) =>
            t.status !== 'closed' ? { ...t, status: 'closed', closed: new Date().toISOString() } : t,
          ),
        })),

      updateBalance: (delta) => {
        if (!isValidAmount(Math.abs(delta), 0.001, 100_000)) return
        if (api.isEnabled()) {
          void get().refreshUser()
          return
        }
        if (!rateLimit('updateBalance', 10, 60_000)) {
          audit('rate_limited', get().user?.uid, { action: 'updateBalance', delta })
          return
        }
        audit('balance_change', get().user?.uid, { delta, before: get().user?.balance })
        set((s) => ({
          user: s.user ? { ...s.user, balance: Math.max(0, s.user.balance + delta) } : null,
        }))
      },

      addNotification: (n) =>
        set((s) => ({
          notifications: [
            { ...n, read: false, createdAt: new Date().toISOString() },
            ...s.notifications.filter((x) => x.orderId !== n.orderId),
          ].slice(0, 30),
        })),

      markNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      removeNotification: (orderId) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.orderId !== orderId) })),

      creditDeposit: (orderId, amount, txid?) => {
        if (!isValidAmount(amount, 0.01, 100_000)) return
        if (!rateLimit('creditDeposit', 5, 60_000)) {
          audit('rate_limited', get().user?.uid, { action: 'creditDeposit', orderId })
          return
        }
        const state = get()
        const order = state.orders.find((o) => o.id === orderId)
        if (!order || order.kind !== 'deposit' || order.paid_at) return
        if (Math.abs(order.amount - amount) > 0.1) {
          audit('amount_mismatch', state.user?.uid, { orderId, expected: order.amount, got: amount })
          return
        }
        audit('deposit_credited', state.user?.uid, { orderId, amount })
        // When backend is enabled, the server is the source of truth for balance —
        // it credits in matcher.ts on deposit completion. Don't add locally or we
        // double-count (local +X now, then server overwrites with +X next session).
        const serverAuthoritative = api.isEnabled()
        set((s) => ({
          user: s.user && !serverAuthoritative
            ? { ...s.user, balance: Math.max(0, s.user.balance + amount) }
            : s.user,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: 'completed' as const, paid_at: new Date().toISOString(), ...(txid ? { txid } : {}) }
              : o
          ),
        }))
        // Pull fresh balance + orders from server so UI updates immediately.
        if (serverAuthoritative) get().refreshUser()
      },

      refreshUser: async () => {
        await get().pullServerSession()
      },

      creditRefBalance: (amount) => {
        if (!isValidAmount(amount, 0.01, 10_000)) return
        audit('ref_credit', get().user?.uid, { amount })
        if (api.isEnabled()) return
        set((s) => ({
          user: s.user ? { ...s.user, ref_balance: (s.user.ref_balance) + amount } : null,
        }))
      },

      spendRefBalance: (amount) => {
        if (!isValidAmount(amount, 0.01, 10_000)) return
        if (api.isEnabled()) return
        const balance = get().user?.ref_balance ?? 0
        if (amount > balance + 0.001) {
          audit('ref_spend_insufficient', get().user?.uid, { amount, balance })
          return
        }
        if (!rateLimit('spendRefBalance', 3, 60_000)) {
          audit('rate_limited', get().user?.uid, { action: 'spendRefBalance' })
          return
        }
        audit('ref_spend', get().user?.uid, { amount })
        set((s) => ({
          user: s.user ? { ...s.user, ref_balance: Math.max(0, s.user.ref_balance - amount) } : null,
        }))
      },

      addRefWithdrawal: (w) =>
        set((s) => ({
          refWithdrawals: [
            { ...w, id: (w as { id?: string }).id ?? `RW-${Date.now()}`, createdAt: new Date().toISOString() },
            ...s.refWithdrawals,
          ],
        })),

      updateRefWithdrawal: (id, updates) =>
        set((s) => ({
          refWithdrawals: s.refWithdrawals.map((w) => w.id === id ? { ...w, ...updates } : w),
        })),

      completeRefWithdrawal: (id, txid) =>
        set((s) => ({
          refWithdrawals: s.refWithdrawals.map((w) =>
            w.id === id ? { ...w, status: 'completed' as const, txid, completedAt: new Date().toISOString() } : w
          ),
        })),

      logDailyRef: (date, count = 1) => {
        if (api.isEnabled() && get().user?.uid) {
          void api.refReward({ kind: 'daily', date, count }).then((res) => {
            if (!res || typeof res !== 'object') return
            const r = res as { ref_balance?: number; ref_earned?: number; ref_count?: number }
            set((s) => ({
              refDailyLog: { ...s.refDailyLog, [date]: (s.refDailyLog[date] ?? 0) + count },
              refReward: { ...s.refReward, count: s.refReward.count + count },
              user: s.user
                ? {
                    ...s.user,
                    ref_balance: Number(r.ref_balance ?? s.user.ref_balance),
                    ref_earned: Number(r.ref_earned ?? s.user.ref_earned),
                    ref_count: Number(r.ref_count ?? s.user.ref_count),
                  }
                : null,
            }))
          })
          return
        }
        set((s) => ({
          refDailyLog: { ...s.refDailyLog, [date]: (s.refDailyLog[date] ?? 0) + count },
          refReward: { ...s.refReward, count: s.refReward.count + count },
          user: s.user ? {
            ...s.user,
            ref_balance: s.user.ref_balance + 5 * count,
            ref_earned: s.user.ref_earned + 5 * count,
            ref_count: s.user.ref_count + count,
          } : null,
        }))
      },

      checkAndResetMonthlyReward: () => {
        const s = get()
        const currentMonth = new Date().toISOString().slice(0, 7)
        const { refReward } = s
        if (!refReward.month || refReward.month < currentMonth) {
          set({ refReward: { month: currentMonth, count: 0, claimed: false } })
          return
        }
        if (refReward.count < 10 || refReward.claimed) return
        if (api.isEnabled()) {
          void api.refReward({ kind: 'monthly_bonus' }).then((res) => {
            if (!res || typeof res !== 'object') return
            const r = res as { ref_balance?: number; ref_earned?: number }
            set((st) => ({
              refReward: { ...st.refReward, claimed: true },
              user: st.user
                ? {
                    ...st.user,
                    ref_balance: Number(r.ref_balance ?? st.user.ref_balance),
                    ref_earned: Number(r.ref_earned ?? st.user.ref_earned),
                  }
                : null,
            }))
          })
          return
        }
        set({
          refReward: { ...refReward, claimed: true },
          user: s.user ? {
            ...s.user,
            ref_balance: s.user.ref_balance + 100,
            ref_earned: s.user.ref_earned + 100,
          } : null,
        })
      },

      cancelPendingDeposits: async () => {
        const pending = get().orders.filter(
          (o) => o.kind === 'deposit' && o.status === 'pending',
        )
        if (api.isEnabled()) {
          await Promise.all(pending.map((o) => api.cancelOrder(o.id)))
        }
        set((s) => ({
          orders: s.orders.map((o) =>
            o.kind === 'deposit' && o.status === 'pending'
              ? { ...o, status: 'expired' as const }
              : o
          ),
          notifications: s.notifications.filter(
            (n) => !pending.some((o) => o.id === n.orderId),
          ),
        }))
      },

      cancelPendingBuyOrders: async () => {
        const pending = get().orders.filter(
          (o) =>
            o.kind === 'buy' &&
            o.status === 'pending' &&
            o.provider &&
            o.provider !== 'balance',
        )
        if (api.isEnabled()) {
          await Promise.all(pending.map((o) => api.cancelOrder(o.id)))
        }
        set((s) => ({
          orders: s.orders.map((o) =>
            o.kind === 'buy' &&
            o.status === 'pending' &&
            o.provider &&
            o.provider !== 'balance'
              ? { ...o, status: 'expired' as const }
              : o
          ),
          notifications: s.notifications.filter(
            (n) => !pending.some((o) => o.id === n.orderId),
          ),
        }))
      },

      cancelAllPendingCrypto: async () => {
        const pending = get().orders.filter(isPendingCryptoInvoice)
        if (api.isEnabled()) {
          await Promise.all(
            pending.map(async (o) => {
              try {
                await api.cancelOrder(o.id)
              } catch {
                /* idempotent on server */
              }
            }),
          )
        }
        const ids = new Set(pending.map((o) => o.id))
        set((s) => {
          const orders = s.orders.map((o) =>
            ids.has(o.id) ? { ...o, status: 'expired' as const } : o,
          )
          return {
            orders,
            notifications: syncNotificationsWithOrders(s.notifications, orders),
          }
        })
      },

      reconcilePendingOrders: async () => {
        if (!api.isEnabled()) return
        try {
          const ordersRes = await api.getMyOrders()
          if (
            ordersRes &&
            typeof ordersRes === 'object' &&
            Array.isArray((ordersRes as { orders?: unknown }).orders)
          ) {
            const mapped = ((ordersRes as { orders: Record<string, unknown>[] }).orders).map(
              mapServerOrder,
            )
            const merged = mergeServerOrders(get().orders, mapped)
            set({
              orders: merged,
              notifications: syncNotificationsWithOrders(get().notifications, merged),
            })
          }
        } catch {
          /* keep local orders */
        }
      },

      syncStoreConfig: async () => {
        if (!api.isEnabled()) {
          set({ storeConfigLoaded: true })
          return
        }
        try {
          const cfg = await api.getAppConfig()
          const patch = mergeStoreConfigPatch(
            {
              cryptoAddresses: get().cryptoAddresses,
              siteLinks: get().siteLinks,
              siteContent: get().siteContent,
              photos: get().photos,
              qrOverrides: get().qrOverrides,
              refWithdrawNetworks: get().refWithdrawNetworks,
              maintenance: false,
            },
            cfg,
          )
          if (Object.keys(patch).length > 0) set(patch)
        } catch { /* ignore */ }
        finally {
          set({ storeConfigLoaded: true })
        }
      },

      persistAdminSettings: async (body) => {
        if (!api.isEnabled() || !get()._adminVerified) return false
        try {
          const res = await api.adminSetSettings(body)
          return !!(res && res.ok)
        } catch {
          return false
        }
      },

      syncAdminData: async () => {
        if (!api.isEnabled() || !get()._adminVerified) return
        try {
          const [settingsRes, ordersRes, productsRes, logsRes, broadcastsRes, usersRes, supportRes] = await Promise.all([
            api.adminGetSettings(),
            api.adminOrders(),
            api.adminGetProducts(),
            api.adminLogs(),
            api.adminBroadcasts(),
            api.adminUsers(),
            api.adminSupport(),
          ])
          const patch: Partial<AppStore> = {}
          if (settingsRes && typeof settingsRes === 'object') {
            const s = settingsRes as Record<string, unknown>
            const cfgPatch = mergeStoreConfigPatch(
              {
                cryptoAddresses: get().cryptoAddresses,
                siteLinks: get().siteLinks,
                siteContent: get().siteContent,
                photos: get().photos,
                qrOverrides: get().qrOverrides,
                refWithdrawNetworks: get().refWithdrawNetworks,
                maintenance: get().maintenance,
              },
              {
                maintenance: typeof s.maintenance === 'boolean' ? s.maintenance : undefined,
                addresses: s.addresses as PublicStoreConfig['addresses'],
                siteLinks: s.siteLinks as PublicStoreConfig['siteLinks'],
                siteContent: s.siteContent as PublicStoreConfig['siteContent'],
                photos: s.photos as PublicStoreConfig['photos'],
                qrOverrides: s.qrOverrides as PublicStoreConfig['qrOverrides'],
                refWithdrawNetworks: s.refWithdrawNetworks as PublicStoreConfig['refWithdrawNetworks'],
              },
            )
            Object.assign(patch, cfgPatch)
          }
          if (Array.isArray(ordersRes)) {
            const mapped = (ordersRes as Record<string, unknown>[]).map(mapServerOrder)
            patch.orders = mapped.sort(
              (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
            )
          }
          if (Array.isArray(usersRes)) {
            const byUid: Record<number, { username: string; full_name: string }> = {}
            for (const row of usersRes as { uid: number; username?: string; full_name?: string }[]) {
              byUid[row.uid] = {
                username: row.username ?? '',
                full_name: row.full_name ?? '',
              }
            }
            patch.adminUserByUid = byUid
          }
          const refRes = await api.adminRefWithdrawals()
          if (Array.isArray(refRes)) {
            patch.refWithdrawals = refRes as AppStore['refWithdrawals']
          }
          if (supportRes && typeof supportRes === 'object') {
            const sr = supportRes as { tickets?: unknown[]; messages?: unknown[] }
            const session = applySupportSessionPayload(sr)
            if (session) {
              patch.supportMessages = session.messages
              patch.supportTickets = session.tickets
            }
          }
          if (productsRes && typeof productsRes === 'object') {
            const pr = productsRes as { products?: Product[]; categories?: Category[]; pinned?: number[] }
            if (Array.isArray(pr.products)) patch.products = pr.products
            if (Array.isArray(pr.categories)) patch.categories = pr.categories
            if (Array.isArray(pr.pinned)) patch.pinnedProductIds = pr.pinned
          }
          if (Array.isArray(logsRes)) {
            patch.logs = logsRes as PaymentLog[]
          }
          if (Array.isArray(broadcastsRes)) {
            patch.broadcasts = broadcastsRes as Broadcast[]
          }
          if (Object.keys(patch).length > 0) set(patch)
        } catch { /* ignore */ }
      },

      // ─── ADMIN ─────────────────────────────────────────
      setCryptoAddress: (network, address) => {
        set((s) => ({ cryptoAddresses: { ...s.cryptoAddresses, [network]: address } }))
        void get().persistAdminSettings({ addresses: get().cryptoAddresses })
      },

      setSiteLink: (key, value) => {
        set((s) => ({ siteLinks: { ...s.siteLinks, [key]: value } }))
        void get().persistAdminSettings({ siteLinks: get().siteLinks })
      },

      setQrOverride: (network, dataUri) => {
        set((s) => {
          const next = { ...s.qrOverrides }
          if (dataUri === null) delete next[network]; else next[network] = dataUri
          return { qrOverrides: next }
        })
        void get().persistAdminSettings({ qrOverrides: get().qrOverrides })
      },

      setPhoto: (key, dataUri) => {
        set((s) => {
          const next = { ...s.photos }
          if (dataUri === null) delete next[key]; else next[key] = dataUri
          return { photos: next }
        })
        void get().persistAdminSettings({ photos: get().photos })
      },

      toggleMaintenance: async () => {
        const prev = get().maintenance
        const next = !prev
        set({ maintenance: next })
        const ok = await get().persistAdminSettings({ maintenance: next })
        if (!ok) {
          set({ maintenance: prev })
          return false
        }
        return true
      },

      setOrderStatus: (id, status) => {
        set((s) => {
          const becameCompleted = status === 'completed'
          const hasReceipt = s.supportMessages.some(
            (m) => m.kind === 'order_receipt' && m.order_receipt?.orderId === id,
          )
          const alreadyHasActions = s.supportMessages.some(
            (m) => m.kind === 'system' &&
              (m.text === `post_delivery_actions:${id}` || m.text.startsWith(`post_delivery_resolved:${id}:`)),
          )
          const shouldAddActions = becameCompleted && hasReceipt && !alreadyHasActions
          const orders = s.orders.map((o) => o.id === id
            ? { ...o, status, paid_at: status === 'completed' || status === 'paid' ? new Date().toISOString() : o.paid_at }
            : o)
          return {
            orders,
            notifications: syncNotificationsWithOrders(s.notifications, orders),
            supportMessages: becameCompleted
              ? [
                  ...s.supportMessages.map((m) =>
                    m.kind === 'order_receipt' && m.order_receipt?.orderId === id
                      ? { ...m, order_receipt: { ...m.order_receipt, stage: 'delivered' as const, deliveredAt: new Date().toISOString() } }
                      : m),
                  ...(shouldAddActions ? [{
                    id: Date.now() + 1,
                    sender: 'bot' as const,
                    kind: 'system' as const,
                    text: `post_delivery_actions:${id}`,
                    created: new Date().toISOString(),
                  }] : []),
                ]
              : s.supportMessages,
          }
        })
        if (api.isEnabled() && get()._adminVerified) {
          void api.adminPatchOrder(id, { status }).then(() => get().syncAdminData())
        }
      },

      setOrderDelivery: (id, deliveryData) => {
        set((s) => {
          const hasReceipt = s.supportMessages.some(
            (m) => m.kind === 'order_receipt' && m.order_receipt?.orderId === id,
          )
          const alreadyHasActions = s.supportMessages.some(
            (m) => m.kind === 'system' &&
              (m.text === `post_delivery_actions:${id}` || m.text.startsWith(`post_delivery_resolved:${id}:`)),
          )
          const shouldAddActions = hasReceipt && !alreadyHasActions
          return {
            orders: s.orders.map((o) => o.id === id
              ? { ...o, deliveryData, status: 'completed' as const, paid_at: o.paid_at ?? new Date().toISOString() }
              : o),
            supportMessages: [
              ...s.supportMessages.map((m) =>
                m.kind === 'order_receipt' && m.order_receipt?.orderId === id
                  ? { ...m, order_receipt: { ...m.order_receipt, stage: 'delivered' as const, deliveredAt: new Date().toISOString() } }
                  : m),
              ...(shouldAddActions ? [{
                id: Date.now() + 1,
                sender: 'bot' as const,
                kind: 'system' as const,
                text: `post_delivery_actions:${id}`,
                created: new Date().toISOString(),
              }] : []),
            ],
          }
        })
        if (api.isEnabled() && get()._adminVerified) {
          void api.adminPatchOrder(id, { status: 'completed', delivery_data: deliveryData }).then(
            () => get().syncAdminData(),
          )
        }
      },

      resolvePostDelivery: (orderId, choice) => {
        const state = get()
        // 1. side-effects on tickets
        if (choice === 'close') {
          const open = state.supportTickets.find((t) => t.status !== 'closed')
          if (open) get().closeSupportTicket(open.id, 'user')
        } else {
          const open = state.supportTickets.find((t) => t.status !== 'closed')
          if (!open) {
            get().openSupportTicket('operator', 'Follow-up after order')
          }
        }
        // 2. mark the action card as resolved
        set((s) => ({
          supportMessages: s.supportMessages.map((m) =>
            m.kind === 'system' && m.text === `post_delivery_actions:${orderId}`
              ? { ...m, text: `post_delivery_resolved:${orderId}:${choice}`, created: new Date().toISOString() }
              : m,
          ),
        }))
      },


      deleteOrder: (id) => {
        set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }))
        if (api.isEnabled()) api.adminDeleteOrder(id)
      },

      tryAutoFulfill: (orderId) => {
        const state = get()
        const order = state.orders.find((o) => o.id === orderId)
        if (!order || !order.product_id || order.deliveryData) return false
        // Если в одном заказе больше одного товара — авто-выдача отключена,
        // даже если в пуле достаточно аккаунтов. Эти аккаунты резервируются
        // для других пользователей, а покупатель отправляется в саппорт.
        if ((order.quantity ?? 1) > 1) return false
        const product = state.products.find((p) => p.id === order.product_id)
        if (!product || product.delivery !== 'auto') return false
        const pool = product.autoItems ?? []
        if (pool.length === 0) return false
        const [nextItem, ...rest] = pool
        // 1) убираем выданную запись из пула, но публичный stock не трогаем
        set((s) => ({
          products: s.products.map((p) =>
            p.id === product.id
              ? { ...p, autoItems: rest }
              : p,
          ),
        }))
        // 2) привязываем данные к заказу и помечаем completed (это уже умеет setOrderDelivery)
        get().setOrderDelivery(orderId, nextItem)
        if (api.isEnabled() && get()._adminVerified) {
          const updated = get().products.find((x) => x.id === product.id)
          if (updated) {
            void api.adminUpsertProduct({
              ...updated,
              autoItems: updated.autoItems,
              pinned: get().pinnedProductIds.includes(updated.id),
            }).then(() => get().syncAdminData())
          }
        }
        return true
      },

      upsertProduct: (p) => {
        set((s) => {
          const exists = s.products.some((x) => x.id === p.id)
          return { products: exists ? s.products.map((x) => x.id === p.id ? p : x) : [...s.products, p] }
        })
        if (api.isEnabled() && get()._adminVerified) {
          void api.adminUpsertProduct({ ...p, pinned: get().pinnedProductIds.includes(p.id) }).then(
            () => get().syncAdminData(),
          )
        }
      },

      deleteProduct: (id) => {
        set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
        if (api.isEnabled() && get()._adminVerified) api.adminDeleteProduct(id)
      },

      upsertCategory: (c) => {
        set((s) => {
          const exists = s.categories.some((x) => x.id === c.id)
          return { categories: exists ? s.categories.map((x) => x.id === c.id ? c : x) : [...s.categories, c] }
        })
        if (api.isEnabled() && get()._adminVerified) {
          void api.adminUpsertCategory(c).then(() => get().syncAdminData())
        }
      },

      deleteCategory: (id) => {
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
        if (api.isEnabled() && get()._adminVerified) {
          void api.adminDeleteCategory(id).then(() => get().syncAdminData())
        }
      },

      addLog: (log) => {
        const entry: PaymentLog = { id: Date.now(), ...log }
        set((s) => ({ logs: [entry, ...s.logs].slice(0, 500) }))
        if (api.isEnabled() && get()._adminVerified) {
          void api.adminAddLog(entry)
        }
      },

      addBroadcast: (text, sent_to, keyboard) =>
        set((s) => ({
          broadcasts: [{ id: Date.now(), text, sent_to, ts: new Date().toISOString(), keyboard }, ...s.broadcasts],
        })),

      setSiteContent: (key, value) => {
        set((s) => ({ siteContent: { ...s.siteContent, [key]: value } }))
        void get().persistAdminSettings({ siteContent: get().siteContent })
      },

      markOrderForwarded: (orderId) =>
        set((s) => ({ supportForwardedOrders: s.supportForwardedOrders.includes(orderId) ? s.supportForwardedOrders : [...s.supportForwardedOrders, orderId] })),

      pinProduct: (id) => {
        set((s) => ({ pinnedProductIds: s.pinnedProductIds.includes(id) ? s.pinnedProductIds : [...s.pinnedProductIds, id] }))
        if (api.isEnabled() && get()._adminVerified) api.adminPinProduct(id)
      },

      unpinProduct: (id) => {
        set((s) => ({ pinnedProductIds: s.pinnedProductIds.filter((x) => x !== id) }))
        if (api.isEnabled() && get()._adminVerified) api.adminUnpinProduct(id)
      },

      setRefWithdrawNetworks: (networks) => {
        set({ refWithdrawNetworks: networks })
        void get().persistAdminSettings({ refWithdrawNetworks: networks })
      },

      isAdmin: (): boolean => get()._adminVerified,
      isAdminCheckDone: (): boolean => get()._adminCheckDone,
      createFinancialNonce: (): string => createFinancialNonce(),

      addReferral: (ref) =>
        set((s) => {
          if (s.referrals.some((r) => r.uid === ref.uid)) return {}
          return { referrals: [...s.referrals, ref] }
        }),

      updateReferral: (uid, updates) =>
        set((s) => ({
          referrals: s.referrals.map((r) =>
            r.uid === uid ? { ...r, ...updates } : r
          ),
        })),

      getActiveReferrals: () =>
        get().referrals.filter((r) => r.purchaseCount > 0),

      addRealSale: (sale) =>
        set((s) => ({
          realSales: [sale, ...s.realSales].slice(0, 200),
        })),

      stickHeroScores: [],
      stickHeroName: null,
      setStickHeroName: (name) => {
        const clean = name.replace(/[^\p{L}\p{N}_\- .]/gu, '').trim().slice(0, 16)
        if (clean.length < 2) return
        set({ stickHeroName: clean })
      },
      addStickHeroScore: (score) => set((s) => {
        const name = (s.stickHeroName || '').trim()
        if (!name) return {}
        const safeScore = Math.max(0, Math.min(99999, Math.floor(Number(score) || 0)))
        const key = name.toLowerCase()
        const existing = s.stickHeroScores.find((x) => x.name.toLowerCase() === key)
        // 1 player = 1 slot; only beat your own best
        if (existing && existing.score >= safeScore) return {}
        const filtered = s.stickHeroScores.filter((x) => x.name.toLowerCase() !== key)
        const next = [...filtered, { name, score: safeScore, ts: Date.now() }]
          .sort((a, b) => b.score - a.score)
          .slice(0, 100)
        return { stickHeroScores: next }
      }),
    }),
    {
      name: 'fanvue-app-v10',
      version: 3,
      migrate: (state: unknown) => {
        const s = state as Partial<AppStore>
        if (s.user) {
          s.user = { ...MOCK_USER, ...s.user }
        }
        s.cryptoAddresses = { ...CONFIG.addresses, ...(s.cryptoAddresses ?? {}) } as typeof s.cryptoAddresses
        if (s.siteLinks) {
          s.siteLinks = { ...defaultSiteLinks(), ...s.siteLinks }
        }
        if (!Array.isArray(s.orders)) s.orders = []
        if (!Array.isArray(s.notifications)) s.notifications = []
        return s
      },
      partialize: (s) => ({
        lang: s.lang,
        langUserSet: s.langUserSet,
        user: s.user
          ? {
              uid: s.user.uid,
              username: s.user.username,
              full_name: s.user.full_name,
              photo_url: s.user.photo_url,
              lang: s.user.lang,
              balance: s.user.balance,
              spent: s.user.spent,
              purchases: s.user.purchases,
              ref_earned: s.user.ref_earned,
              ref_count: s.user.ref_count,
              ref_balance: s.user.ref_balance,
              created: s.user.created,
            }
          : null,
        cryptoAddresses: s.cryptoAddresses,
        qrOverrides: s.qrOverrides,
        photos: s.photos,
        siteContent: s.siteContent,
        siteLinks: s.siteLinks,
        orders: s.orders,
        notifications: s.notifications,
        refReward: s.refReward,
        refWithdrawals: s.refWithdrawals,
        refWithdrawNetworks: s.refWithdrawNetworks,
        refDailyLog: s.refDailyLog,
        supportForwardedOrders: s.supportForwardedOrders,
        pinnedProductIds: s.pinnedProductIds,
        products: s.products,
        categories: s.categories,
        supportUnread: s.supportUnread,
        referrals: s.referrals,
        realSales: s.realSales,
        stickHeroScores: s.stickHeroScores,
        stickHeroName: s.stickHeroName,
      }),
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          void useStore.getState().bootstrapSession()
        })
      },
    }
  )
)

// Helper для CRYPTO_OPTIONS с актуальными адресами из store
export function getCryptoOptions(addresses: Record<CryptoNetwork, string>): CryptoOption[] {
  return CRYPTO_OPTIONS.map((opt) => ({ ...opt, address: addresses[opt.id] || opt.address }))
}
