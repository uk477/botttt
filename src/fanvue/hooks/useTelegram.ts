type HapticImpact = 'light' | 'medium' | 'heavy'
type HapticNotification = 'success' | 'error' | 'warning'

interface TgWebApp {
  HapticFeedback?: {
    impactOccurred: (style: HapticImpact) => void
    notificationOccurred: (type: HapticNotification) => void
    selectionChanged: () => void
  }
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  enableClosingConfirmation?: () => void
  ready?: () => void
  expand?: () => void
  close?: () => void
  initDataUnsafe?: {
    user?: { id?: number; username?: string; first_name?: string; last_name?: string; photo_url?: string; language_code?: string }
    start_param?: string
  }
}

function getTg(): TgWebApp | undefined {
  return (window as Window & { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp
}

// Module-level singleton handler so we never stack multiple BackButton callbacks
// on the Telegram WebApp. Telegram's BackButton.onClick is additive — without
// this, fast route changes could double-register or end up with a stale handler
// after offClick is called with a different function reference.
let activeBackHandler: (() => void) | null = null
function setActiveBackHandler(cb: (() => void) | null) {
  const tg = getTg()
  if (activeBackHandler && tg?.BackButton) {
    try { tg.BackButton.offClick(activeBackHandler) } catch { /* ignore */ }
  }
  activeBackHandler = cb
  if (cb && tg?.BackButton) {
    try { tg.BackButton.onClick(cb); tg.BackButton.show() } catch { /* ignore */ }
  } else if (!cb && tg?.BackButton) {
    try { tg.BackButton.hide() } catch { /* ignore */ }
  }
}

export function useTelegram() {
  const haptic = (type: HapticImpact | HapticNotification = 'light') => {
    try {
      const tg = getTg()
      if (!tg?.HapticFeedback) return
      if (type === 'success' || type === 'error' || type === 'warning') {
        tg.HapticFeedback.notificationOccurred(type)
      } else {
        tg.HapticFeedback.impactOccurred(type)
      }
    } catch {
      /* ignore — running outside Telegram */
    }
  }

  const init = () => {
    try {
      const tg = getTg()
      tg?.ready?.()
      tg?.expand?.()
      tg?.setHeaderColor?.('#050510')
      tg?.setBackgroundColor?.('#050510')

      const applyTgTop = () => {
        const r = getTg() as Record<string, unknown> | undefined
        if (!r) return
        const csa = r.contentSafeAreaInset as { top?: number } | undefined
        const sai = r.safeAreaInset as { top?: number } | undefined
        // Telegram reports both device safe area (notch) and content safe area
        // (Telegram header). Use the largest single value rather than summing —
        // summing pushes the hero way down inside the WebView. Cap to 28px so
        // the layout stays compact like the preview.
        const top = Math.max(csa?.top ?? 0, sai?.top ?? 0)
        const val = Math.min(top > 0 ? top : 14, 28)
        document.documentElement.style.setProperty('--tg-top', `${val}px`)
      }

      applyTgTop()

      const onSafeArea = () => applyTgTop()
      try { (tg as any).onEvent?.('contentSafeAreaChanged', onSafeArea) } catch {}
      try { (tg as any).onEvent?.('safeAreaChanged', onSafeArea) } catch {}

      setTimeout(applyTgTop, 300)
    } catch {
      /* ignore */
    }
  }

  const showBackButton = (cb: () => void) => {
    setActiveBackHandler(cb)
    return () => setActiveBackHandler(null)
  }

  return { haptic, init, showBackButton, tg: getTg() }
}
