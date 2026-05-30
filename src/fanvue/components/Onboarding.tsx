import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import FanvueLogo from './FanvueLogo'

const LS_KEY = 'fanvue-onboarded'

const t = {
  en: {
    skip: 'Skip', cta: 'Get Started', next: 'Continue',
    s1: 'Welcome to Fanvue Market', s1d: 'Premium Fanvue accounts & verified services in one place.',
    s2: 'Crypto Payments', s2d: 'Pay with USDT, BTC, ETH, SOL — instant and fully anonymous.',
    s3: 'Earn With Friends', s3d: '$5 per buyer + $100 bonus when you bring 10 active friends a month.',
  },
  ru: {
    skip: 'Пропустить', cta: 'Начать', next: 'Далее',
    s1: 'Добро пожаловать в Fanvue Market', s1d: 'Премиум аккаунты и верифицированные сервисы Fanvue в одном месте.',
    s2: 'Крипто-платежи', s2d: 'USDT, BTC, ETH, SOL — мгновенно и полностью анонимно.',
    s3: 'Зарабатывай с друзьями', s3d: '$5 за покупателя + $100 бонус за 10 активных друзей в месяц.',
  },
}

const float = { animate: { y: [0, -6, 0] }, transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } }

function Step1() {
  return (
    <motion.div {...float} style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: -28, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(232,54,93,0.25) 0%, transparent 70%)',
        filter: 'blur(8px)',
      }} />
      <div style={{ position: 'relative' }}><FanvueLogo size={88} /></div>
    </motion.div>
  )
}
function Step2() {
  return (
    <motion.div {...float} style={{
      width: 96, height: 96, borderRadius: 28,
      background: 'linear-gradient(135deg, #E8365D 0%, #FF6B35 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 20px 50px -10px rgba(232,54,93,0.5), 0 1px 0 rgba(255,255,255,0.2) inset',
    }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="14" rx="3"/>
        <path d="M2 11h20M7 16h2M13 16h4"/>
      </svg>
    </motion.div>
  )
}
function Step3() {
  return (
    <motion.div {...float} style={{
      width: 96, height: 96, borderRadius: 28,
      background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 20px 50px -10px rgba(34,197,94,0.5), 0 1px 0 rgba(255,255,255,0.2) inset',
    }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </motion.div>
  )
}

const icons = [Step1, Step2, Step3]
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 280 : -280, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -280 : 280, opacity: 0 }),
}

export default function Onboarding() {
  const lang = useStore((s) => s.lang) as 'ru' | 'en'
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(LS_KEY) === 'true')

  const dismiss = useCallback(() => {
    localStorage.setItem(LS_KEY, 'true')
    setDismissed(true)
  }, [])
  const next = useCallback(() => {
    if (step === 2) return dismiss()
    setDir(1); setStep((s) => s + 1)
  }, [step, dismiss])

  if (dismissed) return null
  const l = t[lang] || t.en
  const StepIcon = icons[step]
  const titles = [l.s1, l.s2, l.s3]
  const descs = [l.s1d, l.s2d, l.s3d]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'radial-gradient(ellipse at top, rgba(232,54,93,0.08) 0%, var(--bg) 50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 'max(48px, var(--tg-top))',
      paddingBottom: 'max(36px, env(safe-area-inset-bottom, 24px))',
    }}>
      <button onClick={dismiss} style={{
        position: 'absolute', top: 'max(20px, var(--tg-top))', right: 20,
        padding: '8px 14px', borderRadius: 999,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
      }}>
        {l.skip}
      </button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step} custom={dir}
            variants={slideVariants}
            initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 32, padding: '0 36px', textAlign: 'center', position: 'absolute', maxWidth: 380,
            }}
          >
            <StepIcon />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1.15, color: 'var(--t-primary)' }}>
                {titles[step]}
              </div>
              <div style={{ fontSize: 15, color: 'var(--t-muted)', lineHeight: 1.5, fontWeight: 500 }}>
                {descs[step]}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, width: '100%', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ width: i === step ? 28 : 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                height: 6, borderRadius: 3,
                background: i === step ? 'var(--brand)' : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>
        <motion.button
          onClick={next}
          whileTap={{ scale: 0.97 }}
          whileHover={{ filter: 'brightness(1.08)' }}
          style={{
            width: '100%', maxWidth: 360, minHeight: 54,
            background: 'linear-gradient(135deg, #E8365D 0%, #FF6B35 100%)',
            color: 'white', border: 'none', borderRadius: 16,
            fontSize: 16, fontWeight: 800, letterSpacing: '0.005em',
            boxShadow: '0 10px 30px -8px rgba(232,54,93,0.55), 0 1px 0 rgba(255,255,255,0.18) inset',
            cursor: 'pointer',
          }}
        >
          {step === 2 ? l.cta : l.next}
        </motion.button>
      </div>
    </div>
  )
}
