import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { useTelegram } from '../hooks/useTelegram'

type Lang = 'ru' | 'en'

const items = [
  { path: '/',        label: { ru: 'Маркет',  en: 'Market' },  icon: MarketIcon },
  { path: '/profile', label: { ru: 'Профиль', en: 'Profile' }, icon: ProfileIcon },
] as const

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const lang = useStore((s) => s.lang) as Lang
  const supportUnread = useStore((s) => s.supportUnread)
  const { haptic } = useTelegram()

  const activeIdx = items.findIndex((it) =>
    it.path === '/' ? location.pathname === '/' || location.pathname.startsWith('/market') : location.pathname.startsWith(it.path),
  )

  const [peeking, setPeeking] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number>(activeIdx === -1 ? 0 : activeIdx)
  const [snapIdx, setSnapIdx] = useState<number | null>(null)

  const innerRef = useRef<HTMLDivElement | null>(null)
  const pillRef = useRef<HTMLSpanElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const smoothRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number; idx: number } | null>(null)
  const movedRef = useRef(false)
  const peekingRef = useRef(false)
  const lastIdxRef = useRef<number>(-1)
  const pendingXRef = useRef<number | null>(null)
  const pillXRef = useRef(0)
  const targetXRef = useRef(0)
  const snapIdxRef = useRef<number | null>(null)
  // Cached layout
  const layoutRef = useRef<{ left: number; pillW: number; gap: number; centers: number[] } | null>(null)

  const measure = () => {
    const root = innerRef.current
    if (!root) return null
    const rect = root.getBoundingClientRect()
    const btns = root.querySelectorAll<HTMLElement>('[data-nav-btn]')
    const centers: number[] = []
    let pillW = 0
    btns.forEach((el) => {
      const r = el.getBoundingClientRect()
      centers.push((r.left + r.right) / 2 - rect.left)
      if (!pillW) pillW = r.width
    })
    layoutRef.current = { left: rect.left, pillW, gap: 0, centers }
    return layoutRef.current
  }

  const idxFromClientX = (clientX: number): number => {
    const L = layoutRef.current ?? measure()
    if (!L) return 0
    const localX = clientX - L.left
    let best = 0
    let bestD = Infinity
    L.centers.forEach((c, i) => {
      const d = Math.abs(localX - c)
      if (d < bestD) { best = i; bestD = d }
    })
    return best
  }

  const setPillX = (x: number) => {
    pillXRef.current = x
    if (pillRef.current) pillRef.current.style.transform = `translate3d(${x}px, 0, 0)`
  }

  const stopSmoothPill = () => {
    if (smoothRef.current != null) {
      cancelAnimationFrame(smoothRef.current)
      smoothRef.current = null
    }
  }

  const animatePill = () => {
    smoothRef.current = null
    const delta = targetXRef.current - pillXRef.current
    const next = Math.abs(delta) < 0.45 ? targetXRef.current : pillXRef.current + delta * 0.36
    setPillX(next)
    if (peekingRef.current && Math.abs(targetXRef.current - next) > 0.45) {
      smoothRef.current = requestAnimationFrame(animatePill)
    }
  }

  const xFromClient = (clientX: number) => {
    const L = layoutRef.current ?? measure()
    if (!L) return null
    const localX = clientX - L.left
    const half = L.pillW / 2
    // Clamp pill center to first/last button center
    const min = L.centers[0]
    const max = L.centers[L.centers.length - 1]
    const cx = Math.max(min, Math.min(max, localX))
    return cx - half
  }

  const positionPill = (clientX: number, immediate = false) => {
    const x = xFromClient(clientX)
    if (x == null) return
    targetXRef.current = x
    if (immediate) {
      stopSmoothPill()
      setPillX(x)
      return
    }
    if (smoothRef.current == null) smoothRef.current = requestAnimationFrame(animatePill)
  }

  const snapPillToIdx = (i: number) => {
    const L = layoutRef.current ?? measure()
    if (!L || !pillRef.current) return
    const half = L.pillW / 2
    targetXRef.current = L.centers[i] - half
    stopSmoothPill()
    setPillX(targetXRef.current)
  }

  const setHover = (i: number) => {
    if (i !== lastIdxRef.current) {
      lastIdxRef.current = i
      setHoverIdx(i)
      haptic('light')
    }
  }

  const close = () => {
    peekingRef.current = false
    setPeeking(false)
    snapIdxRef.current = null
    setSnapIdx(null)
    // Snap pill to active tab so it stays under the lit button
    const i = activeIdx === -1 ? 0 : activeIdx
    requestAnimationFrame(() => snapPillToIdx(i))
  }

  const beginPeek = (e: React.PointerEvent<HTMLButtonElement>) => {
    measure()
    snapIdxRef.current = null
    setSnapIdx(null)
    peekingRef.current = true
    setPeeking(true)
    haptic('medium')
    positionPill(e.clientX, true)
    setHover(idxFromClientX(e.clientX))
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* ignore */ }
  }

  const onPointerDown = (idx: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    startRef.current = { x: e.clientX, y: e.clientY, idx }
    movedRef.current = false
    peekingRef.current = false
    lastIdxRef.current = idx
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (movedRef.current) return
      beginPeek(e)
    }, 200)
  }

  const flushPosition = () => {
    rafRef.current = null
    const x = pendingXRef.current
    if (x == null) return
    pendingXRef.current = null
    positionPill(x)
    setHover(idxFromClientX(x))
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (!peekingRef.current) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        if (timerRef.current) window.clearTimeout(timerRef.current)
        beginPeek(e)
      } else if (Math.hypot(dx, dy) > 10) {
        movedRef.current = true
        if (timerRef.current) window.clearTimeout(timerRef.current)
        return
      }
    }
    if (peekingRef.current) {
      e.preventDefault()
      pendingXRef.current = e.clientX
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushPosition)
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    stopSmoothPill()
    if (peekingRef.current) {
      e.preventDefault()
      const i = idxFromClientX(e.clientX)
      snapIdxRef.current = i
      setSnapIdx(i)
      setHoverIdx(i)
      // Exit peek with the snap target locked, so React cannot first reset the pill to the old route.
      peekingRef.current = false
      setPeeking(false)
      // Suppress the ghost click that would otherwise fire on the original button
      // and navigate back to the starting tab.
      movedRef.current = true
      window.setTimeout(() => { movedRef.current = false }, 400)
      requestAnimationFrame(() => snapPillToIdx(i))
      const target = items[i]
      if (target && i !== activeIdx) {
        haptic('success')
        // Navigate after the snap animation has had time to play
        window.setTimeout(() => navigate(target.path), 180)
      } else {
        haptic('light')
      }
    }
    startRef.current = null
  }

  const onPointerCancel = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    stopSmoothPill()
    if (peekingRef.current) close()
    startRef.current = null
  }

  // Sync hover + pill position to active when route changes & not peeking
  useEffect(() => {
    if (peeking) return
    const i = snapIdxRef.current ?? (activeIdx === -1 ? 0 : activeIdx)
    setHoverIdx(i)
    // Wait a frame for layout to be ready (esp. on first mount)
    requestAnimationFrame(() => {
      if (!layoutRef.current) measure()
      snapPillToIdx(i)
    })
  }, [activeIdx, peeking, snapIdx])

  useEffect(() => {
    if (snapIdx == null) return
    const routeIdx = activeIdx === -1 ? 0 : activeIdx
    if (snapIdx !== routeIdx) return
    const t = window.setTimeout(() => {
      snapIdxRef.current = null
      setSnapIdx(null)
    }, 260)
    return () => window.clearTimeout(t)
  }, [activeIdx, snapIdx])

  // Re-measure on resize
  useEffect(() => {
    const onResize = () => { layoutRef.current = null }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    stopSmoothPill()
  }, [])

  // Close on scroll
  useEffect(() => {
    if (!peeking) return
    const onScroll = () => close()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [peeking])

  const handleClick = (path: string) => (e: React.MouseEvent) => {
    if (peekingRef.current || movedRef.current) {
      e.preventDefault()
      return
    }
    navigate(path)
  }

  const pillIdx = peeking ? hoverIdx : (snapIdx ?? (activeIdx === -1 ? -1 : activeIdx))

  return (
    <nav className="fv-nav" aria-label="Primary navigation">
      <div ref={innerRef} className={`fv-nav-inner ${peeking ? 'is-peeking' : ''}`} role="tablist">
        {pillIdx >= 0 && (
          <span
            ref={pillRef}
            className={`fv-nav-pill2 ${peeking ? 'is-peek' : ''}`}
            style={{ width: `calc((100% - 12px - 12px) / ${items.length})` }}
            aria-hidden
          />
        )}
        {items.map((item, i) => {
          const Icon = item.icon
          const lit = pillIdx === i
          return (
            <button
              key={item.path}
              data-nav-btn
              className={lit ? 'is-active' : ''}
              onClick={handleClick(item.path)}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onContextMenu={(e) => e.preventDefault()}
              style={{ touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' }}
              role="tab"
              aria-selected={lit}
              aria-label={`${item.label[lang]}${item.path === '/profile' && supportUnread > 0 ? ` (${supportUnread})` : ''}`}
              tabIndex={lit ? 0 : -1}
            >
              <Icon />
              <span>{item.label[lang]}</span>
              {item.path === '/profile' && supportUnread > 0 && <i aria-label={`${supportUnread} unread`} />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function MarketIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M5 10h14l-1 9H6l-1-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M8 10a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
}
function ProfileIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path d="M4.5 20c1.4-4 4-6 7.5-6s6.1 2 7.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
}
