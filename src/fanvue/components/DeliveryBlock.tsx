import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { useToast } from './Toast'
import { useTelegram } from '../hooks/useTelegram'
import { CONFIG } from '../config'
import fanvueLogoUrl from '../assets/fanvue-logo.png'
import { Mail, ShieldCheck, ArrowUpRight, Copy } from 'lucide-react'

function FanvueMark({ size = 30 }: { size?: number }) {
  return (
    <img
      src={fanvueLogoUrl}
      alt="Fanvue"
      width={size}
      height={size}
      style={{ borderRadius: 7, display: 'block', objectFit: 'cover' }}
    />
  )
}

const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const GREEN = '#39ff63'

interface ParsedCreds {
  fanvue: { login?: string; password?: string }
  mail: { email?: string; password?: string }
  instructions: string[]
  extras: { key: string; value: string }[]
}

function parseCreds(text: string): ParsedCreds {
  const fanvue: ParsedCreds['fanvue'] = {}
  const mail: ParsedCreds['mail'] = {}
  const instructions: string[] = []
  const extras: ParsedCreds['extras'] = []

  const normalized = text.replace(/\r\n/g, '\n').trim()

  // Compact single-line format: login:password:email:emailpass:instruction
  // (matches when there are no key:value pairs and no newlines)
  if (!/\n/.test(normalized) && !/^[^:\n]+:\s+\S/.test(normalized)) {
    const parts = normalized.split(':').map((s) => s.trim()).filter(Boolean)
    if (parts.length >= 2) {
      if (parts[0]) fanvue.login = parts[0]
      if (parts[1]) fanvue.password = parts[1]
      if (parts[2]) mail.email = parts[2]
      if (parts[3]) mail.password = parts[3]
      if (parts.slice(4).length) instructions.push(parts.slice(4).join(': '))
      return { fanvue, mail, instructions, extras }
    }
  }

  for (const raw of normalized.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^([^:：]+)[:：]\s*(.+)$/)
    if (!m) { instructions.push(line); continue }
    const k = m[1].trim()
    const v = m[2].trim()
    const lk = k.toLowerCase()
    if (/инструкц|instruct|примеч|^note|safety|безопасн/.test(lk)) { instructions.push(v); continue }
    if (/(почт|mail|email).*парол|парол.*(почт|mail|email)|mail[ _-]?pass|email[ _-]?pass/.test(lk)) { mail.password = v; continue }
    if (/^(почт[аы]?|email|e[-_ ]?mail|mail)(?:\s|$)/.test(lk)) { mail.email = v; continue }
    if (/^(логин|login|username|user)(?:\s|$)/.test(lk)) { fanvue.login = v; continue }
    if (/^(пароль|password|pass)(?:\s|$)/.test(lk)) { fanvue.password = v; continue }
    extras.push({ key: k, value: v })
  }
  return { fanvue, mail, instructions, extras }
}

function normalizeExternalUrl(raw?: string) {
  const value = raw?.trim()
  if (!value) return ''
  const match = value.match(/https?:\/\/[^\s]+|(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:\/[^\s]*)?/i)
  const url = match?.[0]?.replace(/[),.;]+$/, '') ?? ''
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

// ============================================================
// Shared terminal shell — scanning gauge, header, footer CTA
// ============================================================

