import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import FanvueLogo from './FanvueLogo'

const LS_KEY = 'fanvue-onboarded'

const BRAND_LOCKUP = '🛍 FANVUE MARKET 🛍'

const copy = {
  en: {
    skip: 'Skip',
    cta: 'Enter the market',
    next: 'Continue',
    eyebrow: ['Premium marketplace', 'Crypto checkout', 'Referral rewards'],
    s1: 'Your Fanvue market,\nrefined',
    s1d: 'Verified accounts and services — curated, delivered fast, built for creators who value discretion.',
    s2: 'Pay on your terms',
    s2d: 'USDT, BTC, ETH, SOL. Exact amounts, on-chain confirmation, balance updates in seconds.',
    s3: 'Grow with referrals',
    s3d: '$5 per buyer · $100 bonus for 10 active friends each month. Payouts in crypto.',
    perks: [
      ['Instant delivery', 'After payment clears'],
      ['Live support', 'In-app chat'],
      ['Private checkout', 'No card trails'],
    ],
  },
  ru: {
    skip: 'Пропустить',
    cta: 'Войти в маркет',
    next: 'Далее',
    eyebrow: ['Премиум-маркет', 'Крипто-оплата', 'Реферальная программа'],
    s1: 'Ваш маркет Fanvue\nбез компромиссов',
    s1d: 'Верифицированные аккаунты и сервисы — отобранные лоты, быстрая выдача, конфиденциально.',
    s2: 'Оплата без лишнего',
    s2d: 'USDT, BTC, ETH, SOL. Точная сумма, подтверждение в сети, зачисление за секунды.',
    s3: 'Рост через рефералов',
    s3d: '$5 за покупателя · $100 бонус за 10 активных друзей в месяц. Выплаты в крипте.',
    perks: [
      ['Моментальная выдача', 'После оплаты'],
      ['Живая поддержка', 'Чат в приложении'],
      ['Анонимный расчёт', 'Без карт и следов'],
    ],
  },
} as const

const float = {
  animate: { y: [0, -5, 0] },
  transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const },
}

function StepVisual({ step }: { step: number }) {
  if (step === 0) {
    return (
      <motion.div {...float} className="fv-onboard-visual fv-onboard-visual--hero">
        <div className="fv-onboard-visual-glow" aria-hidden />
        <div className="fv-onboard-brand">{BRAND_LOCKUP}</div>
        <FanvueLogo size={72} />
      </motion.div>
    )
  }
  if (step === 1) {
    return (
      <motion.div {...float} className="fv-onboard-visual">
        <div className="fv-onboard-icon-tile">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div className="fv-onboard-crypto-row">
          {['USDT', 'BTC', 'ETH', 'SOL'].map((c) => (
            <span key={c} className="fv-onboard-crypto-chip">{c}</span>
          ))}
        </div>
      </motion.div>
    )
  }
  return (
    <motion.div {...float} className="fv-onboard-visual">
      <div className="fv-onboard-icon-tile fv-onboard-icon-tile--alt">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <div className="fv-onboard-stat-pill">
        <span className="fv-onboard-stat-val">$5</span>
        <span className="fv-onboard-stat-lbl">/ buyer</span>
      </div>
    </motion.div>
  )
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 260 : -260, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -260 : 260, opacity: 0 }),
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
    setDir(1)
    setStep((s) => s + 1)
  }, [step, dismiss])

  if (dismissed) return null

  const l = copy[lang] || copy.en
  const titles = [l.s1, l.s2, l.s3]
  const descs = [l.s1d, l.s2d, l.s3d]

  return (
    <div className="fv-onboard">
      <div className="fv-onboard-grid" aria-hidden />
      <div className="fv-onboard-orb fv-onboard-orb--1" aria-hidden />
      <div className="fv-onboard-orb fv-onboard-orb--2" aria-hidden />

      <button type="button" className="fv-onboard-skip" onClick={dismiss}>
        {l.skip}
      </button>

      <div className="fv-onboard-eyebrow">
        {l.eyebrow.map((item, i) => (
          <span key={item} className={i === step ? 'is-active' : ''}>
            {item}
          </span>
        ))}
      </div>

      <div className="fv-onboard-stage">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            className="fv-onboard-slide"
          >
            <StepVisual step={step} />
            <div className="fv-onboard-copy">
              <h1 className="fv-onboard-title">
                {titles[step].split('\n').map((line, i, arr) => (
                  <span key={line}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </span>
                ))}
              </h1>
              <p className="fv-onboard-desc">{descs[step]}</p>
            </div>
            {step === 0 && (
              <ul className="fv-onboard-perks">
                {l.perks.map(([title, sub]) => (
                  <li key={title}>
                    <span className="fv-onboard-perk-dot" />
                    <div>
                      <strong>{title}</strong>
                      <span>{sub}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fv-onboard-foot">
        <div className="fv-onboard-dots">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`fv-onboard-dot${i === step ? ' is-active' : ''}`}
              animate={{ width: i === step ? 28 : 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            />
          ))}
        </div>
        <motion.button
          type="button"
          className="fv-onboard-cta"
          onClick={next}
          whileTap={{ scale: 0.98 }}
        >
          {step === 2 ? l.cta : l.next}
        </motion.button>
        <p className="fv-onboard-footnote">{BRAND_LOCKUP}</p>
      </div>
    </div>
  )
}
