import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useT } from '../i18n'
import { useStore } from '../store'
import { CONFIG } from '../config'
import { useTelegram } from '../hooks/useTelegram'
import { useToast } from './Toast'
import RefWithdrawSheet from './RefWithdrawSheet'
import ReferralList from './ReferralList'

function getMonthEnd() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
}

function calcCountdown() {
  const diff = getMonthEnd().getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, ms: 0 }
  const days    = Math.floor(diff / 86400000)
  const hours   = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return { days, hours, minutes, seconds, ms: diff }
}

export default function ReferralCard() {
  const t = useT()
  const navigate = useNavigate()
  const lang = useStore((s) => s.lang)
  const user = useStore((s) => s.user)
  const refReward = useStore((s) => s.refReward)
  const checkAndResetMonthlyReward = useStore((s) => s.checkAndResetMonthlyReward)
  const { haptic } = useTelegram()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(calcCountdown)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showReferrals, setShowReferrals] = useState(false)

  useEffect(() => {
    checkAndResetMonthlyReward()
  }, [checkAndResetMonthlyReward])

  const tick = useCallback(() => setCountdown(calcCountdown()), [])

  useEffect(() => {
    const isLastDay = countdown.ms < 86400000
    const id = setInterval(tick, isLastDay ? 1000 : 60000)
    return () => clearInterval(id)
  }, [countdown.ms, tick])

  if (!user) return null

  const refLink = `https://t.me/${CONFIG.botUsername}?start=ref${user.uid}`
  const GOAL = 10
  const progress = Math.min(refReward.count, GOAL)
  const needed   = Math.max(0, GOAL - progress)
  const pct      = (progress / GOAL) * 100
  const isLastDay = countdown.ms > 0 && countdown.ms < 86400000
  const isComplete = refReward.count >= GOAL

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(refLink)
    } catch {
      const el = document.createElement('textarea')
      el.value = refLink
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    haptic('success')
    toast.show(lang === 'ru' ? 'Ссылка скопирована' : 'Link copied', 'success')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="ref-card">
        {/* Header */}
        <div className="mb-4">
          <div className="row-between mb-2">
            <div>
              <div className="t-md fw-black" style={{ letterSpacing: '-0.01em' }}>
                {lang === 'ru' ? '💸 Реферальная программа' : '💸 Referral Program'}
              </div>
              <div className="t-xs t-muted mt-1">
                {lang === 'ru'
                  ? 'Приводи друзей — получай деньги'
                  : 'Invite friends — earn real money'}
              </div>
            </div>
          </div>
          {/* Reward cards */}
          <div className="row gap-2">
            <div style={{ flex: 1, background: 'rgba(73,242,100,0.08)', border: '1px solid rgba(73,242,100,0.2)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
              <div className="t-lg fw-black" style={{ color: 'var(--success)' }}>$5</div>
              <div className="t-xs t-muted">{lang === 'ru' ? 'за покупателя' : 'per buyer'}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(232,54,93,0.08)', border: '1px solid rgba(232,54,93,0.2)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
              <div className="t-lg fw-black" style={{ color: 'var(--brand)' }}>+$100</div>
              <div className="t-xs t-muted">{lang === 'ru' ? 'бонус за 10/мес' : 'bonus for 10/mo'}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(151,114,255,0.08)', border: '1px solid rgba(151,114,255,0.2)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
              <div className="t-lg fw-black" style={{ color: 'var(--purple)' }}>$100</div>
              <div className="t-xs t-muted">{lang === 'ru' ? 'макс/месяц' : 'max/month'}</div>
            </div>
          </div>
        </div>

        {/* Ref balance — always visible */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: user.ref_balance > 0
              ? 'linear-gradient(135deg, rgba(232,54,93,0.15), rgba(151,114,255,0.1))'
              : 'var(--surface-2)',
            border: user.ref_balance > 0 ? '1px solid rgba(232,54,93,0.3)' : '1px solid var(--b-default)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div>
            <div className="t-xs t-muted">{lang === 'ru' ? 'Реф. баланс к выводу' : 'Ref. balance'}</div>
            <div className="t-xl" style={{ color: user.ref_balance > 0 ? 'var(--brand)' : 'var(--t-muted)' }}>
              ${user.ref_balance.toFixed(2)}
            </div>
            {user.ref_balance === 0 && (
              <div className="t-xs t-muted" style={{ marginTop: 2 }}>
                {lang === 'ru' ? 'Минимум $10 для вывода' : 'Min. $10 to withdraw'}
              </div>
            )}
          </div>
          <motion.button
            className="btn btn-sm fw-black"
            onClick={() => setShowWithdraw(true)}
            whileTap={{ scale: 0.95 }}
            style={{
              fontSize: 13, padding: '10px 18px',
              background: user.ref_balance >= 10 ? 'var(--g-brand)' : 'var(--surface-hover)',
              color: user.ref_balance >= 10 ? 'white' : 'var(--t-muted)',
              border: 'none', borderRadius: 10,
            }}
          >
            {lang === 'ru' ? '💸 Вывести' : '💸 Withdraw'}
          </motion.button>
        </motion.div>

        {/* Stats */}
        <div className="grid-2 gap-3 mb-4">
          <div className="stat-card">
            <div className="stat-value t-cyan">{user.ref_count}</div>
            <div className="stat-label">{t('profile_ref_invited')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value t-gold">${user.ref_earned.toFixed(2)}</div>
            <div className="stat-label">{t('profile_ref_earned')}</div>
          </div>
        </div>

        {/* Monthly reward progress */}
        <div style={{
          background: 'var(--surface-2)',
          borderRadius: 12,
          padding: '14px',
          marginBottom: 16,
        }}>
          <div className="row-between mb-1">
            <div className="t-sm fw-bold">
              {lang === 'ru' ? '🎯 Прогресс месяца' : '🎯 Monthly progress'}
            </div>
            <div className="t-xs fw-bold" style={{ color: 'var(--brand)' }}>
              ${(progress * 5).toFixed(0)} earned
              {progress >= GOAL ? ' + 🎁$100' : ` / $100 + 🎁`}
            </div>
          </div>
          <div className="t-xs t-muted mb-2">{progress} / {GOAL} {lang === 'ru' ? 'покупателей' : 'buyers'}</div>

          {/* Progress bar */}
          <div style={{ background: 'var(--b-default)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 10 }}>
            <motion.div
              style={{
                height: '100%',
                background: isComplete ? 'var(--g-brand)' : 'var(--brand)',
                borderRadius: 6,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          <AnimatePresence mode="wait">
            {refReward.claimed ? (
              <motion.div key="claimed" initial={false} animate={{ opacity: 1 }} className="t-sm t-brand fw-bold">
                ✓ {t('ref_claimed')}
              </motion.div>
            ) : isComplete ? (
              <motion.div key="complete" initial={false} animate={{ opacity: 1 }} className="t-sm fw-bold" style={{ color: 'var(--success)' }}>
                🎉 {lang === 'ru' ? 'Цель достигнута! +$100 бонус!' : 'Goal reached! +$100 bonus!'}
              </motion.div>
            ) : (
              <motion.div key="needed" initial={false} animate={{ opacity: 1 }} className="t-xs t-muted">
                {t('ref_needed')} {needed} {t('ref_referrals')}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Countdown */}
        <div style={{
          background: isLastDay ? 'rgba(255,80,80,0.08)' : 'var(--surface-2)',
          border: isLastDay ? '1px solid rgba(255,80,80,0.25)' : '1px solid var(--b-default)',
          borderRadius: 10,
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div className={`t-xs${isLastDay ? '' : ' t-muted'}`} style={{ color: isLastDay ? '#ff5050' : undefined }}>
            {isLastDay ? t('ref_last_day') : t('ref_deadline')}
          </div>
          <div className="t-sm fw-black" style={{ color: isLastDay ? '#ff5050' : 'var(--t-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {isLastDay
              ? `${String(countdown.hours).padStart(2,'0')}:${String(countdown.minutes).padStart(2,'0')}:${String(countdown.seconds).padStart(2,'0')}`
              : `${countdown.days}д ${countdown.hours}ч`
            }
          </div>
        </div>

        {/* Calendar button */}
        <motion.button
          className="btn btn-ghost"
          style={{ width: '100%', marginBottom: 8, fontSize: 13, gap: 8 }}
          onClick={() => navigate('/referral-calendar')}
          whileTap={{ scale: 0.97 }}
        >
          🎁 {lang === 'ru' ? 'Реферальный календарь' : 'Referral Calendar'}
        </motion.button>

        {/* My referrals button */}
        <motion.button
          className="btn btn-ghost"
          style={{ width: '100%', marginBottom: 14, fontSize: 13, gap: 8 }}
          onClick={() => setShowReferrals(true)}
          whileTap={{ scale: 0.97 }}
        >
          👥 {lang === 'ru' ? 'Мои рефералы' : 'My Referrals'}
        </motion.button>

        {/* Ref link */}
        <div className="t-xs t-muted mb-2">{t('profile_ref_link')}</div>
        <div className="ref-link">
          <div className="ref-link-text">{refLink}</div>
          <motion.button
            className={`copy-btn${copied ? ' copied' : ''}`}
            onClick={handleCopy}
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={copied ? 'ok' : 'copy'}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {copied ? '✓' : t('profile_ref_copy')}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      <RefWithdrawSheet open={showWithdraw} onClose={() => setShowWithdraw(false)} />
    </>
  )
}
