import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CONFIG } from '../config'
import { api } from './api'
import {
  verifyAdminHash,
  sanitizeText,
  rateLimit,
  isValidAmount,
  createFinancialNonce,
  audit,
} from '../utils/security'
import type {
  Lang, User, Category, Product, Order, SupportMessage, CartItem, CryptoOption,
  CryptoNetwork, PaymentLog, Broadcast, PaymentNotification, RefReward, RefWithdrawal,
  SupportTicket, SupportTicketCategory, AdminPresence, OrderReceiptPayload,
  Referral, RealSale, SiteContent, SiteLinks,
} from './types'
import { defaultSiteLinks, mergeStoreConfigPatch, type PublicStoreConfig } from './storeConfigSync'

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

function mapServerOrder(o: Record<string, unknown>): Order {
  return {
    id: String(o.id),
    kind: (o.kind as Order['kind']) || 'deposit',
    amount: Number(o.amount_usd ?? o.amount ?? 0),
    status: (o.status as Order['status']) || 'pending',
    provider: String(o.network ?? o.provider ?? ''),
    created: String(o.created_at ?? o.created ?? new Date().toISOString()),
    paid_at: o.paid_at ? String(o.paid_at) : undefined,
    txid: o.tx_hash ? String(o.tx_hash) : o.txid ? String(o.txid) : undefined,
    product_title: o.product_title ? String(o.product_title) : undefined,
    product_id: o.product_id != null ? Number(o.product_id) : undefined,
    quantity: o.quantity != null ? Number(o.quantity) : undefined,
    orderNum: o.orderNum != null ? Number(o.orderNum) : undefined,
  }
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

  // User actions
  setLang: (lang: Lang) => void
  initUser: () => void
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
  closeSupportTicket: (id: string, reason?: string) => void
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
  cancelPendingDeposits: (exceptNetwork?: string) => void

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
  addBroadcast: (text: string, sent_to: number, keyboard?: import('../../shared/broadcastKeyboard').BroadcastKeyboardInput) => void
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
        // one-time dedupe of any legacy duplicate stickHero scores
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
        try {
          type TGUser = { id?: number; username?: string; first_name?: string; last_name?: string; language_code?: string; photo_url?: string }
          const tg = (window as Window & { Telegram?: { WebApp?: { initDataUnsafe?: { user?: TGUser; start_param?: string } } } }).Telegram?.WebApp
          const tgUser = tg?.initDataUnsafe?.user
          const startParam = tg?.initDataUnsafe?.start_param ?? ''
          const state = get()
          const langFromStart =
            startParam === 'en' || startParam === 'lang_en' ? 'en' as const
            : startParam === 'ru' || startParam === 'lang_ru' ? 'ru' as const
            : null
          if (tgUser) {
            const detectedLang: Lang = tgUser.language_code?.startsWith('ru') ? 'ru' : 'en'
            const initialLang: Lang = state.langUserSet
              ? state.lang
              : (langFromStart ?? detectedLang)
            const uid = tgUser.id ?? state.user?.uid ?? MOCK_USER.uid
            const samePersistedUser = state.user?.uid === uid ? state.user : null
            const localUser: User = {
              ...MOCK_USER,
              ...(samePersistedUser ?? {}),
              uid,
              username: tgUser.username ?? samePersistedUser?.username ?? MOCK_USER.username,
              full_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || samePersistedUser?.full_name || MOCK_USER.full_name,
              photo_url: tgUser.photo_url ?? samePersistedUser?.photo_url,
            }
            set({
              user: localUser,
              lang: initialLang,
              langUserSet: state.langUserSet,
              isLoading: false,
            })

            verifyAdminHash(localUser.uid, CONFIG.adminHashes).then((ok) => {
              set({ _adminVerified: ok, _adminCheckDone: true })
              if (ok && api.isEnabled()) get().syncAdminData()
            }).catch(() => {
              set({ _adminCheckDone: true })
            })

            if (api.isEnabled()) {
              void get().syncStoreConfig()
              api.auth({}).then((serverUser) => {
                if (serverUser && typeof serverUser === 'object') {
                  const u = serverUser as Record<string, unknown>
                  const pref = u.preferred_lang
                  if (!get().langUserSet && (pref === 'ru' || pref === 'en')) {
                    set({ lang: pref as Lang })
                  }
                  // If server reports isAdmin, trust it over local hash
                  const serverIsAdmin = u.isAdmin === true
                  if (serverIsAdmin) {
                    set({ _adminVerified: true, _adminCheckDone: true })
                    get().syncAdminData()
                  }
                  if (typeof u.maintenance === 'boolean') {
                    set({ maintenance: u.maintenance as boolean })
                  }
                  set((s) => ({
                    user: s.user ? {
                      ...s.user,
                      balance:     Number(u.balance     ?? s.user.balance),
                      spent:       Number(u.spent       ?? s.user.spent),
                      purchases:   Number(u.purchases   ?? s.user.purchases),
                      ref_earned:  Number(u.ref_earned  ?? s.user.ref_earned),
                      ref_count:   Number(u.ref_count   ?? s.user.ref_count),
                      ref_balance: Number(u.ref_balance ?? s.user.ref_balance),
                    } : s.user,
                  }))
                  api.getMyOrders().then((res) => {
                    if (res && typeof res === 'object' && 'orders' in res) {
                      set({ orders: (res as { orders: Order[] }).orders })
                    }
                  })
                  api.getMessages().then((res) => {
                    if (res && typeof res === 'object' && 'messages' in res) {
                      set({ supportMessages: (res as { messages: SupportMessage[] }).messages })
                    }
                  })
                  api.getProducts().then((res) => {
                    if (res && typeof res === 'object') {
                      const update: Partial<AppStore> = {}
                      if ('products' in res && Array.isArray(res.products) && res.products.length > 0) {
                        update.products = res.products as Product[]
                      }
                      if ('categories' in res && Array.isArray(res.categories) && res.categories.length > 0) {
                        update.categories = res.categories as Category[]
                      }
                      if ('pinned' in res && Array.isArray(res.pinned)) {
                        update.pinnedProductIds = res.pinned as number[]
                      }
                      if (Object.keys(update).length > 0) set(update)
                    }
                  })
                }
              })
            }
          } else {
            if (api.isEnabled()) void get().syncStoreConfig()
            const persistedUser = get().user
            set({ user: persistedUser ?? MOCK_USER, isLoading: false })
            // Demo mode: verify mock user against hashes too
            verifyAdminHash((persistedUser ?? MOCK_USER).uid, CONFIG.adminHashes).then((ok) => {
              set({ _adminVerified: ok, _adminCheckDone: true })
            })
          }
        } catch {
          set({ user: get().user ?? MOCK_USER, isLoading: false, _adminCheckDone: true })
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
        const id = 'FV-' + Math.floor(1000 + Math.random() * 9000)
        const ticket: SupportTicket = {
          id, category, status: 'open',
          opened: new Date().toISOString(),
          summary,
        }
        set((s) => ({
          supportTickets: [ticket, ...s.supportTickets],
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
        return ticket
      },

      closeSupportTicket: (id, reason) =>
        set((s) => ({
          supportTickets: s.supportTickets.map((t) =>
            t.id === id ? { ...t, status: 'closed', closed: new Date().toISOString() } : t,
          ),
          supportMessages: [
            ...s.supportMessages,
            {
              id: Date.now(),
              sender: 'bot',
              kind: 'system',
              text: `ticket_closed:${id}${reason ? ':' + reason : ''}`,
              created: new Date().toISOString(),
              ticket_id: id,
            },
          ],
        })),

      resetSupportSession: () =>
        set((s) => ({
          supportTickets: s.supportTickets.map((t) =>
            t.status !== 'closed' ? { ...t, status: 'closed', closed: new Date().toISOString() } : t,
          ),
        })),

      updateBalance: (delta) => {
        if (!isValidAmount(Math.abs(delta), 0.001, 100_000)) return
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
        if (!api.isEnabled()) return
        try {
          const serverUser = await api.auth({})
          if (serverUser && typeof serverUser === 'object') {
            const u = serverUser as Record<string, unknown>
            set((s) => ({
              user: s.user ? {
                ...s.user,
                balance:     Number(u.balance     ?? s.user.balance),
                spent:       Number(u.spent       ?? s.user.spent),
                purchases:   Number(u.purchases   ?? s.user.purchases),
                ref_earned:  Number(u.ref_earned  ?? s.user.ref_earned),
                ref_count:   Number(u.ref_count   ?? s.user.ref_count),
                ref_balance: Number(u.ref_balance ?? s.user.ref_balance),
              } : s.user,
            }))
          }
        } catch { /* ignore */ }
      },

      creditRefBalance: (amount) => {
        if (!isValidAmount(amount, 0.01, 10_000)) return
        audit('ref_credit', get().user?.uid, { amount })
        set((s) => ({
          user: s.user ? { ...s.user, ref_balance: (s.user.ref_balance) + amount } : null,
        }))
      },

      spendRefBalance: (amount) => {
        if (!isValidAmount(amount, 0.01, 10_000)) return
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

      logDailyRef: (date, count = 1) =>
        set((s) => ({
          refDailyLog: { ...s.refDailyLog, [date]: (s.refDailyLog[date] ?? 0) + count },
          refReward: { ...s.refReward, count: s.refReward.count + count },
          user: s.user ? {
            ...s.user,
            ref_balance: s.user.ref_balance + 5 * count,
            ref_earned: s.user.ref_earned + 5 * count,
            ref_count: s.user.ref_count + count,
          } : null,
        })),

      checkAndResetMonthlyReward: () =>
        set((s) => {
          const currentMonth = new Date().toISOString().slice(0, 7)
          const { refReward } = s
          if (!refReward.month || refReward.month < currentMonth) {
            return { refReward: { month: currentMonth, count: 0, claimed: false } }
          }
          if (refReward.count >= 10 && !refReward.claimed) {
            return {
              refReward: { ...refReward, claimed: true },
              user: s.user ? {
                ...s.user,
                ref_balance: s.user.ref_balance + 100,
                ref_earned: s.user.ref_earned + 100,
              } : null,
            }
          }
          return {}
        }),

      cancelPendingDeposits: (exceptNetwork?: string) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.kind === 'deposit' && o.status === 'pending' && o.provider !== exceptNetwork
              ? { ...o, status: 'failed' as const }
              : o
          ),
        })),

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
          const [settingsRes, ordersRes, productsRes, logsRes, broadcastsRes] = await Promise.all([
            api.adminGetSettings(),
            api.adminOrders(),
            api.adminGetProducts(),
            api.adminLogs(),
            api.adminBroadcasts(),
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
            patch.orders = (ordersRes as Record<string, unknown>[]).map(mapServerOrder)
          }
          if (productsRes && typeof productsRes === 'object') {
            const pr = productsRes as { products?: Product[]; categories?: Category[]; pinned?: number[] }
            if (pr.products?.length) patch.products = pr.products
            if (pr.categories?.length) patch.categories = pr.categories
            if (pr.pinned) patch.pinnedProductIds = pr.pinned
          }
          if (Array.isArray(logsRes) && logsRes.length > 0) {
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
      },

      setSiteLink: (key, value) => {
        set((s) => ({ siteLinks: { ...s.siteLinks, [key]: value } }))
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
          return {
            orders: s.orders.map((o) => o.id === id
              ? { ...o, status, paid_at: status === 'completed' || status === 'paid' ? new Date().toISOString() : o.paid_at }
              : o),
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
        if (api.isEnabled()) api.adminPatchOrder(id, { status })
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
        return true
      },

      upsertProduct: (p) => {
        set((s) => {
          const exists = s.products.some((x) => x.id === p.id)
          return { products: exists ? s.products.map((x) => x.id === p.id ? p : x) : [...s.products, p] }
        })
        if (api.isEnabled() && get()._adminVerified) {
          api.adminUpsertProduct({ ...p, pinned: get().pinnedProductIds.includes(p.id) })
        }
      },

      deleteProduct: (id) => {
        set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
        if (api.isEnabled() && get()._adminVerified) api.adminDeleteProduct(id)
      },

      upsertCategory: (c) =>
        set((s) => {
          const exists = s.categories.some((x) => x.id === c.id)
          return { categories: exists ? s.categories.map((x) => x.id === c.id ? c : x) : [...s.categories, c] }
        }),

      deleteCategory: (id) =>
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      addLog: (log) =>
        set((s) => ({ logs: [{ id: Date.now(), ...log }, ...s.logs].slice(0, 500) })),

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
      name: 'fanvue-app-v9',
      version: 1,
      migrate: (state: unknown) => {
        const s = state as Partial<AppStore>
        if (s.user) {
          s.user = { ...MOCK_USER, ...s.user }
        }
        s.orders = []
        // ensure newly added crypto networks (e.g. ton) get default empty addresses
        s.cryptoAddresses = { ...CONFIG.addresses, ...(s.cryptoAddresses ?? {}) } as typeof s.cryptoAddresses
        if (Array.isArray(s.products)) {
          const defaultStocks = new Map(MOCK_PRODUCTS.map((p) => [p.id, p.stock]))
          s.products = s.products.map((p) => {
            if (p.delivery !== 'auto') return p
            const defaultStock = defaultStocks.get(p.id)
            const poolCount = p.autoItems?.length ?? 0
            return defaultStock && p.stock === poolCount && defaultStock > p.stock
              ? { ...p, stock: defaultStock }
              : p
          })
        }
        // ensure newly added siteLinks fields fall back to defaults
        if (s.siteLinks) {
          s.siteLinks = { ...defaultSiteLinks(), ...s.siteLinks }
        }
        if (s.orders) {
          s.orders = s.orders.map((o) =>
            o.kind === 'buy' && o.status === 'paid' && o.id.startsWith('2_')
              ? { ...o, status: 'completed' as const }
              : o
          )
        }
        // dedupe stickHeroScores: keep best per player (case-insensitive)
        if (Array.isArray(s.stickHeroScores)) {
          const best = new Map<string, { name: string; score: number; ts: number }>()
          for (const r of s.stickHeroScores) {
            if (!r || typeof r.name !== 'string') continue
            const name = r.name.trim()
            if (!name) continue
            const score = Math.max(0, Math.min(99999, Math.floor(Number(r.score) || 0)))
            const key = name.toLowerCase()
            const prev = best.get(key)
            if (!prev || prev.score < score) {
              best.set(key, { name, score, ts: Number(r.ts) || Date.now() })
            }
          }
          s.stickHeroScores = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 100)
        }
        return s
      },
      partialize: (s) => ({
        user: s.user,
        lang: s.lang,
        langUserSet: s.langUserSet,
        cryptoAddresses: s.cryptoAddresses,
        qrOverrides: s.qrOverrides,
        photos: s.photos,
        notifications: s.notifications,
        siteContent: s.siteContent,
        siteLinks: s.siteLinks,
        refReward: s.refReward,
        refWithdrawals: s.refWithdrawals,
        refWithdrawNetworks: s.refWithdrawNetworks,
        refDailyLog: s.refDailyLog,
        supportMessages: s.supportMessages,
        supportTickets: s.supportTickets,
        // Strip deliveryData (credentials) — NEVER persist to localStorage.
        // In production the user fetches delivery info from the server.
        orders: s.orders.map((o) => ({ ...o, deliveryData: undefined })),
        supportForwardedOrders: s.supportForwardedOrders,
        pinnedProductIds: s.pinnedProductIds,
        supportUnread: s.supportUnread,
        referrals: s.referrals,
        realSales: s.realSales,
        stickHeroScores: s.stickHeroScores,
        stickHeroName: s.stickHeroName,
      }),
    }
  )
)

// Helper для CRYPTO_OPTIONS с актуальными адресами из store
export function getCryptoOptions(addresses: Record<CryptoNetwork, string>): CryptoOption[] {
  return CRYPTO_OPTIONS.map((opt) => ({ ...opt, address: addresses[opt.id] || opt.address }))
}
