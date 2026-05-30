import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore } from '../store'
import { useTelegram } from '../hooks/useTelegram'
import { CONFIG } from '../config'

/**
 * SUPPORT HUB
 * Premium pre-chat selector. Two channels: in-app concierge chat
 * or direct Telegram. Editorial dark vault aesthetic.
 */

const ease = [0.22, 1, 0.36, 1] as const

function TelegramMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-hidden>
      <defs>
        <linearGradient id="tg-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#37BBFE" />
          <stop offset="100%" stopColor="#007DBB" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r="120" fill="url(#tg-grad)" />
      <path
        d="M53 116.5c34.7-15.1 57.8-25.1 69.4-30 33-13.7 39.9-16.1 44.4-16.2 1 0 3.2.2 4.7 1.4 1.2 1 1.6 2.4 1.7 3.4.1 1 .3 3.3.1 5.1-1.8 19-9.7 65.2-13.8 86.5-1.7 9-5.1 12.1-8.4 12.4-7.1.7-12.6-4.7-19.5-9.2-10.8-7.1-16.9-11.5-27.4-18.4-12.1-7.9-4.3-12.3 2.6-19.4 1.8-1.9 33.2-30.4 33.8-33 .1-.3.1-1.5-.6-2.2-.7-.6-1.8-.4-2.5-.2-1.1.2-18.4 11.7-51.9 34.4-4.9 3.4-9.4 5-13.4 4.9-4.4-.1-12.9-2.5-19.2-4.6-7.7-2.5-13.9-3.8-13.3-8.1.3-2.2 3.4-4.5 9.3-6.8z"
        fill="#fff"
      />
    </svg>
  )
}