function ScanGauge() {
  return (
    <div style={{ position: 'relative', height: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', borderRadius: 2 }}>
      <motion.div
        animate={{ x: ['-100%', '300%'] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', top: 0, left: 0, height: '100%', width: '40%',
          background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`,
          filter: `drop-shadow(0 0 6px ${GREEN})`,
        }}
      />
    </div>
  )
}

function TerminalHeader({ title, subtitle, statusLabel }: { title: string; subtitle: string; statusLabel: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <motion.span
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '3px 8px', borderRadius: 4,
            border: `1px solid ${GREEN}55`, background: `${GREEN}1a`,
            color: GREEN, fontFamily: MONO, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.22em', textTransform: 'uppercase',
          }}
        >
          {statusLabel}
        </motion.span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, 0.45, 0.18].map((op, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [op, op * 0.4, op] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
              style={{ width: 3, height: 12, background: GREEN, opacity: op }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <motion.h2
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{
            margin: 0, fontFamily: DISPLAY, fontSize: 26, fontWeight: 700,
            letterSpacing: '-0.02em', color: '#fff',
            fontStyle: 'italic', textTransform: 'uppercase', lineHeight: 1,
          }}
        >
          {title}
        </motion.h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: GREEN,
            boxShadow: `0 0 8px ${GREEN}`, animation: 'fvPulse 1.6s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
            {subtitle}
          </span>
        </div>
      </div>
      <style>{`@keyframes fvPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:.6} }`}</style>
    </div>
  )
}

function OrderRefBlock({ orderId, onCopy, labelKey }: { orderId: string; onCopy: () => void; labelKey: string }) {
  return (
    <motion.button
      onClick={onCopy}
      whileTap={{ scale: 0.985 }}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      style={{
        width: '100%', textAlign: 'left',
        background: '#111', border: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 14px', borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', color: '#fff',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.32)',
          letterSpacing: '0.22em', textTransform: 'uppercase',
        }}>
          {labelKey}
        </span>
        <code style={{
          fontFamily: MONO, color: GREEN, fontSize: 13, fontWeight: 700,
          letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{orderId}</code>
      </div>
      <span style={{
        padding: 8, borderRadius: 6, color: GREEN, flexShrink: 0,
        background: 'rgba(57,255,99,0.08)', display: 'inline-flex',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="8" width="14" height="14" rx="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      </span>
    </motion.button>
  )
}

function isVerificationProduct(title?: string) {
  const value = title?.trim().toLowerCase() ?? ''
  return /верификац/.test(value) || /verif/.test(value)
}

function ActionButtons({ onChat, tgUrl, chatLabel, tgLabel, telegramPrimary = false }: {
  onChat?: () => void; tgUrl: string; chatLabel: string; tgLabel: string; telegramPrimary?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {onChat && (
        <motion.button
          onClick={onChat}
          whileTap={{ scale: 0.98 }}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            background: GREEN, color: '#000', border: 'none',
            fontFamily: DISPLAY, fontSize: 12, fontWeight: 700,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            cursor: 'pointer', boxShadow: `0 8px 28px -8px ${GREEN}66`,
          }}
        >
          {chatLabel}
        </motion.button>
      )}
      <motion.a
        href={tgUrl} target="_blank" rel="noopener noreferrer"
        whileTap={{ scale: 0.98 }}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        style={{
          width: '100%', padding: '13px 16px', borderRadius: 12,
          background: telegramPrimary ? 'linear-gradient(135deg, #2AABEE, #229ED9)' : 'rgba(255,255,255,0.04)',
          color: '#fff',
          border: telegramPrimary ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.1)',
          fontFamily: DISPLAY, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          textAlign: 'center', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: telegramPrimary ? '0 12px 34px -12px rgba(34,158,217,0.85)' : 'none',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>
        {tgLabel}
      </motion.a>
    </div>
  )
}

function TerminalShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'relative',
      background: '#0a0a0a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 16, overflow: 'hidden',
    }}>
      <ScanGauge />
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', bottom: 8, right: 8, width: 36, height: 36,
        borderRight: `1px solid ${GREEN}33`, borderBottom: `1px solid ${GREEN}33`,
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ============================================================
// DeliveryBlock — autofulfilled credentials
// ============================================================

function MailcomMark({ size = 26 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 6,
      background: 'linear-gradient(135deg, #00A4E4, #0077B6)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 12px -4px rgba(0,164,228,0.5)',
    }}>
      <Mail size={size * 0.6} color="#fff" strokeWidth={2.2} />
    </div>
  )
}

function BrandCredCard({
  brand, title, accent, rows, onCopy, delay = 0, href,
}: {
  brand: React.ReactNode
  title: string
  accent: string
  rows: { key: string; value: string }[]
  onCopy: (text: string, label: string) => void
  delay?: number
  href?: string
}) {
  const HeaderTag: any = href ? 'a' : 'div'
  const headerProps = href
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : {}
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: '#0f0f0f',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        opacity: 0.7,
      }} />
      <HeaderTag
        {...headerProps}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: `linear-gradient(180deg, ${accent}10, transparent)`,
          textDecoration: 'none', color: 'inherit',
          cursor: href ? 'pointer' : 'default',
        }}
      >
        {brand}
        <div style={{
          flex: 1,
          fontFamily: DISPLAY, fontSize: 15, fontWeight: 800, color: '#fff',
          letterSpacing: '-0.015em', lineHeight: 1.15,
        }}>{title}</div>
        {href && (
          <ArrowUpRight size={16} color="rgba(255,255,255,0.5)" />
        )}
      </HeaderTag>
      <div>
        {rows.map((row, ri) => (
          <button
            key={ri}
            onClick={() => onCopy(row.value, row.key)}
            style={{
              width: '100%', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, padding: '12px 14px',
              background: 'transparent', color: '#fff', border: 'none',
              borderTop: ri === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
              <span style={{
                fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.2em', textTransform: 'uppercase',
              }}>{row.key}</span>
              <span style={{
                fontFamily: MONO, fontSize: 13, fontWeight: 700, color: '#fff',
                wordBreak: 'break-all',
              }}>{row.value}</span>
            </div>
            <span style={{
              padding: 7, borderRadius: 6, color: accent,
              background: `${accent}1f`, display: 'inline-flex', flexShrink: 0,
            }}>
              <Copy size={13} strokeWidth={2} />
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}

export default function DeliveryBlock({ data, orderId }: { data: string; orderId?: string }) {
  const lang = useStore((s) => s.lang)
  const toast = useToast()
  const { haptic } = useTelegram()
  const navigate = useNavigate()
  const parsed = useMemo(() => parseCreds(data), [data])
  const tgUrl = `https://t.me/${CONFIG.supportUsername}`
  const savedSecurityUrl = useStore((s) => s.siteLinks?.securityInstructionUrl)
  const securityUrl = normalizeExternalUrl(parsed.instructions[0]) || normalizeExternalUrl(savedSecurityUrl) || normalizeExternalUrl(CONFIG.securityInstructionUrl)

  const hasAnyParsed =
    !!parsed.fanvue.login || !!parsed.fanvue.password ||
    !!parsed.mail.email || !!parsed.mail.password ||
    parsed.extras.length > 0

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text) } catch { }
    haptic('success')
    toast.show(`${label} ${lang === 'ru' ? 'скопирован' : 'copied'}`, 'success')
  }

  return (
    <TerminalShell>
      <TerminalHeader
        statusLabel={lang === 'ru' ? 'Доставлено' : 'Delivered'}
        title={lang === 'ru' ? 'Доступ выдан' : 'Access granted'}
        subtitle={lang === 'ru' ? 'Сохраните данные в надёжном месте' : 'Save credentials securely'}
      />

      {orderId && (
        <OrderRefBlock
          orderId={orderId}
          onCopy={() => copy(orderId, lang === 'ru' ? 'ID' : 'ID')}
          labelKey={lang === 'ru' ? 'Order Reference' : 'Order Reference'}
        />
      )}

      {/* Branded credentials */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!hasAnyParsed ? (
          <BrandCredCard
            delay={0.12}
            brand={<FanvueMark size={30} />}
            title={lang === 'ru' ? 'Данные для входа Fanvue' : 'Fanvue login data'}
            accent="#39ff63"
            rows={[{ key: lang === 'ru' ? 'Доступ' : 'Access', value: data.trim() }]}
            onCopy={copy}
            href="https://www.fanvue.com"
          />
        ) : (
          <>
            {(parsed.fanvue.login || parsed.fanvue.password) && (
              <BrandCredCard
                delay={0.12}
                brand={<FanvueMark size={30} />}
                title={lang === 'ru' ? 'Данные для входа Fanvue' : 'Fanvue login data'}
                accent="#39ff63"
                rows={[
                  parsed.fanvue.login ? { key: lang === 'ru' ? 'Логин' : 'Login', value: parsed.fanvue.login } : null,
                  parsed.fanvue.password ? { key: lang === 'ru' ? 'Пароль' : 'Password', value: parsed.fanvue.password } : null,
                ].filter(Boolean) as { key: string; value: string }[]}
                onCopy={copy}
                href="https://www.fanvue.com"
              />
            )}

            {(parsed.mail.email || parsed.mail.password) && (
              <BrandCredCard
                delay={0.18}
                brand={<MailcomMark size={26} />}
                title={lang === 'ru' ? 'Данные для входа mail.com' : 'mail.com login data'}
                accent="#00A4E4"
                rows={[
                  parsed.mail.email ? { key: lang === 'ru' ? 'Почта' : 'Email', value: parsed.mail.email } : null,
                  parsed.mail.password ? { key: lang === 'ru' ? 'Пароль' : 'Password', value: parsed.mail.password } : null,
                ].filter(Boolean) as { key: string; value: string }[]}
                onCopy={copy}
                href="https://www.mail.com"
              />
            )}

            {parsed.extras.length > 0 && (
              <BrandCredCard
                delay={0.22}
                brand={null}
                title={lang === 'ru' ? 'Дополнительно' : 'Additional'}
                accent={GREEN}
                rows={parsed.extras}
                onCopy={copy}
              />
            )}

            {/* Security instruction — opens external URL */}
            <motion.a
              href={securityUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic('light')}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 14px',
                border: `1px solid ${GREEN}40`,
                borderRadius: 12,
                background: `${GREEN}10`,
                color: GREEN, textDecoration: 'none', cursor: 'pointer',
              }}
            >
              <ShieldCheck size={18} />
              <span style={{
                flex: 1, fontFamily: DISPLAY, fontSize: 13, fontWeight: 800,
                letterSpacing: '0.12em', textTransform: 'uppercase', color: GREEN,
              }}>
                {lang === 'ru' ? 'Инструкция по безопасности' : 'Security instructions'}
              </span>
              <ArrowUpRight size={16} />
            </motion.a>
          </>
        )}
      </div>

      <ActionButtons
        onChat={() => navigate('/support/chat')}
        tgUrl={tgUrl}
        chatLabel={lang === 'ru' ? 'Чат поддержки' : 'Support chat'}
        tgLabel="Telegram"
      />
    </TerminalShell>
  )
}

