import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import type { Referral } from '../store/types'

interface Props {
  open: boolean
  onClose: () => void
}

const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const BODY = "'DM Sans', system-ui, sans-serif"
const GREEN = '#39ff63'
const INK = '#0a0a0a'

function avatarUrl(ref: Referral): string {
  if (ref.photo_url) return ref.photo_url
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${ref.uid}&radius=50&backgroundType=gradientLinear&backgroundColor=39ff63,0d8a3a,1a1a1a`
}

function formatDate(iso: string, lang: 'ru' | 'en') {
  return new Date(iso).toLocaleDateString(
    lang === 'ru' ? 'ru-RU' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' },
  )
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export default function ReferralList({ open, onClose }: Props) {
  const lang = useStore((s) => s.lang) as 'ru' | 'en'
  const user = useStore((s) => s.user)
  const allReferrals = useStore((s) => s.referrals)

  const activeRefs = allReferrals.filter((r) => r.purchaseCount > 0)
  const pendingCount = allReferrals.length - activeRefs.length

  if (!user) return null

  const totalEarned = user.ref_earned

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.78)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              zIndex: 100,
            }}
            role="presentation"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            role="dialog"
            aria-label={lang === 'ru' ? 'Мои рефералы' : 'My Referrals'}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 101,
              background: INK,
              borderTop: '1px solid rgba(57,255,99,0.2)',
              borderRadius: '24px 24px 0 0',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: DISPLAY,
              color: '#fff',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, flexShrink: 0, cursor: 'grab', touchAction: 'none' }}>
              <div style={{ width: 42, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 22px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontFamily: MONO }}>
                  /referrals
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', marginTop: 2 }}>
                  {lang === 'ru' ? 'Мои рефералы' : 'My Referrals'}
                </div>
              </div>
              <motion.button
                onClick={onClose}
                whileTap={{ scale: 0.9 }}
                aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer',
                }}
              >×</motion.button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 22px 32px' }}>
              {/* Earnings card */}
              <div
                style={{
                  position: 'relative',
                  borderRadius: 18,
                  padding: '20px 18px 22px',
                  margin: '0 auto 22px',
                  maxWidth: 320,
                  background: 'radial-gradient(circle at 50% 0%, rgba(57,255,99,0.18), transparent 65%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                  border: '1px solid rgba(57,255,99,0.22)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', fontFamily: MONO }}>
                  {lang === 'ru' ? 'Всего заработано' : 'Total earned'}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>$</span>
                  <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', color: GREEN, lineHeight: 1 }}>
                    {totalEarned.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
                  <div style={{
                    background: 'rgba(57,255,99,0.12)',
                    border: '1px solid rgba(57,255,99,0.25)',
                    color: GREEN,
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}>
                    {activeRefs.length} {lang === 'ru' ? 'АКТИВНЫХ' : 'ACTIVE'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>
                    × $5
                  </div>
                </div>
              </div>

              {/* Info banner — only purchasers count */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                marginBottom: 18,
                background: 'rgba(57,255,99,0.04)',
                border: '1px solid rgba(57,255,99,0.14)',
                borderRadius: 10,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(57,255,99,0.12)', color: GREEN,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, flexShrink: 0,
                }}>ⓘ</div>
                <div style={{ fontFamily: BODY, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                  {lang === 'ru'
                    ? 'Засчитываются только рефералы, которые сделали покупку.'
                    : 'Only referrals who made a purchase count.'}
                  {pendingCount > 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {' '}{lang === 'ru'
                        ? `${pendingCount} ожидают первой покупки.`
                        : `${pendingCount} pending first purchase.`}
                    </span>
                  )}
                </div>
              </div>

              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontFamily: MONO }}>
                  {lang === 'ru' ? '/Активные' : '/Active'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: MONO }}>
                  {activeRefs.length}
                </div>
              </div>

              {activeRefs.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 13,
                  fontFamily: BODY,
                  lineHeight: 1.5,
                }}>
                  {lang === 'ru'
                    ? 'Пока ни один реферал не сделал покупку.\nПоделитесь ссылкой!'
                    : 'No referrals have made a purchase yet.\nShare your link!'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeRefs
                    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
                    .map((ref, i) => {
                      const displayName = ref.username ? `@${ref.username}` : ref.full_name
                      const days = daysAgo(ref.joinedAt)
                      return (
                        <motion.div
                          key={ref.uid}
                          initial={false}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.035, type: 'spring', stiffness: 320, damping: 26 }}
                          style={{
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: 14,
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <img
                            src={avatarUrl(ref)}
                            alt=""
                            width={42}
                            height={42}
                            style={{
                              borderRadius: '50%',
                              flexShrink: 0,
                              objectFit: 'cover',
                              background: 'rgba(255,255,255,0.06)',
                            }}
                            loading="lazy"
                          />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 14, fontWeight: 700, color: '#fff',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {displayName}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                              <span>{formatDate(ref.joinedAt, lang)}</span>
                              <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                              <span>{days === 0 ? (lang === 'ru' ? 'сегодня' : 'today') : `${days}${lang === 'ru' ? 'д' : 'd'}`}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontFamily: MONO, fontSize: 10 }}>
                              <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                                {lang === 'ru' ? 'Потрачено' : 'Spent'}: <span style={{ color: '#fff', fontWeight: 700 }}>${ref.totalSpent.toFixed(2)}</span>
                              </span>
                              <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                              <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                                {ref.purchaseCount} {lang === 'ru' ? 'покуп.' : 'purch.'}
                              </span>
                            </div>
                          </div>

                          <div style={{
                            fontFamily: MONO, fontSize: 13, fontWeight: 700,
                            color: GREEN, background: 'rgba(57,255,99,0.08)',
                            border: '1px solid rgba(57,255,99,0.18)',
                            padding: '5px 10px', borderRadius: 8, flexShrink: 0,
                          }}>
                            +$5
                          </div>
                        </motion.div>
                      )
                    })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
