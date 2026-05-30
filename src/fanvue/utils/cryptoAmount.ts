import type { CryptoNetwork } from '../store/types'

/** Strip trailing zeros so QR/wallet shows 10.023 not 10.023000 */
export function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

/**
 * Amount string for UI, copy, and wallet QR/deep links.
 * Matches unique invoice precision (3 decimals on stables) without float noise.
 */
export function formatCryptoAmount(amount: number, network: CryptoNetwork): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0'
  if (network === 'btc') return trimTrailingZeros(amount.toFixed(8))
  if (network === 'eth' || network === 'sol' || network === 'ton') {
    return trimTrailingZeros(amount.toFixed(6))
  }
  return trimTrailingZeros(amount.toFixed(3))
}