export default function SupportHub() {
  const navigate = useNavigate()
  const lang = useStore((s) => s.lang)
  const { haptic } = useTelegram()
  const supportUnread = useStore((s) => s.supportUnread)
  const messagesCount = useStore((s) => s.supportMessages.length)

  const t = (ru: string, en: string) => (lang === 'ru' ? ru : en)

  const openChat = () => { haptic('medium'); navigate('/support/chat') }
  const openTg = () => {
    haptic('medium')
    window.open(`https://t.me/${CONFIG.supportUsername}`, '_blank')
  }

  return (
    <PageTransition>
      <div
        style={{
          minHeight: '100vh',
          padding: '24px 20px max(40px, calc(env(safe-area-inset-bottom,0px) + 28px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient orbs */}
        <motion.div
          aria-hidden
          style={{
            position: 'absolute', top: -120, right: -80, width: 320, height: 320,
            background: 'radial-gradient(circle, rgba(0,125,187,0.28), transparent 65%)',
            filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
          }}
          animate={{ y: [0, 18, 0], x: [0, -10, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          style={{
            position: 'absolute', bottom: -120, left: -80, width: 300, height: 300,
            background: 'radial-gradient(circle, rgba(94,234,212,0.18), transparent 65%)',
            filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0,
          }}
          animate={{ y: [0, -16, 0], x: [0, 12, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Header */}
        <motion.header
          style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
        >
          <motion.button
            onClick={() => { haptic('light'); navigate(-1) }}
            whileHover={{ borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.04)' }}
            whileTap={{ scale: 0.96 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              height: 40, padding: '0 14px',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 4, background: 'transparent',
              color: 'var(--t-primary)', cursor: 'pointer',
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {t('Назад', 'Back')}
          </motion.button>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.16em',
            color: 'var(--t-muted)', textTransform: 'uppercase',
          }}>
            <motion.span
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 0 0 rgba(16,185,129,0.6)' }}
              animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0.55)', '0 0 0 8px rgba(16,185,129,0)'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
            {t('Онлайн · 24/7', 'Online · 24/7')}
          </div>
        </motion.header>

        {/* Title */}
        <motion.div
          style={{ position: 'relative', zIndex: 1, marginTop: 4 }}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.05 }}
        >
          <div style={{
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 11, letterSpacing: '0.2em',
            color: 'var(--brand, #5eead4)', textTransform: 'uppercase',
            marginBottom: 14, opacity: 0.85,
          }}>
            № 02 · {t('Канал связи', 'Contact channel')}
          </div>
          <h1 style={{
            fontSize: 'clamp(30px, 8vw, 38px)', lineHeight: 1.05,
            margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
            color: 'var(--t-primary)',
          }}>
            {t('Как с вами', 'How should we')}
            <br />
            <span style={{
              display: 'inline-block',
              paddingRight: '0.18em',
              background: 'linear-gradient(110deg, #fff 0%, #5eead4 50%, #fff 100%)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontStyle: 'italic',
            }}>
              {t('связаться?', 'reach you?')}
            </span>
          </h1>
          <div className="t-sm t-muted" style={{ marginTop: 12, maxWidth: 320 }}>
            {t(
              'Выберите удобный канал. Оба ведут к одной команде поддержки.',
              'Pick whichever feels right. Both reach the same human team.'
            )}
          </div>
        </motion.div>

        {/* Channels */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
          {/* In-app chat */}
          <motion.button
            onClick={openChat}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease, delay: 0.15 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            style={{
              position: 'relative',
              textAlign: 'left',
              padding: '34px 22px 22px',
              borderRadius: 22,
              border: '1px solid rgba(94,234,212,0.28)',
              background: 'linear-gradient(160deg, rgba(94,234,212,0.10) 0%, rgba(20,28,38,0.85) 55%, rgba(15,20,28,0.95) 100%)',
              color: 'var(--t-primary)',
              cursor: 'pointer',
              overflow: 'hidden',
              boxShadow: '0 24px 60px -28px rgba(94,234,212,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Recommended ribbon — corner chip, не растягивает карточку */}
            <span style={{
              position: 'absolute', top: 14, right: 14,
              padding: '4px 9px', borderRadius: 999,
              background: 'rgba(94,234,212,0.14)',
              border: '1px solid rgba(94,234,212,0.4)',
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#5eead4', fontWeight: 700,
              pointerEvents: 'none',
              zIndex: 2,
            }}>
              {t('Рекомендуем', 'Recommended')}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Animated chat avatar */}
              <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
                <motion.div
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '1px solid rgba(94,234,212,0.35)',
                  }}
                  animate={{ scale: [1, 1.25, 1.25], opacity: [0.5, 0, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
                />
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'radial-gradient(120% 90% at 30% 20%, #0e3835 0%, #04201f 80%)',
                  border: '1px solid rgba(94,234,212,0.35)',
                  display: 'grid', placeItems: 'center',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 0 14px rgba(94,234,212,0.22), 0 8px 24px -12px rgba(94,234,212,0.5)',
                }}>
                  <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
                    <defs>
                      <linearGradient id="hub-lc-a" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a8fff0" />
                        <stop offset="100%" stopColor="#5eead4" />
                      </linearGradient>
                      <linearGradient id="hub-lc-b" x1="1" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5eead4" />
                        <stop offset="100%" stopColor="#0ea5a3" />
                      </linearGradient>
                    </defs>
                    <motion.path
                      d="M4 9c0-2.2 1.8-4 4-4h13c2.2 0 4 1.8 4 4v6c0 2.2-1.8 4-4 4h-9l-5 4v-4c-1.7-.3-3-1.8-3-3.6V9z"
                      fill="url(#hub-lc-a)"
                      animate={{ y: [0, -0.4, 0] }}
                      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.path
                      d="M36 23c0-2.2-1.8-4-4-4H19c-2.2 0-4 1.8-4 4v6c0 2.2 1.8 4 4 4h9l5 4v-4c1.7-.3 3-1.8 3-3.6v-6.4z"
                      fill="url(#hub-lc-b)"
                      animate={{ y: [0, 0.4, 0] }}
                      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                    />
                    {[0, 1, 2].map((i) => (
                      <motion.circle
                        key={i}
                        cx={21 + i * 4}
                        cy={28}
                        r={1.4}
                        fill="#04201f"
                        animate={{ opacity: [0.35, 1, 0.35] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                      />
                    ))}
                  </svg>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>
                  {t('Живой чат', 'Live chat')}
                </div>
                <div className="t-xs t-muted" style={{ marginTop: 4 }}>
                  {t('Прямо в приложении · отвечаем за минуты', 'Right inside the app · replies in minutes')}
                </div>
              </div>

              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '1px solid rgba(94,234,212,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#5eead4', flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </motion.div>
            </div>

            {/* Footer line */}
            <div style={{
              marginTop: 18, paddingTop: 14,
              borderTop: '1px dashed rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--t-muted)',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                {t('Поддержка онлайн', 'Agent online')}
              </span>
              <span>
                {messagesCount > 0
                  ? t(`${messagesCount} сообщ.`, `${messagesCount} msg`)
                  : t('Новый чат', 'New chat')}
                {supportUnread > 0 && <span style={{ color: '#5eead4', marginLeft: 8 }}>· {supportUnread} {t('новых', 'new')}</span>}
              </span>
            </div>
          </motion.button>

          {/* Telegram direct */}
          <motion.button
            onClick={openTg}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease, delay: 0.25 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            style={{
              position: 'relative',
              textAlign: 'left',
              padding: '34px 22px 22px',
              borderRadius: 22,
              border: '1px solid rgba(55,187,254,0.28)',
              background: 'linear-gradient(160deg, rgba(55,187,254,0.10) 0%, rgba(18,26,38,0.85) 55%, rgba(15,20,28,0.95) 100%)',
              color: 'var(--t-primary)',
              cursor: 'pointer',
              overflow: 'hidden',
              boxShadow: '0 24px 60px -28px rgba(55,187,254,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(55,187,254,0.35), transparent 70%)',
                    filter: 'blur(8px)',
                  }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* Flight trail */}
                <svg
                  aria-hidden
                  width="44" height="20" viewBox="0 0 44 20"
                  style={{ position: 'absolute', left: -6, top: '50%', marginTop: -10, opacity: 0.5, pointerEvents: 'none' }}
                >
                  <motion.path
                    d="M2 10 Q 14 3 24 10 T 42 10"
                    fill="none" stroke="#37BBFE" strokeWidth="1.1" strokeDasharray="3 5" strokeLinecap="round"
                    animate={{ strokeDashoffset: [0, -16] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                  />
                </svg>
                <motion.div
                  animate={{ x: [-2, 3, -2], y: [1, -2, 1], rotate: [-5, 6, -5] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ position: 'relative', borderRadius: '50%', boxShadow: '0 10px 30px -10px rgba(55,187,254,0.7)' }}
                >
                  <TelegramMark size={54} />
                </motion.div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>
                  {t('Открыть в Telegram', 'Open in Telegram')}
                </div>
                <div className="t-xs t-muted" style={{ marginTop: 4 }}>
                  @{CONFIG.supportUsername} · {t('Напрямую к админу', 'Talk to admin directly')}
                </div>
              </div>

              <motion.div
                whileHover={{ rotate: -45 }}
                transition={{ type: 'spring', stiffness: 300 }}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '1px solid rgba(55,187,254,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#37BBFE', flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M9 7h8v8"/>
                </svg>
              </motion.div>
            </div>

            <div style={{
              marginTop: 18, paddingTop: 14,
              borderTop: '1px dashed rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--t-muted)',
            }}>
              <span>{t('Внешнее приложение', 'External app')}</span>
              <span style={{ color: '#37BBFE' }}>{t('Telegram →', 'Telegram →')}</span>
            </div>
          </motion.button>
        </div>

        {/* Bottom note */}
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{
            position: 'relative', zIndex: 1,
            marginTop: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '14px 16px',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.02)',
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--t-muted)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          {t('Среднее время ответа · до 30 минут', 'Avg response · under 30 min')}
        </motion.div>
      </div>
    </PageTransition>
  )
}
