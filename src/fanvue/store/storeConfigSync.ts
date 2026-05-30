import { CONFIG } from '../config'
import type { CryptoNetwork } from './types'
import type { SiteContent, SiteLinks } from './types'

export type PublicStoreConfig = {
  maintenance?: boolean
  addresses?: Partial<Record<CryptoNetwork, string>>
  siteLinks?: Partial<SiteLinks>
  siteContent?: Partial<SiteContent>
  photos?: Record<string, string>
  qrOverrides?: Partial<Record<CryptoNetwork, string>>
  refWithdrawNetworks?: CryptoNetwork[]
}

export function defaultSiteLinks(): SiteLinks {
  return {
    supportUrl: `https://t.me/${CONFIG.supportUsername}`,
    adminUrl: `https://t.me/${CONFIG.adminUsername}`,
    chatUrl: `https://t.me/${CONFIG.communityUsername}`,
    communityUrl: `https://t.me/${CONFIG.communityUsername}`,
    channelUrl: `https://t.me/${CONFIG.channelUsername}`,
    reviewsUrl: '',
    botUrl: `https://t.me/${CONFIG.botUsername}`,
    securityInstructionUrl: '',
  }
}

export function mergeStoreConfigPatch(
  current: {
    cryptoAddresses: Record<CryptoNetwork, string>
    siteLinks: SiteLinks
    siteContent: SiteContent
    photos: Record<string, string>
    qrOverrides: Partial<Record<CryptoNetwork, string>>
    refWithdrawNetworks: CryptoNetwork[]
    maintenance: boolean
  },
  cfg: PublicStoreConfig | null | undefined,
): Partial<typeof current> {
  if (!cfg || typeof cfg !== 'object') return {}
  const patch: Partial<typeof current> = {}

  if (typeof cfg.maintenance === 'boolean') {
    patch.maintenance = cfg.maintenance
  }
  if (cfg.addresses && typeof cfg.addresses === 'object') {
    patch.cryptoAddresses = { ...current.cryptoAddresses, ...cfg.addresses } as Record<CryptoNetwork, string>
  }
  if (cfg.siteLinks && typeof cfg.siteLinks === 'object') {
    patch.siteLinks = { ...defaultSiteLinks(), ...current.siteLinks, ...cfg.siteLinks }
  }
  if (cfg.siteContent && typeof cfg.siteContent === 'object') {
    patch.siteContent = { ...current.siteContent, ...cfg.siteContent }
  }
  if (cfg.photos && typeof cfg.photos === 'object') {
    patch.photos = { ...current.photos, ...cfg.photos }
  }
  if (cfg.qrOverrides && typeof cfg.qrOverrides === 'object') {
    patch.qrOverrides = { ...current.qrOverrides, ...cfg.qrOverrides }
  }
  if (Array.isArray(cfg.refWithdrawNetworks) && cfg.refWithdrawNetworks.length > 0) {
    patch.refWithdrawNetworks = cfg.refWithdrawNetworks as CryptoNetwork[]
  }

  return patch
}
