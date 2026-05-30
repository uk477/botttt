import { useEffect, useId, useState } from 'react'

interface Particle {
  id: number
  x: number          // start X in %
  driftX: number     // horizontal drift in vw
  rotate: number
  spin: number
  color: string
  size: number
  delay: number
  duration: number
  shape: 'rect' | 'circle'
}

// Fanvue palette: green + white tints
const COLORS = ['#39ff63', '#7CFFA0', '#C9F5D6', '#FFFFFF', '#1FE07A']

export default function Confetti({ trigger }: { trigger: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([])
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const animName = `cf_${uid}`

  useEffect(() => {
    if (!trigger) return
    const arr: Particle[] = Array.from({ length: 70 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      driftX: (Math.random() - 0.5) * 28,
      rotate: Math.random() * 360,
      spin: 360 + Math.random() * 720 * (Math.random() < 0.5 ? -1 : 1),
      color: COLORS[i % COLORS.length],
      size: 5 + Math.random() * 6,
      delay: Math.random() * 0.35,
      duration: 1.8 + Math.random() * 1.4,
      shape: Math.random() < 0.18 ? 'circle' : 'rect',
    }))
    setParticles(arr)
    const tm = setTimeout(() => setParticles([]), 3800)
    return () => clearTimeout(tm)
  }, [trigger])

  if (!particles.length) return null

  return (
    <>
      <style>{`
        @keyframes ${animName} {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translate3d(var(--cf-dx), 110vh, 0) rotate(var(--cf-spin)); opacity: 0.85; }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 9999,
        }}
      >
        {particles.map((p) => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              top: 0,
              left: `${p.x}%`,
              width: p.size,
              height: p.shape === 'rect' ? p.size * 1.5 : p.size,
              background: p.color,
              borderRadius: p.shape === 'circle' ? '50%' : 2,
              boxShadow: `0 0 6px ${p.color}55`,
              transform: `rotate(${p.rotate}deg)`,
              animation: `${animName} ${p.duration}s cubic-bezier(0.22, 0.6, 0.36, 1) ${p.delay}s forwards`,
              ['--cf-dx' as never]: `${p.driftX}vw`,
              ['--cf-spin' as never]: `${p.spin}deg`,
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>
    </>
  )
}
