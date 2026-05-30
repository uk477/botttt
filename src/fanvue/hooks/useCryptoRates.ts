import { useState, useEffect, useCallback } from 'react'
import type { CryptoNetwork } from '../store/types'

export interface LiveRates {
  btc: number
  eth: number
  sol: number
  bnb: number
  ton: number
  updatedAt: number
}

const FALLBACK: LiveRates = {
  btc: 105_000, eth: 3_800, sol: 180, bnb: 650, ton: 6.2, updatedAt: 0,
}

const CACHE_TTL = 30_000
const REFRESH_INTERVAL = 30_000

let _cache: LiveRates | null = null
let _fetchPromise: Promise<LiveRates> | null = null

async function fetchBinance(signal: AbortSignal): Promise<Partial<LiveRates> | null> {
  try {
    const symbols = encodeURIComponent('["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","TONUSDT"]')
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${symbols}`,
      { signal },
    )
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ symbol: string; price: string }>
    const map: Record<string, number> = {}
    for (const item of data) map[item.symbol] = parseFloat(item.price)
    return {
      btc: map['BTCUSDT'] || undefined,
      eth: map['ETHUSDT'] || undefined,
      sol: map['SOLUSDT'] || undefined,
      bnb: map['BNBUSDT'] || undefined,
      ton: map['TONUSDT'] || undefined,
    }
  } catch {
    return null
  }
}

async function fetchCoinGecko(signal: AbortSignal): Promise<Partial<LiveRates> | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,the-open-network&vs_currencies=usd',
      { signal },
    )
    if (!res.ok) return null
    const d = (await res.json()) as Record<string, { usd: number }>
    return {
      btc: d.bitcoin?.usd || undefined,
      eth: d.ethereum?.usd || undefined,
      sol: d.solana?.usd || undefined,
      bnb: d.binancecoin?.usd || undefined,
      ton: d['the-open-network']?.usd || undefined,
    }
  } catch {
    return null
  }
}

function mergeRates(a: Partial<LiveRates> | null, b: Partial<LiveRates> | null): LiveRates {
  const prev = _cache ?? FALLBACK
  return {
    btc: a?.btc || b?.btc || prev.btc,
    eth: a?.eth || b?.eth || prev.eth,
    sol: a?.sol || b?.sol || prev.sol,
    bnb: a?.bnb || b?.bnb || prev.bnb,
    ton: a?.ton || b?.ton || prev.ton,
    updatedAt: Date.now(),
  }
}

async function fetchRates(): Promise<LiveRates> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8_000)

  try {
    const [binance, gecko] = await Promise.allSettled([
      fetchBinance(ctrl.signal),
      fetchCoinGecko(ctrl.signal),
    ])
    const bResult = binance.status === 'fulfilled' ? binance.value : null
    const gResult = gecko.status === 'fulfilled' ? gecko.value : null
    return mergeRates(bResult, gResult)
  } finally {
    clearTimeout(timer)
  }
}

async function getLatestRates(): Promise<LiveRates> {
  if (_cache && Date.now() - _cache.updatedAt < CACHE_TTL) return _cache

  if (_fetchPromise) return _fetchPromise

  _fetchPromise = fetchRates().then((r) => {
    _cache = r
    _fetchPromise = null
    return r
  }).catch(() => {
    _fetchPromise = null
    return _cache ?? { ...FALLBACK, updatedAt: Date.now() }
  })

  return _fetchPromise
}

export function calcCryptoAmount(usd: number, network: CryptoNetwork, rates: LiveRates | null): number {
  const r = rates ?? _cache ?? FALLBACK
  switch (network) {
    case 'btc':      return r.btc > 0 ? usd / r.btc : 0
    case 'eth':      return r.eth > 0 ? usd / r.eth : 0
    case 'erc20':    return usd
    case 'bep20':    return usd
    case 'trc20':    return usd
    case 'sol':      return r.sol > 0 ? usd / r.sol : 0
    case 'ton':      return r.ton > 0 ? usd / r.ton : 0
    case 'usdc_eth': return usd
    case 'usdc_sol': return usd
    default:         return usd
  }
}

export function formatCryptoAmount(amount: number, network: CryptoNetwork): string {
  if (network === 'btc') return amount.toFixed(8)
  if (network === 'eth' || network === 'sol' || network === 'ton') return amount.toFixed(6)
  return amount.toFixed(2)
}

export function getCachedRates(): LiveRates | null {
  return _cache
}

export function useCryptoRates(): LiveRates | null {
  const [rates, setRates] = useState<LiveRates | null>(_cache)

  const refresh = useCallback(async () => {
    const r = await getLatestRates()
    setRates(r)
  }, [])

  useEffect(() => {
    let cancelled = false

    getLatestRates().then((r) => {
      if (!cancelled) setRates(r)
    })

    const id = setInterval(() => {
      if (!cancelled) {
        getLatestRates().then((r) => {
          if (!cancelled) setRates(r)
        })
      }
    }, REFRESH_INTERVAL)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refresh])

  return rates
}
