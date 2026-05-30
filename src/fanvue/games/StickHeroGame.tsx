import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import { useTelegram } from '../hooks/useTelegram'


/* ───────── constants ───────── */
const STICK_GROW = 240
const STICK_FALL = 760
const HERO_WALK  = 210
const PLAT_Y_FROM_BOTTOM = 140
const PLAT_H = 220
const HERO_W = 36
const HERO_H = 58
const MIN_GAP = 60
const MAX_GAP = 220
const MIN_PW = 28
const MAX_PW = 110
const PERFECT_R = 8
const EGG_SCORE = 20

type HeroMode = 'idle' | 'walk' | 'stumble' | 'scared' | 'dizzy'

type Phase =
  | 'name' | 'waiting' | 'growing' | 'falling' | 'walking'
  | 'camera' | 'falling_off' | 'gameover'
  | 'egg_stumble' | 'egg_fall' | 'egg_impact' | 'egg_flip' | 'egg_unflip' | 'egg_land'
interface Plat { x: number; w: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }

interface GameState {
  phase: Phase
  cur: Plat
  next: Plat
  stickLen: number
  stickAngle: number
  heroX: number
  heroY: number
  heroVy: number
  heroRot: number
  walkPhase: number       // for legs
  capWobble: number       // base wobble timer
  cameraX: number
  cameraStartX: number
  cameraTargetX: number
  cameraT: number
  cameraDur: number
  cameraDone?: () => void
  score: number
  last: number
  perfect: boolean
  perfectFlash: number
  particles: Particle[]
  bgT: number
  shake: number
  eggDone: boolean
  eggT: number
}

