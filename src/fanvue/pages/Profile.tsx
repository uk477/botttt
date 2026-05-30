import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import PageTransition from '../components/PageTransition'
import RefWithdrawSheet from '../components/RefWithdrawSheet'
import ReferralList from '../components/ReferralList'
import { useStore } from '../store'
import { useTelegram } from '../hooks/useTelegram'
import { useToast } from '../components/Toast'
import { CONFIG } from '../config'
import fanvueGlyph from '../../assets/fanvue-glyph.png'

const GREEN = '#39FF63'
const INK = '#050505'
const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const BODY = "'DM Sans', system-ui, sans-serif"
const MONO = "'JetBrains Mono', 'Space Mono', ui-monospace, monospace"

const eyebrow: CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.32em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
  fontStyle: 'italic',
}

export default function Profile() {
  const navigate = useNavigate()
  const lang = useStore((s) => s.lang) as 'ru' | 'en'
  const user = useStore((s) => s.user)
  const supportUnread = useStore((s) => s.supportUnread)
  const adminVerified = useStore((s) => s._adminVerified)
  const { haptic } = useTelegram()
  const toast = useToast()

  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showReferrals, setShowReferrals] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!user) return null

  const refLink = `https://t.me/${CONFIG.botUsername}?start=ref${user.uid}`
  const [whole, cents] = user.balance.toFixed(2).split('.')
  const canWithdraw = user.ref_balance >= 10

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(refLink)
    } catch {
      const el = document.createElement('textarea')
      el.value = refLink
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    haptic('success')
    setCopied(true)
    toast.show(lang === 'ru' ? 'Ссылка скопирована' : 'Link copied', 'success')
    setTimeout(() => setCopied(false), 1600)
  }

  type RowProps = { num: string; label: string; badge?: string | number; onClick: () => void }
  const Row = ({ num, label, badge, onClick }: RowProps) => (
    <button
      onClick={() => {
        haptic('light')
        onClick()
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 14px',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        color: '#fff',
        textAlign: 'left',
        transition: 'background 0.2s',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(57,255,99,0.55)', fontWeight: 700 }}>
          /{num}
        </span>
        <span
          style={{
            fontFamily: DISPLAY,
            fontSize: 13,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
          }}
        >
          {label}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {badge !== undefined && badge !== '' && badge !== 0 ? (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 4,
              padding: '2px 6px',
              color: '#fff',
            }}
          >
            {badge}
          </span>
        ) : null}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  )

  return (
    <PageTransition>
      <div
        className="page"
        style={{
          minHeight: '100%',
          color: '#fff',
          paddingBottom: 120,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          fontFamily: BODY,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'relative', zIndex: 2,
          padding: '6px 0',
          margin: '-6px 0',
        }}>

          <div className="shop-hero-brand profile-brand-clean" aria-label="Fanvue Profile">
            <img
              src={fanvueGlyph}
              alt=""
              draggable={false}
              decoding="async"
              width={36}
              height={36}
              className="shop-hero-brand-logo"
            />
            <span className="shop-hero-brand-sep" aria-hidden />
            <span className="shop-hero-brand-mark" aria-hidden>
              {'PROFILE'.split('').map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
              <span className="shop-hero-brand-sheen" aria-hidden />
            </span>
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Hero balance */}
        <div style={{ position: 'relative', marginTop: -2, zIndex: 2 }}>
          <div style={{ position: 'relative' }}>
            <div style={eyebrow}>
              {lang === 'ru' ? 'Ваш баланс' : 'Your Balance'}
            </div>
            <div
              style={{
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 68,
                lineHeight: 0.9,
                letterSpacing: '-0.05em',
                marginTop: 10,
                color: '#fff',
                display: 'flex',
                alignItems: 'baseline',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 44, marginRight: 4 }}>$</span>
              <span>{whole}</span>
              <span style={{ color: GREEN, opacity: 0.85 }}>.{cents}</span>
            </div>
            <button
              onClick={() => {
                haptic('light')
                navigate('/deposit')
              }}
              style={{
                marginTop: 22,
                width: '100%',
                background: GREEN,
                color: INK,
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 15,
                padding: '18px 16px',
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                border: 'none',
                borderRadius: '0 0 36px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: 'none',
              }}
            >
              <span>{lang === 'ru' ? 'Пополнить' : 'Top up'}</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Referral bento — 3/2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10, marginTop: 14, position: 'relative', zIndex: 2 }}>
          {/* Ref balance + withdraw */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              minHeight: 140,
            }}
          >
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, animation: 'fanvuePulse 1.6s infinite' }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
            </div>
            <div>
              <div style={{ ...eyebrow, color: 'rgba(57,255,99,0.7)', fontSize: 9 }}>
                {lang === 'ru' ? 'Реф. баланс' : 'Ref Balance'}
              </div>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 32,
                  fontWeight: 500,
                  marginTop: 8,
                  letterSpacing: '-0.03em',
                }}
              >
                ${user.ref_balance.toFixed(2)}
              </div>
            </div>
            <button
              onClick={() => {
                haptic('light')
                setShowWithdraw(true)
              }}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '10px 12px',
                background: canWithdraw ? 'rgba(57,255,99,0.08)' : 'transparent',
                border: `1px solid ${canWithdraw ? 'rgba(57,255,99,0.4)' : 'rgba(255,255,255,0.12)'}`,
                color: canWithdraw ? GREEN : 'rgba(255,255,255,0.55)',
                fontFamily: DISPLAY,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {lang === 'ru' ? 'Вывести' : 'Withdraw'}
            </button>
          </div>

          {/* Stats stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4,
                padding: 12,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {lang === 'ru' ? 'Приглашено' : 'Invited'}
              </div>
              <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, marginTop: 4, letterSpacing: '-0.03em' }}>
                {user.ref_count}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: 'rgba(57,255,99,0.06)',
                border: '1px solid rgba(57,255,99,0.22)',
                borderRadius: 4,
                padding: 12,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(57,255,99,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {lang === 'ru' ? 'Доход' : 'Earned'}
              </div>
              <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, marginTop: 4, color: GREEN, letterSpacing: '-0.03em' }}>
                ${user.ref_earned.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Referral link */}
        <div
          style={{
            position: 'relative',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
            <span style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              color: 'rgba(255,255,255,0.35)', letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
              {lang === 'ru' ? 'Реф. ссылка' : 'Ref link'}
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.85)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {refLink}
            </span>
          </div>
          <button
            onClick={copyRef}
            aria-label={lang === 'ru' ? 'Копировать' : 'Copy'}
            style={{
              flexShrink: 0,
              width: 38, height: 38, borderRadius: 10,
              background: copied ? GREEN : 'rgba(255,255,255,0.06)',
              border: `1px solid ${copied ? GREEN : 'rgba(255,255,255,0.1)'}`,
              color: copied ? INK : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 160ms ease',
            }}
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            )}
          </button>
        </div>

        {/* Menu */}
        <div style={{ marginTop: 6, position: 'relative', zIndex: 2 }}>
          <Row num="01" label={lang === 'ru' ? 'История заказов' : 'Order History'} onClick={() => navigate('/orders')} />
          <Row num="02" label={lang === 'ru' ? 'История пополнений' : 'Deposit History'} onClick={() => navigate('/deposits')} />
          <Row
            num="03"
            label={lang === 'ru' ? 'Мои рефералы' : 'My Referrals'}
            badge={user.ref_count}
            onClick={() => setShowReferrals(true)}
          />
          <Row
            num="04"
            label={lang === 'ru' ? 'Поддержка' : 'Support'}
            badge={supportUnread || undefined}
            onClick={() => navigate('/support')}
          />
        </div>

        {/* Admin */}
        {adminVerified && (
          <button
            onClick={() => navigate('/admin')}
            style={{
              marginTop: 14,
              width: '100%',
              padding: '18px 16px',
              background: 'transparent',
              borderTop: '1px solid rgba(255,255,255,0.18)',
              borderBottom: '1px solid rgba(255,255,255,0.18)',
              borderLeft: 'none',
              borderRight: 'none',
              color: 'rgba(255,255,255,0.65)',
              fontFamily: DISPLAY,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.4em',
              position: 'relative',
              zIndex: 2,
            }}
          >
            {lang === 'ru' ? 'Админ-панель' : 'Admin Panel'}
          </button>
        )}
      </div>

      <style>{`
        @keyframes fanvueMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes fanvuePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <RefWithdrawSheet open={showWithdraw} onClose={() => setShowWithdraw(false)} />
      {showReferrals && <ReferralList open={showReferrals} onClose={() => setShowReferrals(false)} />}
    </PageTransition>
  )
}