// ============================================================
// ManualDeliveryBlock — pending manual fulfillment
// ============================================================

export function ManualDeliveryBlock({
  orderId,
  productTitle,
  amount,
  createdAt,
}: {
  orderId: string
  productTitle?: string
  amount?: number
  createdAt?: string
}) {
  const lang = useStore((s) => s.lang)
  const toast = useToast()
  const { haptic } = useTelegram()
  const navigate = useNavigate()
  const sendOrderReceipt = useStore((s) => s.sendOrderReceipt)
  const tgUrl = `https://t.me/${CONFIG.supportUsername}`
  const isVerification = isVerificationProduct(productTitle)

  const copyId = async () => {
    try { await navigator.clipboard.writeText(orderId) } catch { }
    haptic('success')
    toast.show(lang === 'ru' ? 'ID скопирован' : 'ID copied', 'success')
  }

  const time = new Date().toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })

  const handleOpenChat = () => {
    if (orderId && orderId !== '—' && productTitle && typeof amount === 'number') {
      sendOrderReceipt({
        orderId,
        productTitle,
        amount,
        currency: 'USD',
        createdAt: createdAt ?? new Date().toISOString(),
        stage: 'processing',
      })
    }
    navigate('/support/chat')
  }

  return (
    <TerminalShell>
      <TerminalHeader
        statusLabel={lang === 'ru' ? 'В обработке' : 'Processing'}
        title={lang === 'ru' ? 'Заказ создан' : 'Order created'}
        subtitle={lang === 'ru' ? 'Ожидаем подтверждение оператора' : 'Awaiting operator confirmation'}
      />

      <OrderRefBlock
        orderId={orderId}
        onCopy={copyId}
        labelKey="Order Reference"
      />

      {/* Tech specs grid */}
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.14 }}
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {[
          { k: 'Status', v: '0x24_QUEUED', accent: true },
          { k: 'Timestamp', v: time },
          { k: 'Channel', v: lang === 'ru' ? 'Оператор / TG' : 'Operator / TG' },
        ].map((row, i) => (
          <div
            key={row.k}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 0',
              borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <span style={{
              fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>{row.k}</span>
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              color: row.accent ? GREEN : '#fff',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>{row.v}</span>
          </div>
        ))}
      </motion.div>

      <p style={{
        margin: 0, fontFamily: DISPLAY, fontSize: 13, lineHeight: 1.55,
        color: 'rgba(255,255,255,0.6)',
      }}>
        {isVerification
          ? (lang === 'ru'
            ? 'Свяжитесь с нами в Telegram — оператор подскажет, какие данные нужны для аккуратной верификации аккаунта.'
            : 'Contact us in Telegram — an operator will tell you what data is needed for careful account verification.')
          : lang === 'ru'
          ? 'Напишите нам в чат поддержки или в Telegram — мы выдадим данные заказа вручную в течение нескольких минут.'
          : 'Message support chat or Telegram — we will deliver the credentials manually within a few minutes.'}
      </p>

      <ActionButtons
        onChat={isVerification ? undefined : handleOpenChat}
        tgUrl={tgUrl}
        chatLabel={lang === 'ru' ? 'Написать в чат поддержки' : 'Open support chat'}
        tgLabel="Telegram"
        telegramPrimary={isVerification}
      />
    </TerminalShell>
  )
}

