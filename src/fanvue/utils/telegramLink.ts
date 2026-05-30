/** Normalize admin-configured Telegram URLs (public, @user, t.me/+private). */
export function normalizeTelegramUrl(raw: string | undefined | null): string {
  const u = (raw ?? '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('t.me/')) return `https://${u}`
  if (u.startsWith('@')) return `https://t.me/${u.slice(1)}`
  return `https://t.me/${u.replace(/^\/+/, '')}`
}

export function openTelegramUrl(
  url: string | undefined | null,
  fallbackUsername?: string,
): void {
  const href = normalizeTelegramUrl(url) || (fallbackUsername ? normalizeTelegramUrl(`@${fallbackUsername.replace('@', '')}`) : '')
  if (href) window.open(href, '_blank', 'noopener,noreferrer')
}

export function openTelegramWithText(
  url: string | undefined | null,
  text: string,
  fallbackUsername?: string,
): void {
  const base = normalizeTelegramUrl(url) || (fallbackUsername ? normalizeTelegramUrl(`@${fallbackUsername.replace('@', '')}`) : '')
  if (!base) return
  try {
    const u = new URL(base)
    u.searchParams.set('text', text)
    window.open(u.toString(), '_blank', 'noopener,noreferrer')
  } catch {
    const sep = base.includes('?') ? '&' : '?'
    window.open(`${base}${sep}text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }
}

export function botReferralLink(
  botUrl: string | undefined | null,
  uid: string,
  fallbackBotUsername?: string,
): string {
  const base = normalizeTelegramUrl(botUrl)
    || (fallbackBotUsername ? normalizeTelegramUrl(`@${fallbackBotUsername.replace('@', '')}`) : '')
  if (!base) return ''
  try {
    const u = new URL(base)
    u.searchParams.set('start', `ref${uid}`)
    return u.toString()
  } catch {
    return `${base}?start=ref${uid}`
  }
}
