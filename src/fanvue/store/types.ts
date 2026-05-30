export type Lang = 'ru' | 'en'
export type DeliveryType = 'auto' | 'manual'
export type OrderStatus = 'pending' | 'paid' | 'completed' | 'failed' | 'expired'
export type OrderKind = 'buy' | 'deposit'
export type CryptoNetwork = 'trc20' | 'erc20' | 'bep20' | 'eth' | 'sol' | 'btc' | 'usdc_eth' | 'usdc_sol' | 'ton'

export interface User {
  uid: number
  username: string
  full_name: string
  lang: Lang
  balance: number
  spent: number
  purchases: number
  ref_earned: number
  ref_count: number
  ref_balance: number   // withdrawable referral balance
  created: string
  photo_url?: string
}

export interface RefReward {
  month: string         // 'YYYY-MM'
  count: number         // qualifying referrals this month (each must have purchased)
  claimed: boolean      // whether $100 bonus was auto-credited this month
}

export type RefWithdrawalStatus = 'pending' | 'completed' | 'rejected'

export interface RefWithdrawal {
  id: string
  uid?: number
  amount: number
  network: CryptoNetwork
  address: string
  status: RefWithdrawalStatus
  createdAt: string
  completedAt?: string
  txid?: string
  rejectReason?: string
}

export interface Category {
  id: number
  name: string
  name_en: string
  emoji: string
  active: boolean
}

export interface Product {
  id: number
  cat_id: number
  title: string
  title_en: string
  description: string
  desc_en: string
  price: number
  delivery: DeliveryType
  stock: number
  active: boolean
  /** Пул заготовленных выдач для delivery='auto'.
   *  Одна запись = один товар = выдаётся одному покупателю (1 в руки).
   *  После продажи запись удаляется из пула и приклеивается к заказу. */
  autoItems?: string[]
}

export interface Order {
  id: string
  kind: OrderKind
  product_title?: string
  /** ID товара — нужен для автовыдачи (взятия следующего пула). */
  product_id?: number
  amount: number
  status: OrderStatus
  provider?: string
  quantity?: number
  created: string
  paid_at?: string
  txid?: string
  orderNum?: number
  /** Свободный многострочный текст с данными выдачи (логин/пароль/инструкция). Заполняется админом или автовыдачей. */
  deliveryData?: string
}

export interface SupportAttachment {
  id: string
  name: string
  mime: string
  size?: number
  dataUrl: string
}

export type SupportMessageKind = 'text' | 'image' | 'file' | 'system' | 'quick_form' | 'order_receipt'

export type OrderReceiptStage = 'created' | 'processing' | 'delivered'

export interface OrderReceiptPayload {
  orderId: string
  productTitle: string
  amount: number
  currency?: string
  createdAt: string
  stage: OrderReceiptStage
  deliveredAt?: string
}

export interface SupportMessage {
  id: number
  sender: 'user' | 'admin' | 'bot'
  kind?: SupportMessageKind
  text: string
  attachments?: SupportAttachment[]
  created: string
  read_by_admin?: boolean
  read_by_user?: boolean
  reply_to?: number
  deleted_for?: 'user' | 'all'
  ticket_id?: string
  order_receipt?: OrderReceiptPayload
}

export type SupportTicketStatus = 'triage' | 'open' | 'closed'
export type SupportTicketCategory = 'payment' | 'delivery' | 'account' | 'operator' | 'other'

export interface SupportTicket {
  id: string
  category: SupportTicketCategory
  status: SupportTicketStatus
  opened: string
  closed?: string
  summary?: string
}

export interface AdminPresence {
  online: boolean
  lastSeen: string
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface CryptoOption {
  id: CryptoNetwork
  name: string
  symbol: string
  color: string
  icon: string
  address: string
}

export interface PaymentLog {
  id: number
  ts: string
  uid: number
  username: string
  kind: OrderKind
  amount: number
  network?: CryptoNetwork
  status: 'success' | 'failed' | 'expired'
  tx_hash?: string
  product?: string
}

export interface Broadcast {
  id: number
  text: string
  sent_to: number
  ts: string
}

export interface PaymentNotification {
  orderId: string
  kind: OrderKind
  amountUsd: number
  uniqueAmount: number
  network: CryptoNetwork
  read: boolean
  createdAt: string
}

/**
 * Ключи для photos map:
 *   welcome_ru | welcome_en  — приветственное фото
 *   crypto_<network>         — переопределение лого крипты
 *   product_<id>             — фото товара
 */
export interface Referral {
  uid: number
  username: string
  full_name: string
  photo_url?: string
  joinedAt: string
  totalSpent: number
  purchaseCount: number
}

export interface RealSale {
  id: string
  uid: number
  username: string
  full_name: string
  photo_url?: string
  productTitle: string
  productIndex: 0 | 1
  amount: number
  ts: number
}

export type PhotoKey = string
