import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import CryptoLogo from './CryptoLogo'
import type { CryptoNetwork } from '../store/types'

interface CoinGroup {
  coin: string
  label: string
  symbol: string
  color: string
  networks: Array<{ id: CryptoNetwork; label: string; tag: string; tagEn: string }>
}

const COIN_GROUPS: CoinGroup[] = [
  {
    coin: 'usdt',
    label: 'Tether',
    symbol: 'USDT',
    color: '#26A17B',
    networks: [
      { id: 'trc20', label: 'TRC20', tag: 'TRON · быстро и дёшево', tagEn: 'TRON · fast & cheap' },
      { id: 'erc20', label: 'ERC20', tag: 'Ethereum · самая популярная', tagEn: 'Ethereum · most popular' },
      { id: 'bep20', label: 'BEP20', tag: 'BNB Smart Chain · низкие комиссии', tagEn: 'BNB Smart Chain · low fees' },
    ],
  },
  {
    coin: 'usdc',
    label: 'USD Coin',
    symbol: 'USDC',
    color: '#2775CA',
    networks: [
      { id: 'usdc_eth', label: 'ERC20', tag: 'Ethereum · популярная сеть', tagEn: 'Ethereum · popular network' },
      { id: 'usdc_sol', label: 'SPL',   tag: 'Solana · очень быстро', tagEn: 'Solana · very fast' },
    ],
  },
  {
    coin: 'eth',
    label: 'Ethereum',
    symbol: 'ETH',
    color: '#627EEA',
    networks: [{ id: 'eth', label: 'Ethereum', tag: 'ERC20 сеть', tagEn: 'ERC20 network' }],
  },
  {
    coin: 'ton',
    label: 'Toncoin',
    symbol: 'TON',
    color: '#0098EA',
    networks: [{ id: 'ton', label: 'TON', tag: 'The Open Network · быстро и дёшево', tagEn: 'The Open Network · fast & cheap' }],
  },
  {
    coin: 'sol',
    label: 'Solana',
    symbol: 'SOL',
    color: '#9945FF',
    networks: [{ id: 'sol', label: 'Solana', tag: 'SPL · очень быстро', tagEn: 'SPL · very fast' }],
  },
  {
    coin: 'btc',
    label: 'Bitcoin',
    symbol: 'BTC',
    color: '#F7931A',
    networks: [{ id: 'btc', label: 'Bitcoin', tag: 'Нативная сеть', tagEn: 'Native network' }],
  },
]

const NET_COLORS: Partial<Record<CryptoNetwork, string>> = {
  trc20: '#E8365D', erc20: '#627EEA', bep20: '#F0B90B',
  usdc_eth: '#627EEA', usdc_sol: '#9945FF',
  eth: '#627EEA', sol: '#9945FF', btc: '#F7931A', ton: '#0098EA',
}

export default function CryptoSelector({
  selected, onSelect,
}: {
  selected: CryptoNetwork | null
  onSelect: (id: CryptoNetwork) => void
}) {
  const lang = useStore((s) => s.lang)

  const [expandedCoin, setExpandedCoin] = useState<string | null>(() => {
    if (!selected) return null
    return COIN_GROUPS.find((g) => g.networks.some((n) => n.id === selected))?.coin ?? null
  })

  const handleCoinTap = (group: CoinGroup) => {
    if (group.networks.length === 1) {
      onSelect(group.networks[0].id)
      setExpandedCoin(group.coin)
      return
    }
    setExpandedCoin((prev) => (prev === group.coin ? null : group.coin))
  }

  return (
    <div className="col gap-2">
      {COIN_GROUPS.map((group, i) => {
        const isExpanded = expandedCoin === group.coin
        const groupSelected = group.networks.some((n) => n.id === selected)
        const hasSub = group.networks.length > 1
        const selectedNet = group.networks.find((n) => n.id === selected)

        return (
          <div key={group.coin}>
            <motion.div
              className="crypto-opt"
              style={{
                background: groupSelected ? `${group.color}18` : undefined,
                border: `1.5px solid ${groupSelected ? group.color : 'var(--b-default)'}`,
              }}
              onClick={() => handleCoinTap(group)}
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              whileTap={{ scale: 0.98 }}
            >
              <CryptoLogo network={group.networks[0].id} size={42} showBadge={!hasSub} />
              <div className="col gap-1" style={{ flex: 1 }}>
                <div className="crypto-name">{group.label}</div>
                <div className="crypto-symbol">{group.symbol}</div>
              </div>

              {groupSelected && !hasSub && (
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: group.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'white', flexShrink: 0,
                }}>✓</div>
              )}

              {hasSub && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {selectedNet && (
                    <motion.span
                      key={selectedNet.label}
                      initial={false}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{
                        fontSize: 10, fontWeight: 700, color: group.color,
                        background: `${group.color}1A`, padding: '2px 8px', borderRadius: 6,
                      }}
                    >
                      {selectedNet.label}
                    </motion.span>
                  )}
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ color: 'var(--t-muted)', display: 'flex' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </motion.div>
                </div>
              )}
            </motion.div>

            <AnimatePresence>
              {isExpanded && hasSub && (
                <motion.div
                  initial={false}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="col gap-2" style={{ paddingTop: 8, paddingBottom: 4 }}>
                    <div className="t-xs t-muted" style={{ paddingLeft: 4, marginBottom: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {lang === 'ru' ? 'Выберите сеть' : 'Select network'}
                    </div>
                    {group.networks.map((net, ni) => {
                      const netColor = NET_COLORS[net.id] ?? group.color
                      const isSelected = selected === net.id
                      return (
                        <motion.div
                          key={net.id}
                          initial={false}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: ni * 0.04, duration: 0.18 }}
                          onClick={() => onSelect(net.id)}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                            background: isSelected ? `${netColor}18` : 'rgba(255,255,255,0.025)',
                            border: `1px solid ${isSelected ? netColor : 'var(--b-default)'}`,
                            marginLeft: 12, transition: 'all 150ms',
                          }}
                        >
                          <CryptoLogo network={net.id} size={30} />
                          <div style={{ flex: 1 }}>
                            <div className="t-sm fw-bold">{net.label}</div>
                            <div className="t-xs t-muted" style={{ marginTop: 1 }}>
                              {lang === 'ru' ? net.tag : net.tagEn}
                            </div>
                          </div>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%',
                            border: `2px solid ${isSelected ? netColor : 'var(--b-default)'}`,
                            background: isSelected ? netColor : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, color: 'white', flexShrink: 0, transition: 'all 150ms',
                          }}>
                            {isSelected ? '✓' : ''}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