export default function StickHeroGame({ onExit }: { onExit: () => void }) {
  const lang = useStore((s) => s.lang)
  const scores = useStore((s) => s.stickHeroScores)
  const addScore = useStore((s) => s.addStickHeroScore)
  const savedName = useStore((s) => s.stickHeroName)
  const setSavedName = useStore((s) => s.setStickHeroName)
  const { haptic } = useTelegram()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const submittedRef = useRef(false)
  const [score, setScore] = useState(0)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [over, setOver] = useState(false)
  const [needName, setNeedName] = useState(!savedName)
  const [nameInput, setNameInput] = useState('')
  const [flipped, setFlipped] = useState(false)

  // Hide global bottom nav while the game is open
  useEffect(() => {
    document.body.classList.add('fv-game-open')
    return () => { document.body.classList.remove('fv-game-open') }
  }, [])

  const stRef = useRef<GameState>({
    phase: needName ? 'name' : 'waiting',
    cur: { x: 30, w: 90 },
    next: { x: 200, w: 70 },
    stickLen: 0,
    stickAngle: 0,
    heroX: 30 + 90 - HERO_W,
    heroY: 0,
    heroVy: 0,
    heroRot: 0,
    walkPhase: 0,
    capWobble: 0,
    cameraX: 0,
    cameraStartX: 0,
    cameraTargetX: 0,
    cameraT: 0,
    cameraDur: 0.35,
    score: 0,
    last: 0,
    perfect: false,
    perfectFlash: 0,
    particles: [],
    bgT: 0,
    shake: 0,
    eggDone: false,
    eggT: 0,
  })

  // Resize
  useEffect(() => {
    const cvs = canvasRef.current!; const wrap = wrapRef.current!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight
      cvs.width = Math.floor(w * dpr); cvs.height = Math.floor(h * dpr)
      cvs.style.width = w + 'px'; cvs.style.height = h + 'px'
      cvs.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize(); window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Game loop
  useEffect(() => {
    const cvs = canvasRef.current!
    const ctx = cvs.getContext('2d')!
    let raf = 0; let alive = true

    const spawnNext = () => {
      const st = stRef.current
      // mild difficulty: gaps grow slightly, widths shrink slightly with score (but capped — original-feel)
      const diff = Math.min(1, st.score / 30)
      const minG = MIN_GAP + diff * 20
      const maxG = MAX_GAP - diff * 30
      const minW = MIN_PW
      const maxW = MAX_PW - diff * 40
      const gap = minG + Math.random() * Math.max(40, maxG - minG)
      const w = minW + Math.random() * Math.max(20, maxW - minW)
      st.next = { x: st.cur.x + st.cur.w + gap, w }
    }

    const emitParticles = (x: number, y: number, color: string, n = 18) => {
      const st = stRef.current
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 80 + Math.random() * 220
        st.particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
          life: 0, max: 0.6 + Math.random() * 0.4, color,
          size: 1.5 + Math.random() * 2.5,
        })
      }
    }

    const draw = () => {
      const W = cvs.clientWidth, H = cvs.clientHeight
      const st = stRef.current

      // animated bg
      const t = st.bgT
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#0a0d12')
      g.addColorStop(0.5, `hsl(${(t * 8) % 360}, 25%, 9%)`)
      g.addColorStop(1, '#070a0e')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

      // floating orbs
      for (let i = 0; i < 3; i++) {
        const ox = (W * (0.2 + i * 0.3)) + Math.sin(t * 0.6 + i) * 30
        const oy = H * 0.25 + Math.cos(t * 0.4 + i * 1.7) * 40
        const r = 90 + i * 25
        const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, r)
        const hue = (t * 12 + i * 120) % 360
        og.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.10)`)
        og.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = og; ctx.fillRect(0, 0, W, H)
      }

      // stars
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      const seed = Math.floor(st.cameraX / 4)
      for (let i = 0; i < 50; i++) {
        const sx = ((i * 73 + seed) % W)
        const sy = (i * 131) % (H - PLAT_Y_FROM_BOTTOM - 60)
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))
        ctx.globalAlpha = tw
        ctx.fillRect(sx, sy, 1.3, 1.3)
      }
      ctx.globalAlpha = 1

      // shake
      const shakeX = st.shake > 0 ? (Math.random() - 0.5) * st.shake * 8 : 0
      const shakeY = st.shake > 0 ? (Math.random() - 0.5) * st.shake * 8 : 0

      ctx.save()
      ctx.translate(-st.cameraX + shakeX, shakeY)

      const groundY = H - PLAT_Y_FROM_BOTTOM
      drawPlatform(ctx, st.cur, groundY, t)
      drawPlatform(ctx, st.next, groundY, t)

      // perfect target dot pulse
      const pulse = 0.5 + 0.5 * Math.sin(t * 5)
      ctx.fillStyle = `rgba(255,255,255,${0.4 + pulse * 0.5})`
      ctx.beginPath()
      ctx.arc(st.next.x + st.next.w / 2, groundY + 6, 1.8 + pulse * 1.2, 0, Math.PI * 2)
      ctx.fill()

      // stick
      const sx = st.cur.x + st.cur.w
      ctx.save()
      ctx.translate(sx, groundY)
      ctx.rotate((-90 + st.stickAngle) * Math.PI / 180)
      const sg = ctx.createLinearGradient(0, 0, st.stickLen, 0)
      sg.addColorStop(0, '#39ff63'); sg.addColorStop(1, '#7bffb8')
      ctx.strokeStyle = sg
      ctx.lineWidth = 4; ctx.lineCap = 'round'
      ctx.shadowColor = 'rgba(57,255,99,0.7)'; ctx.shadowBlur = 12
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(st.stickLen, 0); ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()

      // particles
      for (const p of st.particles) {
        const a = 1 - p.life / p.max
        ctx.globalAlpha = a
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      // motion blur trail behind hero while plunging
      if (st.phase === 'egg_fall' && st.heroVy > 200) {
        const trails = 6
        for (let i = 1; i <= trails; i++) {
          const k = i / trails
          ctx.globalAlpha = 0.18 * (1 - k)
          drawHero(
            ctx,
            st.heroX,
            groundY + st.heroY - st.heroVy * 0.012 * k,
            st.heroRot - 28 * k,
            st.walkPhase, st.capWobble, false, 'scared',
          )
        }
        ctx.globalAlpha = 1
      }

      // hero
      const heroMode: HeroMode =
        st.phase === 'egg_stumble' ? 'stumble' :
        st.phase === 'egg_fall'    ? 'scared'  :
        st.phase === 'egg_land'    ? 'dizzy'   :
        st.phase === 'walking'     ? 'walk'    : 'idle'
      drawHero(ctx, st.heroX, groundY + st.heroY, st.heroRot, st.walkPhase, st.capWobble, st.phase === 'walking', heroMode)

      ctx.restore()

      // perfect flash
      if (st.perfectFlash > 0) {
        ctx.fillStyle = `rgba(57,255,99,${st.perfectFlash * 0.22})`
        ctx.fillRect(0, 0, W, H)
      }

      // vignette
      const vg = ctx.createRadialGradient(W * 0.5, H * 0.55, H * 0.3, W * 0.5, H * 0.55, H * 0.85)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,0,0,0.55)')
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
    }

    const tick = (t: number) => {
      if (!alive) return
      const st = stRef.current
      const dt = Math.min(0.05, (t - st.last) / 1000)
      st.last = t
      st.bgT += dt
      st.capWobble += dt
      if (st.perfectFlash > 0) st.perfectFlash = Math.max(0, st.perfectFlash - dt * 2.4)
      if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 3)

      // particles
      for (const p of st.particles) {
        p.life += dt
        p.vy += 480 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
      }
      st.particles = st.particles.filter((p) => p.life < p.max)

      const H = cvs.clientHeight
      const groundY = H - PLAT_Y_FROM_BOTTOM

      if (st.phase === 'growing') {
        st.stickLen += STICK_GROW * dt
      } else if (st.phase === 'falling') {
        st.stickAngle += STICK_FALL * dt
        if (st.stickAngle >= 90) {
          st.stickAngle = 90
          const tip = st.cur.x + st.cur.w + st.stickLen
          const nL = st.next.x, nR = st.next.x + st.next.w
          if (tip >= nL && tip <= nR) {
            const center = nL + st.next.w / 2
            st.perfect = Math.abs(tip - center) <= PERFECT_R
            if (st.perfect) {
              st.score += 2; st.perfectFlash = 1; haptic('success')
              emitParticles(center, groundY, '#ffcb3a', 22)
            } else {
              st.score += 1; haptic('light')
              emitParticles(tip, groundY, '#39ff63', 8)
            }
            setScore(st.score)
            st.phase = 'walking'
          } else {
            haptic('error'); st.shake = 1
            st.phase = 'falling_off'
          }
        }
      } else if (st.phase === 'walking') {
        const target = st.next.x + st.next.w - HERO_W
        const dir = target > st.heroX ? 1 : -1
        st.heroX += dir * HERO_WALK * dt
        st.walkPhase += dt * 11
        if ((dir > 0 && st.heroX >= target) || (dir < 0 && st.heroX <= target)) {
          st.heroX = target
          st.walkPhase = 0
          // Easter egg at exactly EGG_SCORE — fake fall + flip
          if (!st.eggDone && st.score >= EGG_SCORE) {
            st.eggDone = true
            st.heroVy = 0; st.heroY = 0; st.heroRot = 0
            st.eggT = 0
            st.phase = 'egg_stumble'
            haptic('warning')
          } else {
            animateCamera(st, () => {
              st.cur = { ...st.next }
              st.heroX = st.cur.x + st.cur.w - HERO_W
              st.cameraX = st.cur.x - 30
              spawnNext()
              st.stickLen = 0
              st.stickAngle = 0
              st.phase = 'waiting'
            })
          }
        }
      } else if (st.phase === 'camera') {
        cameraTween(st, dt)
      } else if (st.phase === 'egg_stumble') {
        // teeter on the edge — losing balance, arms flailing
        st.eggT += dt
        const wobble = Math.sin(st.eggT * 22)
        st.heroRot = wobble * 12 * Math.min(1, st.eggT * 2)
        st.heroX = (st.cur.x + st.cur.w - HERO_W) + wobble * 1.6
        st.shake = Math.max(st.shake, 0.25)
        // tiny dust puffs at feet
        if (Math.random() < 0.4) {
          emitParticles(st.heroX + HERO_W/2, groundY - 1, 'rgba(180,200,180,0.6)', 1)
        }
        if (st.eggT > 0.85) {
          // tip over — start the real plunge
          st.eggT = 0
          st.heroVy = -260 // little hop up first for drama
          st.heroRot = -18
          st.phase = 'egg_fall'
          haptic('warning')
          // big dust burst on platform edge
          for (let i = 0; i < 16; i++) {
            const a = -Math.PI/2 + (Math.random() - 0.5) * Math.PI
            const sp = 60 + Math.random() * 120
            st.particles.push({
              x: st.heroX + HERO_W/2, y: groundY,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              life: 0, max: 0.7 + Math.random() * 0.4,
              color: i % 3 === 0 ? '#39ff63' : 'rgba(200,210,200,0.85)',
              size: 1.5 + Math.random() * 2.5,
            })
          }
        }
      } else if (st.phase === 'egg_fall') {
        // dramatic plunge — strong gravity, spin, trail, growing shake
        st.eggT += dt
        st.heroVy += 2200 * dt
        st.heroY += st.heroVy * dt
        st.heroRot += 460 * dt
        st.shake = Math.max(st.shake, Math.min(1.2, 0.2 + st.eggT * 0.9))
        // trail of green sparks
        if (Math.random() < 0.8) {
          st.particles.push({
            x: st.heroX + HERO_W/2 + (Math.random() - 0.5) * 6,
            y: groundY + st.heroY - 12 + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 40, vy: -st.heroVy * 0.15,
            life: 0, max: 0.4 + Math.random() * 0.3,
            color: Math.random() < 0.5 ? '#39ff63' : '#7bffb8',
            size: 1 + Math.random() * 1.8,
          })
        }
        if (st.heroY > 260) {
          st.phase = 'egg_impact'
          st.eggT = 0
          st.perfectFlash = 1.4
          st.shake = 1
          haptic('heavy')
        }
      } else if (st.phase === 'egg_impact') {
        // brief white-out, then world flips
        st.eggT += dt
        if (st.eggT > 0.18) {
          st.phase = 'egg_flip'
          st.eggT = 0
          setFlipped(true)
          haptic('medium')
        }
      } else if (st.phase === 'egg_flip') {
        // hold the upside-down world a beat
        st.eggT += dt
        if (st.eggT > 1.1) {
          setFlipped(false)
          st.phase = 'egg_unflip'
          st.eggT = 0
        }
      } else if (st.phase === 'egg_unflip') {
        st.eggT += dt
        if (st.eggT > 0.55) {
          // hero "lands" back on the platform with a puff
          st.heroY = 0; st.heroVy = 0; st.heroRot = 0
          st.heroX = st.cur.x + st.cur.w - HERO_W
          st.shake = 0.6
          // landing dust ring
          for (let i = 0; i < 14; i++) {
            const a = -Math.PI/2 + (Math.random() - 0.5) * Math.PI * 0.9
            const sp = 50 + Math.random() * 100
            st.particles.push({
              x: st.heroX + HERO_W/2, y: groundY,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6,
              life: 0, max: 0.55 + Math.random() * 0.3,
              color: 'rgba(200,210,200,0.8)',
              size: 1.4 + Math.random() * 2,
            })
          }
          haptic('success')
          st.eggT = 0
          st.phase = 'egg_land'
        }
      } else if (st.phase === 'egg_land') {
        // dizzy beat, then continue
        st.eggT += dt
        st.heroRot = Math.sin(st.eggT * 8) * 4 * Math.max(0, 1 - st.eggT * 1.2)
        if (st.eggT > 0.7) {
          st.heroRot = 0
          animateCamera(st, () => {
            st.cur = { ...st.next }
            st.heroX = st.cur.x + st.cur.w - HERO_W
            st.cameraX = st.cur.x - 30
            spawnNext()
            st.stickLen = 0
            st.stickAngle = 0
            st.phase = 'waiting'
          })
        }
      } else if (st.phase === 'falling_off') {
        const tip = st.cur.x + st.cur.w + st.stickLen
        const target = tip - HERO_W / 2
        if (st.heroX < target - 1) {
          st.heroX += HERO_WALK * dt
        } else {
          st.heroVy += 1800 * dt
          st.heroY += st.heroVy * dt
          st.heroRot += 360 * dt
          if (st.heroY > 180) {
            st.phase = 'gameover'
            setOver(true)
            if (!submittedRef.current) {
              submittedRef.current = true
              addScore(st.score)
            }
          }
        }
      }

      draw()
      raf = requestAnimationFrame(tick)
    }

    stRef.current.last = performance.now()
    raf = requestAnimationFrame(tick)
    return () => { alive = false; cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pointer
  useEffect(() => {
    const wrap = wrapRef.current!
    const onDown = (e: PointerEvent) => {
      const st = stRef.current
      if (st.phase !== 'waiting') return
      st.phase = 'growing'; st.stickLen = 0; st.stickAngle = 0
      haptic('light'); e.preventDefault()
    }
    const onUp = (e: PointerEvent) => {
      const st = stRef.current
      if (st.phase !== 'growing') return
      st.phase = 'falling'; haptic('light'); e.preventDefault()
    }
    wrap.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      wrap.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restart = () => {
    const st = stRef.current
    st.cur = { x: 30, w: 90 }
    st.heroX = st.cur.x + st.cur.w - HERO_W
    st.heroY = 0; st.heroVy = 0; st.heroRot = 0
    st.next = { x: st.cur.x + st.cur.w + 80 + Math.random() * 60, w: 70 }
    st.cameraX = 0; st.phase = 'waiting'
    st.stickLen = 0; st.stickAngle = 0
    st.score = 0
    st.eggDone = false; st.eggT = 0; st.walkPhase = 0
    st.perfectFlash = 0; st.particles = []; st.shake = 0
    submittedRef.current = false
    setScore(0); setOver(false); setFlipped(false)
  }

  const submitName = () => {
    const v = nameInput.trim()
    if (v.length < 2) return
    setSavedName(v)
    setNeedName(false)
    stRef.current.phase = 'waiting'
    stRef.current.last = performance.now()
  }

  const top10 = [...scores].sort((a, b) => b.score - a.score).slice(0, 10)
  const best = top10[0]?.score ?? 0
  const T = (ru: string, en: string) => (lang === 'ru' ? ru : en)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: '#000', display: 'flex', flexDirection: 'column',
        touchAction: 'none', userSelect: 'none', overflow: 'hidden',
      }}
    >
      {/* HUD */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        <button onClick={onExit} style={hudBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          {T('Меню', 'Menu')}
        </button>

        <motion.div
          key={score}
          initial={{ scale: 1.25 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(20,24,30,0.7)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(57,255,99,0.22)',
            borderRadius: 14, padding: '6px 18px',
            boxShadow: '0 8px 24px rgba(57,255,99,0.12)',
          }}
        >
          <div style={{ fontSize: 10, color: '#7a8693', letterSpacing: '0.14em', fontWeight: 800 }}>SCORE</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#39ff63', lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: '0 0 12px rgba(57,255,99,0.5)' }}>{score}</div>
        </motion.div>

        <button onClick={() => setShowLeaderboard(true)} style={{ ...hudBtnStyle, padding: '8px 10px' }} aria-label="Top players">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffcb3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M17 4h3v3a4 4 0 0 1-4 4M7 4H4v3a4 4 0 0 0 4 4M17 4H7v6a5 5 0 0 0 10 0V4Z"/></svg>
        </button>
      </div>

      {savedName && best > 0 && !over && (
        <div style={{
          position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, color: '#7a8693', fontWeight: 600, zIndex: 4,
          background: 'rgba(20,24,30,0.55)', borderRadius: 8, padding: '3px 10px',
        }}>
          {T('Рекорд', 'Best')}: <b style={{ color: '#fff' }}>{best}</b> · @{savedName}
        </div>
      )}

      <AnimatePresence>
        {!needName && score === 0 && !over && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{
              position: 'absolute', bottom: 80, left: 0, right: 0,
              textAlign: 'center', color: 'rgba(255,255,255,0.7)',
              fontSize: 13, fontWeight: 600, pointerEvents: 'none', zIndex: 3,
            }}
          >
            {T('Удерживай экран — растягивай палку', 'Hold the screen — stretch the stick')}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={wrapRef}
        style={{
          flex: 1, position: 'relative',
          transform: flipped ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.65s cubic-bezier(0.65,0,0.35,1)',
          transformOrigin: 'center center',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>

      {/* Name modal */}
      <AnimatePresence>
        {needName && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              style={{
                background: 'linear-gradient(180deg,#10161e,#0a0e14)',
                border: '1px solid rgba(57,255,99,0.25)',
                borderRadius: 24, padding: 26, width: '100%', maxWidth: 340,
                color: '#fff', textAlign: 'center',
                boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(57,255,99,0.18)',
              }}
            >
              <div style={{ fontSize: 38, marginBottom: 6 }}>🎮</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
                {T('Как тебя звать?', 'What\'s your name?')}
              </div>
              <div style={{ fontSize: 12, color: '#7a8693', marginBottom: 16 }}>
                {T('Это имя попадёт в топ игроков. Спросим только один раз.', 'This name will be on the leaderboard. Asked only once.')}
              </div>
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.replace(/[^\p{L}\p{N}_\- .]/gu, '').slice(0, 16))}
                onKeyDown={(e) => { if (e.key === 'Enter') submitName() }}
                placeholder={T('твой ник', 'your nickname')}
                maxLength={16}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center',
                  outline: 'none', marginBottom: 14,
                }}
              />
              <button
                onClick={submitName}
                disabled={nameInput.trim().length < 2}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12,
                  background: nameInput.trim().length < 2 ? 'rgba(57,255,99,0.25)' : 'linear-gradient(180deg,#39ff63,#1fe07a)',
                  color: '#062612', fontWeight: 900, fontSize: 14,
                  opacity: nameInput.trim().length < 2 ? 0.5 : 1,
                  boxShadow: '0 8px 22px rgba(57,255,99,0.35)',
                }}
              >
                {T('Поехали', 'Let\'s go')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game over */}
      <AnimatePresence>
        {over && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 20,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              style={{
                background: 'linear-gradient(180deg,#10161e,#0a0e14)',
                border: '1px solid rgba(57,255,99,0.22)',
                borderRadius: 24, padding: 28, width: '100%', maxWidth: 340,
                textAlign: 'center', color: '#fff',
                boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(57,255,99,0.15)',
              }}
            >
              <div style={{ fontSize: 12, color: '#7a8693', letterSpacing: '0.18em', fontWeight: 700 }}>GAME OVER</div>
              <motion.div
                initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.05 }}
                style={{ fontSize: 64, fontWeight: 900, color: '#39ff63', margin: '8px 0', lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: '0 0 24px rgba(57,255,99,0.5)' }}
              >{score}</motion.div>
              <div style={{ fontSize: 13, color: '#a8b2bf', marginBottom: 18 }}>
                {score >= best && score > 0
                  ? '🏆 ' + T('Новый рекорд!', 'New record!')
                  : T(`Рекорд: ${best}`, `Best: ${best}`)}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowLeaderboard(true)} style={ghostBtnStyle}>{T('Топ', 'Top')}</button>
                <button onClick={restart} style={primaryBtnStyle}>{T('Ещё раз', 'Replay')}</button>
              </div>
              <button onClick={onExit} style={{
                marginTop: 10, width: '100%', padding: '10px',
                background: 'transparent', color: '#7a8693',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
              }}>{T('ВЫЙТИ В МЕНЮ', 'EXIT TO MENU')}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowLeaderboard(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 30,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(180deg,#11181f,#0a0e14)',
                border: '1px solid rgba(57,255,99,0.2)',
                borderRadius: 22, padding: 22, width: '100%', maxWidth: 360,
                color: '#fff', boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffcb3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M17 4h3v3a4 4 0 0 1-4 4M7 4H4v3a4 4 0 0 0 4 4M17 4H7v6a5 5 0 0 0 10 0V4Z"/></svg>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{T('Топ игроков', 'Top players')}</div>
                </div>
                <button onClick={() => setShowLeaderboard(false)} style={{ color: '#7a8693', fontSize: 20, padding: 4 }}>×</button>
              </div>
              {top10.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#7a8693', fontSize: 13 }}>
                  {T('Пока нет результатов. Сыграй первым!', 'No scores yet. Be the first!')}
                </div>
              ) : (
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {top10.map((s, i) => {
                    const isMe = savedName && s.name === savedName
                    return (
                      <motion.li
                        key={s.ts}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 10,
                          background: isMe ? 'rgba(57,255,99,0.12)' : i < 3 ? 'rgba(57,255,99,0.06)' : 'rgba(255,255,255,0.025)',
                          border: i === 0 ? '1px solid rgba(255,203,58,0.35)' : isMe ? '1px solid rgba(57,255,99,0.3)' : '1px solid transparent',
                        }}
                      >
                        <div style={{
                          width: 26, height: 26, borderRadius: 8,
                          display: 'grid', placeItems: 'center',
                          background: i === 0 ? '#ffcb3a' : i === 1 ? '#cfd6df' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.06)',
                          color: i < 3 ? '#0a0e14' : '#7a8693',
                          fontWeight: 900, fontSize: 12,
                        }}>{i + 1}</div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          @{s.name}{isMe ? ' ·' : ''}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#39ff63', fontVariantNumeric: 'tabular-nums' }}>{s.score}</div>
                      </motion.li>
                    )
                  })}
                </ol>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ───────── helpers ───────── */
const hudBtnStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  background: 'rgba(20,24,30,0.7)', backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, padding: '8px 12px',
  color: '#fff', fontSize: 13, fontWeight: 700,
  display: 'flex', alignItems: 'center', gap: 6,
}
const ghostBtnStyle: React.CSSProperties = {
  flex: 1, padding: '12px', borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff', fontWeight: 700, fontSize: 13,
}
const primaryBtnStyle: React.CSSProperties = {
  flex: 1.4, padding: '12px', borderRadius: 12,
  background: 'linear-gradient(180deg,#39ff63,#1fe07a)',
  color: '#062612', fontWeight: 900, fontSize: 14,
  boxShadow: '0 8px 22px rgba(57,255,99,0.35)',
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Plat, groundY: number, t: number) {
  const grad = ctx.createLinearGradient(0, groundY, 0, groundY + PLAT_H)
  grad.addColorStop(0, '#1d2630'); grad.addColorStop(1, '#070a0e')
  ctx.fillStyle = grad
  ctx.fillRect(p.x, groundY, p.w, PLAT_H)
  const edgeAlpha = 0.7 + 0.3 * Math.sin(t * 3 + p.x * 0.05)
  ctx.fillStyle = `rgba(57,255,99,${edgeAlpha})`
  ctx.fillRect(p.x, groundY - 2, p.w, 2)
  ctx.fillStyle = 'rgba(57,255,99,0.18)'
  ctx.fillRect(p.x, groundY, 1, PLAT_H)
  ctx.fillRect(p.x + p.w - 1, groundY, 1, PLAT_H)
}

/**
 * Fully procedural Fanvue mascot — round green body, animated legs/arms,
 * blinking eyes, smile, bobbing while walking. Matches brand green.
 */
function drawHero(
  ctx: CanvasRenderingContext2D,
  x: number, baseY: number, rot: number,
  walkPhase: number, capWobble: number, walking: boolean,
  mode: HeroMode = 'idle',
) {
  const W = HERO_W, H = HERO_H
  const cx = x + W / 2

  // ground shadow
  const shadowSquish = walking ? 1 + Math.sin(walkPhase * 2) * 0.18 : 1
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath()
  ctx.ellipse(cx, baseY + 1.5, (W * 0.42) * shadowSquish, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // body bob
  const bodyBob = walking ? -Math.abs(Math.sin(walkPhase)) * 3 : Math.sin(capWobble * 1.6) * 0.7

  ctx.save()
  ctx.translate(cx, baseY)
  if (rot) ctx.rotate((rot * Math.PI) / 180)
  ctx.translate(-cx, -baseY)
  ctx.translate(0, bodyBob)

  // Geometry
  const feetY = baseY - 2
  const bodyW = W * 0.78
  const bodyH = H * 0.62
  const bodyCx = cx
  const bodyCy = feetY - bodyH * 0.55 - 8
  const headR = W * 0.42
  const headCx = cx
  const headCy = bodyCy - bodyH * 0.45 - headR * 0.5

  // ─── Legs (animated walk cycle) ───
  const legSwing = walking ? Math.sin(walkPhase) * 6 : 0
  const legLift  = walking ? Math.max(0, Math.sin(walkPhase)) * 3 : 0
  const legLiftB = walking ? Math.max(0, -Math.sin(walkPhase)) * 3 : 0
  const hipY = feetY - 10
  const legW = 4.5
  // back leg
  ctx.fillStyle = '#0a3a1f'
  roundRect(ctx, bodyCx - 7 - legW/2 - legSwing*0.4, hipY - legLiftB, legW, 10 + legLiftB, 2); ctx.fill()
  // shoe back
  ctx.fillStyle = '#062612'
  roundRect(ctx, bodyCx - 11 - legSwing*0.4, feetY - 3 - legLiftB, 9, 3.5, 1.5); ctx.fill()
  // front leg
  ctx.fillStyle = '#0e4a28'
  roundRect(ctx, bodyCx + 7 - legW/2 + legSwing*0.4, hipY - legLift, legW, 10 + legLift, 2); ctx.fill()
  // shoe front
  ctx.fillStyle = '#062612'
  roundRect(ctx, bodyCx + 2 + legSwing*0.4, feetY - 3 - legLift, 9, 3.5, 1.5); ctx.fill()

  // ─── Body (rounded, brand green with gradient) ───
  const bg = ctx.createLinearGradient(0, bodyCy - bodyH/2, 0, bodyCy + bodyH/2)
  bg.addColorStop(0, '#7bff9a')
  bg.addColorStop(0.55, '#39ff63')
  bg.addColorStop(1, '#1ec74a')
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.ellipse(bodyCx, bodyCy, bodyW/2, bodyH/2, 0, 0, Math.PI * 2)
  ctx.fill()
  // body sheen
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.beginPath()
  ctx.ellipse(bodyCx - bodyW*0.18, bodyCy - bodyH*0.22, bodyW*0.18, bodyH*0.10, -0.4, 0, Math.PI * 2)
  ctx.fill()
  // body outline
  ctx.strokeStyle = 'rgba(6,38,18,0.55)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(bodyCx, bodyCy, bodyW/2, bodyH/2, 0, 0, Math.PI * 2)
  ctx.stroke()

  // ─── Arms (swinging opposite to legs; flailing when scared/stumble) ───
  const flail = mode === 'scared' ? Math.sin(capWobble * 38) * 110
              : mode === 'stumble' ? Math.sin(capWobble * 26) * 60
              : 0
  const armSwingBase = walking ? Math.sin(walkPhase) * 8 : Math.sin(capWobble * 1.6) * 1.2
  const armL = -armSwingBase - flail
  const armR =  armSwingBase + flail
  const armW = 4
  const armLen = mode === 'scared' || mode === 'stumble' ? 14 : 13
  const armY = bodyCy - 2
  // left arm
  ctx.fillStyle = '#1ec74a'
  ctx.save()
  ctx.translate(bodyCx - bodyW/2 + 1, armY)
  ctx.rotate((armL * Math.PI) / 180)
  roundRect(ctx, -armW/2, 0, armW, armLen, 2); ctx.fill()
  ctx.fillStyle = '#7bff9a'
  ctx.beginPath(); ctx.arc(0, armLen + 1, 2.6, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // right arm
  ctx.fillStyle = '#1ec74a'
  ctx.save()
  ctx.translate(bodyCx + bodyW/2 - 1, armY)
  ctx.rotate((armR * Math.PI) / 180)
  roundRect(ctx, -armW/2, 0, armW, armLen, 2); ctx.fill()
  ctx.fillStyle = '#7bff9a'
  ctx.beginPath(); ctx.arc(0, armLen + 1, 2.6, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // ─── Head (same brand green sphere on top of body) ───
  const headTilt = walking ? Math.sin(walkPhase) * 0.05 : Math.sin(capWobble * 1.3) * 0.03
  ctx.save()
  ctx.translate(headCx, headCy)
  ctx.rotate(headTilt)
  // head fill
  const hg = ctx.createRadialGradient(-headR*0.3, -headR*0.4, headR*0.2, 0, 0, headR)
  hg.addColorStop(0, '#a8ffb8')
  hg.addColorStop(0.6, '#39ff63')
  hg.addColorStop(1, '#1ec74a')
  ctx.fillStyle = hg
  ctx.beginPath(); ctx.arc(0, 0, headR, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(6,38,18,0.55)'
  ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.arc(0, 0, headR, 0, Math.PI * 2); ctx.stroke()

  // ─── Eyes with blinking / scared wide eyes ───
  const blinkCycle = (capWobble % 2.6)
  const blinking = blinkCycle < 0.12 && mode !== 'scared' && mode !== 'stumble'
  const wide = mode === 'scared' || mode === 'stumble'
  const eyeOffX = headR * 0.32
  const eyeY = -headR * 0.05
  const eyeR = headR * (wide ? 0.28 : 0.18)
  ctx.fillStyle = '#ffffff'
  if (blinking) {
    // closed eyes — short lines
    ctx.strokeStyle = '#062612'
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-eyeOffX - eyeR*0.7, eyeY); ctx.lineTo(-eyeOffX + eyeR*0.7, eyeY)
    ctx.moveTo( eyeOffX - eyeR*0.7, eyeY); ctx.lineTo( eyeOffX + eyeR*0.7, eyeY)
    ctx.stroke()
  } else {
    ctx.beginPath(); ctx.arc(-eyeOffX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc( eyeOffX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill()
    // pupils — dart around when scared, drift when dizzy
    let pupilShift = walking ? Math.sin(walkPhase * 0.5) * 0.8 : Math.sin(capWobble * 0.7) * 0.4
    let pupilDy = 0.4
    let pupilR = eyeR * 0.55
    if (wide) { pupilShift = Math.sin(capWobble * 40) * 1.6; pupilR = eyeR * 0.32; pupilDy = -1.2 }
    if (mode === 'dizzy') { pupilShift = Math.sin(capWobble * 6) * 2; pupilDy = Math.cos(capWobble * 6) * 1.2 }
    ctx.fillStyle = '#062612'
    ctx.beginPath(); ctx.arc(-eyeOffX + pupilShift, eyeY + pupilDy, pupilR, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc( eyeOffX + pupilShift, eyeY + pupilDy, pupilR, 0, Math.PI * 2); ctx.fill()
    // eye shine
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(-eyeOffX + pupilShift + 1, eyeY - 1 + pupilDy*0.4, eyeR * 0.18, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc( eyeOffX + pupilShift + 1, eyeY - 1 + pupilDy*0.4, eyeR * 0.18, 0, Math.PI * 2); ctx.fill()
  }

  // ─── Mouth — smile / O of horror / dazed line ───
  ctx.strokeStyle = '#062612'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  if (mode === 'scared' || mode === 'stumble') {
    // open screaming "O"
    ctx.fillStyle = '#1a0a08'
    ctx.beginPath()
    ctx.ellipse(0, headR * 0.32, headR * 0.16, headR * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (mode === 'dizzy') {
    // wavy mouth
    ctx.beginPath()
    ctx.moveTo(-headR*0.28, headR*0.28)
    ctx.quadraticCurveTo(-headR*0.14, headR*0.36, 0, headR*0.28)
    ctx.quadraticCurveTo( headR*0.14, headR*0.20, headR*0.28, headR*0.28)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(0, headR * 0.18, headR * 0.32, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }

  // ─── Cheek blush ───
  ctx.fillStyle = 'rgba(255,120,140,0.35)'
  ctx.beginPath(); ctx.ellipse(-headR*0.55, headR*0.18, headR*0.13, headR*0.08, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse( headR*0.55, headR*0.18, headR*0.13, headR*0.08, 0, 0, Math.PI * 2); ctx.fill()

  // ─── Antenna / leaf (brand touch) wobbles ───
  const leafSway = (mode === 'scared' || mode === 'stumble')
    ? Math.sin(capWobble * 24) * 0.8
    : Math.sin(capWobble * 2.2) * 0.2
  ctx.save()
  ctx.translate(0, -headR)
  ctx.rotate(leafSway)
  ctx.strokeStyle = '#1ec74a'
  ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -7); ctx.stroke()
  ctx.fillStyle = '#7bff9a'
  ctx.beginPath()
  ctx.ellipse(2.5, -10, 4, 2.5, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#0a3a1f'
  ctx.lineWidth = 0.7
  ctx.stroke()
  ctx.restore()

  ctx.restore() // head

  ctx.restore() // body bob
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function animateCamera(st: GameState, done: () => void) {
  st.cameraStartX = st.cameraX
  st.cameraTargetX = st.next.x - 30
  st.cameraT = 0; st.cameraDur = 0.35
  st.cameraDone = done
  st.phase = 'camera'
}
function cameraTween(st: GameState, dt: number) {
  st.cameraT += dt
  const k = Math.min(1, st.cameraT / st.cameraDur)
  const e = 1 - Math.pow(1 - k, 3)
  st.cameraX = st.cameraStartX + (st.cameraTargetX - st.cameraStartX) * e
  if (k >= 1) st.cameraDone?.()
}
