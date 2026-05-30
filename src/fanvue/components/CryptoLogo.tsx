import { useState } from 'react'
import { useStore } from '../store'
import type { CryptoNetwork } from '../store/types'
import solanaLogo from '../assets/solana.svg'
import tonLogo from '../assets/ton.svg'

const LOCAL_LOGOS: Partial<Record<CryptoNetwork, string>> = {
  sol: solanaLogo,
  ton: tonLogo,
}

/**
 * Маппинг сеть → (символ монеты, цвет сети для бейджа, эмодзи fallback).
 * Для USDT-вариантов показываем USDT-лого + маленький бейдж сети.
 */
const NETWORK_MAP: Record<CryptoNetwork, {
  coin: string  // SVG от spothq/cryptocurrency-icons
  badge?: { color: string; symbol: string }  // network badge
  fallback: string
}> = {
  trc20:    { coin: 'usdt', badge: { color: '#FF060A', symbol: 'TRX' }, fallback: '₮' },
  erc20:    { coin: 'usdt', badge: { color: '#627EEA', symbol: 'ETH' }, fallback: '₮' },
  bep20:    { coin: 'usdt', badge: { color: '#F0B90B', symbol: 'BSC' }, fallback: '₮' },
  usdc_eth: { coin: 'usdc', badge: { color: '#627EEA', symbol: 'ETH' }, fallback: '$' },
  usdc_sol: { coin: 'usdc', badge: { color: '#9945FF', symbol: 'SOL' }, fallback: '$' },
  eth:      { coin: 'eth',  fallback: 'Ξ' },
  sol:      { coin: 'sol',  fallback: '◎' },
  btc:      { coin: 'btc',  fallback: '₿' },
  ton:      { coin: 'ton',  fallback: '💎' },
}

const CDN = 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color'

interface Props {
  network: CryptoNetwork
  size?: number
  showBadge?: boolean
}

export default function CryptoLogo({ network, size = 42, showBadge = true }: Props) {
  const photos = useStore((s) => s.photos)
  const [imgFailed, setImgFailed] = useState(false)
  const data = NETWORK_MAP[network]

  // Solana must always use the bundled crisp vector; older admin-uploaded PNGs were low-res.
  const override = LOCAL_LOGOS[network] || photos[`crypto_${network}`]
  const useCdn = !override && !imgFailed

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {override ? (
        <img
          src={override}
          alt={network}
          width={size}
          height={size}
          style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      ) : useCdn ? (
        <img
          src={`${CDN}/${data.coin}.svg`}
          alt={network}
          width={size}
          height={size}
          style={{ borderRadius: '50%', display: 'block' }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: data.badge?.color ?? 'var(--purple)',
          color: 'white', fontWeight: 800, fontSize: size * 0.45,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {data.fallback}
        </div>
      )}
      {showBadge && data.badge && (
        <div style={{
          position: 'absolute', bottom: -2, right: -4,
          background: data.badge.color, color: 'white',
          fontSize: Math.max(7, size * 0.22), fontWeight: 800,
          padding: '2px 4px', borderRadius: 6,
          border: '2px solid #0C0C1B', lineHeight: 1,
          letterSpacing: '0.04em',
        }}>
          {data.badge.symbol}
        </div>
      )}
    </div>
  )
}
