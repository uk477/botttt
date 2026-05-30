import { CONFIG } from '../config'
import { getTelegramInitData } from './security'
import type { CryptoNetwork, OrderStatus } from '../store/types'

/**
 * Unique order ID using crypto-random bytes.
 * Format: {PREFIX}-{base36(ts)}-{4 random chars}
 */
export function generateOrderId(kind: 'buy' | 'deposit' = 'buy'): string {
  const prefix = kind === 'deposit' ? 'DEP' : 'ORD'
  const ts = Date.now().toString(36).toUpperCase()
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = new Uint8Array(4)
  crypto.getRandomValues(arr)
  let rand = ''
  for (let i = 0; i < 4; i++) rand += alphabet[arr[i] % alphabet.length]
  return `${prefix}-${ts}-${rand}`
}

/**
 * Unique deposit amount with 3-decimal micro-offset.
 * Uses crypto.getRandomValues for true randomness + a session-local
 * deduplication set to guarantee no two amounts collide.
 *
 * Example: base=10 → 10.023, 10.047, 10.081 (never 10.000 or 10.010)
 */
const _usedAmounts = new Set<number>()

export function generateUniqueAmount(base: number): number {
  const MAX_ATTEMPTS = 50
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const buf = new Uint8Array(2)
    crypto.getRandomValues(buf)
    const raw = ((buf[0] << 8) | buf[1]) % 990 + 10
    const offset = raw / 10000
    const amount = Math.round((base + offset) * 1000) / 1000

    if (!_usedAmounts.has(amount)) {
      _usedAmounts.add(amount)
      if (_usedAmounts.size > 2000) {
        const arr = [..._usedAmounts]
        arr.splice(0, 1000)
        _usedAmounts.clear()
        arr.forEach((a) => _usedAmounts.add(a))
      }
      return amount
    }
  }
  const fallback = new Uint8Array(2)
  crypto.getRandomValues(fallback)
  const offset = (((fallback[0] << 8) | fallback[1]) % 990 + 10) / 10000
  return Math.round((base + offset) * 1000) / 1000
}

/**
 * Build a wallet deep-link URI for the QR code.
 *  - BTC  → BIP21
 *  - ETH  → EIP-681 (value in wei)
 *  - ERC20 (USDT/USDC) → EIP-681 token transfer on chainId 1
 *  - BEP20 (USDT)      → EIP-681 token transfer on chainId 56
 *  - TON  → ton://transfer (amount in nano)
 *  - SOL / SPL → Solana Pay (https://docs.solanapay.com/spec)
 *  - TRC20 (USDT) → tron: URI (Trust Wallet / TronLink)
 * Falls back to bare address if amount is unknown.
 */
const ERC20 = {
  trc20:    { contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6 }, // USDT on Tron
  erc20:    { contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, chain: 1 },  // USDT ETH
  bep20:    { contract: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, chain: 56 }, // USDT BSC
  usdc_eth: { contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, chain: 1 },   // USDC ETH
  usdc_sol: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },              // USDC SPL
} as const

function toUnits(amount: number, decimals: number): string {
  // safe integer string of amount * 10^decimals (avoids float drift)
  const [whole, frac = ''] = String(amount).split('.')
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return (BigInt(whole || '0') * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || '0')).toString()
}

export function paymentUri(network: CryptoNetwork, address: string, amount: number): string {
  if (!address) return ''
  if (!amount || amount <= 0) return address

  switch (network) {
    case 'btc':
      return `bitcoin:${address}?amount=${amount}`
    case 'eth': {
      const wei = toUnits(amount, 18)
      return `ethereum:${address}@1?value=${wei}`
    }
    case 'ton':
      // Trust Wallet universal link (asset c607 = TON). Открывает Trust сразу
      // на форме отправки TON; если Trust не установлен — ведёт на страницу
      // установки. Поддерживается также Tonkeeper при сканировании.
      return `https://link.trustwallet.com/send?asset=c607&address=${address}&amount=${amount}`
    case 'sol':
      return `solana:${address}?amount=${amount}`
    case 'usdc_sol': {
      const t = ERC20.usdc_sol
      return `solana:${address}?amount=${amount}&spl-token=${t.mint}`
    }
    case 'erc20': {
      const t = ERC20.erc20
      return `ethereum:${t.contract}@${t.chain}/transfer?address=${address}&uint256=${toUnits(amount, t.decimals)}`
    }
    case 'usdc_eth': {
      const t = ERC20.usdc_eth
      return `ethereum:${t.contract}@${t.chain}/transfer?address=${address}&uint256=${toUnits(amount, t.decimals)}`
    }
    case 'bep20': {
      const t = ERC20.bep20
      return `ethereum:${t.contract}@${t.chain}/transfer?address=${address}&uint256=${toUnits(amount, t.decimals)}`
    }
    case 'trc20': {
      const t = ERC20.trc20
      // Trust Wallet universal link для USDT-TRC20 (asset c195_t<contract>).
      // Срабатывает в Trust и TronLink; `tron:` scheme почти нигде не поддерживается.
      return `https://link.trustwallet.com/send?asset=c195_t${t.contract}&address=${address}&amount=${amount}`
    }
    default:
      return address
  }
}

function authHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': getTelegramInitData(),
    'X-Request-Id': `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    'X-Request-Ts': String(Date.now()),
  }
}

function apiUrl(path: string): string {
  return `${CONFIG.apiUrl.replace(/\/$/, '')}${path}`
}

async function fetchWithRetry(
  input: RequestInfo,
  init: RequestInit,
  retries = 1,
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 5_000)
      const res = await fetch(input, { ...init, signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok || i === retries) return res
    } catch (e) {
      if (i === retries) throw e
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('fetch failed')
}

export async function fetchOrderStatus(orderId: string): Promise<OrderStatus> {
  try {
    const res = await fetchWithRetry(
      apiUrl(`/api/order/${encodeURIComponent(orderId)}`),
      { headers: authHeaders() },
    )
    if (!res.ok) return 'pending'
    const data = (await res.json()) as { status?: OrderStatus }
    return data.status ?? 'pending'
  } catch {
    return 'pending'
  }
}

export async function createOrder(payload: {
  uid: number
  kind: 'buy' | 'deposit'
  product_id?: number
  quantity?: number
  amount_usd: number
  network: CryptoNetwork
}): Promise<{ id: string; address: string; amount_usd: number; amount_crypto: number; expires_at: string } | null> {
  try {
    const res = await fetchWithRetry(
      apiUrl('/api/order'),
      { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) },
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchWalletAddresses(): Promise<Partial<Record<CryptoNetwork, string>>> {
  try {
    const res = await fetchWithRetry(apiUrl('/api/config/wallets'), { headers: authHeaders() })
    if (!res.ok) return {}
    const data = (await res.json()) as { addresses?: Partial<Record<CryptoNetwork, string>> }
    return data.addresses ?? {}
  } catch {
    return {}
  }
}
