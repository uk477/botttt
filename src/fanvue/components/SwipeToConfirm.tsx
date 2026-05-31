import { useCallback, useLayoutEffect, useRef, useState } from 'react'

const THUMB_W = 52
const PAD = 8
const COMMIT = 0.78

type Props = {
  lang: 'ru' | 'en'
  disabled?: boolean
  loading?: boolean
  onConfirm: () => void
}

export default function SwipeToConfirm({ lang, disabled, loading, onConfirm }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const maxXRef = useRef(0)
  const startXRef = useRef(0)
  const startOffRef = useRef(0)
  const posRef = useRef(0)
  const activeRef = useRef(false)
  const committedRef = useRef(false)
  const [committed, setCommitted] = useState(false)

  const locked = disabled || loading

  const measure = useCallback(() => {
    const w = trackRef.current?.clientWidth ?? 0
    maxXRef.current = Math.max(0, w - THUMB_W - PAD * 2)
  }, [])

  useLayoutEffect(() => {
    measure()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const applyPos = useCallback((x: number) => {
    posRef.current = x
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translateX(${x}px)`
      thumbRef.current.style.transition = activeRef.current ? 'none' : 'transform 0.22s ease-out'
    }
    if (fillRef.current) {
      fillRef.current.style.width = `${THUMB_W + PAD + x}px`
    }
    const max = maxXRef.current
    const progress = max > 0 ? x / max : 0
    if (labelRef.current) {
      if (loading) {
        labelRef.current.textContent = lang === 'ru' ? 'Отправка…' : 'Sending…'
      } else if (progress >= COMMIT) {
        labelRef.current.textContent = lang === 'ru' ? 'Отпустите' : 'Release'
      } else {
        labelRef.current.textContent = lang === 'ru' ? 'Сдвиньте →' : 'Slide →'
      }
    }
  }, [lang, loading])

  const reset = useCallback(() => {
    activeRef.current = false
    committedRef.current = false
    setCommitted(false)
    applyPos(0)
  }, [applyPos])

  const doCommit = useCallback(() => {
    if (locked || committedRef.current) return
    committedRef.current = true
    setCommitted(true)
    measure()
    applyPos(maxXRef.current)
    onConfirm()
  }, [locked, measure, applyPos, onConfirm])

  const handleStart = useCallback((clientX: number) => {
    if (locked || committedRef.current) return
    measure()
    startXRef.current = clientX
    startOffRef.current = posRef.current
    activeRef.current = true
  }, [locked, measure])

  const handleMove = useCallback((clientX: number) => {
    if (!activeRef.current || locked) return
    const next = startOffRef.current + (clientX - startXRef.current)
    const clamped = Math.min(Math.max(next, 0), maxXRef.current)
    applyPos(clamped)
  }, [locked, applyPos])

  const handleEnd = useCallback(() => {
    if (!activeRef.current || locked) return
    activeRef.current = false
    const max = maxXRef.current
    const progress = max > 0 ? posRef.current / max : 0
    if (progress >= COMMIT) {
      doCommit()
    } else {
      applyPos(0)
    }
  }, [locked, doCommit, applyPos])

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return

    let pointerId: number | null = null
    let touchId: number | null = null
    let pointerUsed = false

    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (locked || committedRef.current) return
      if (pointerId !== null) return
      if (touchId !== null) return
      e.preventDefault()
      e.stopPropagation()
      pointerId = e.pointerId
      pointerUsed = true
      try { el.setPointerCapture(e.pointerId) } catch { /* */ }
      handleStart(e.clientX)
    }

    const onPointerMove = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return
      e.preventDefault()
      e.stopPropagation()
      handleMove(e.clientX)
    }

    const onPointerUp = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return
      e.stopPropagation()
      pointerId = null
      try { el.releasePointerCapture(e.pointerId) } catch { /* */ }
      handleEnd()
    }

    const onPointerCancel = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      try { el.releasePointerCapture(e.pointerId) } catch { /* */ }
      if (activeRef.current) {
        activeRef.current = false
        applyPos(0)
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      if (locked || committedRef.current) return
      if (pointerUsed) return
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      touchId = t.identifier
      handleStart(t.clientX)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (touchId === null) return
      const t = Array.from(e.changedTouches).find((x) => x.identifier === touchId)
      if (!t) return
      if (e.cancelable) e.preventDefault()
      handleMove(t.clientX)
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (touchId === null) return
      const t = Array.from(e.changedTouches).find((x) => x.identifier === touchId)
      if (!t) return
      touchId = null
      handleEnd()
    }

    const onTouchCancel = () => {
      if (touchId === null) return
      touchId = null
      if (activeRef.current) {
        activeRef.current = false
        applyPos(0)
      }
    }

    el.addEventListener('pointerdown', onPointerDown, { passive: false })
    el.addEventListener('pointermove', onPointerMove, { passive: false })
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchCancel)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [locked, handleStart, handleMove, handleEnd, applyPos])

  useLayoutEffect(() => {
    if (loading) {
      if (labelRef.current) labelRef.current.textContent = lang === 'ru' ? 'Отправка…' : 'Sending…'
    }
  }, [loading, lang])

  const defaultLabel = loading
    ? (lang === 'ru' ? 'Отправка…' : 'Sending…')
    : (lang === 'ru' ? 'Сдвиньте →' : 'Slide →')

  return (
    <div
      ref={trackRef}
      className={`swipe-confirm${locked ? ' is-disabled' : ''}${committed ? ' is-committed' : ''}`}
    >
      <div
        ref={fillRef}
        className="swipe-confirm__fill"
        style={{ width: THUMB_W + PAD }}
      />
      <span ref={labelRef} className="swipe-confirm__label">{defaultLabel}</span>
      <div
        ref={thumbRef}
        className="swipe-confirm__thumb"
        style={{ transform: 'translateX(0px)', transition: 'transform 0.22s ease-out' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}
