import { useState } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import type { SiteLinks, SiteContent } from '../store'
import type { CryptoNetwork } from '../store/types'

const TABS = ['links', 'texts', 'ref_coins'] as const
type Tab = typeof TABS[number]

const TAB_META: Record<Tab, { emoji: string; ru: string; en: string }> = {
  links:     { emoji: '🔗', ru: 'Ссылки',  en: 'Links' },
  texts:     { emoji: '📝', ru: 'Тексты',  en: 'Texts' },
  ref_coins: { emoji: '💰', ru: 'Монеты вывода', en: 'Withdraw coins' },
}

const LINK_FIELDS: { key: keyof SiteLinks; emoji: string; label: string; hint: string }[] = [
  { key: 'botUrl',       emoji: '🤖', label: 'Бот',                       hint: 'https://t.me/your_bot' },
  { key: 'channelUrl',   emoji: '📢', label: 'Канал / новости',           hint: 'https://t.me/your_channel' },
  { key: 'reviewsUrl',   emoji: '⭐', label: 'Отзывы',                    hint: 'https://t.me/your_reviews' },
  { key: 'chatUrl',      emoji: '💬', label: 'Общий чат',                 hint: 'https://t.me/your_chat' },
  { key: 'communityUrl', emoji: '👥', label: 'Сообщество',                hint: 'https://t.me/your_community' },
  { key: 'supportUrl',   emoji: '🛟', label: 'Поддержка',                 hint: 'https://t.me/your_support' },
  { key: 'adminUrl',     emoji: '👤', label: 'Админ (контакт)',           hint: 'https://t.me/your_admin' },
  { key: 'securityInstructionUrl', emoji: '🔒', label: 'Инструкция безопасности', hint: 'https://...' },
]

const TEXT_FIELDS: { key: keyof SiteContent; emoji: string; label: string }[] = [
  { key: 'offer_ru',           emoji: '📜', label: 'Оферта (RU)' },
  { key: 'offer_en',           emoji: '📜', label: 'Оферта (EN)' },
  { key: 'rules_ru',           emoji: '📋', label: 'Правила (RU)' },
  { key: 'rules_en',           emoji: '📋', label: 'Правила (EN)' },
  { key: 'contacts_ru',        emoji: '📞', label: 'Контакты (RU)' },
  { key: 'contacts_en',        emoji: '📞', label: 'Контакты (EN)' },
  { key: 'referral_rules_ru',  emoji: '🤝', label: 'Реферальные правила (RU)' },
  { key: 'referral_rules_en',  emoji: '🤝', label: 'Реферальные правила (EN)' },
]

function EditableLink({ field }: { field: typeof LINK_FIELDS[number] }) {
  const lang     = useStore((s) => s.lang)
  const links    = useStore((s) => s.siteLinks)
  const setLink  = useStore((s) => s.setSiteLink)
  const toast    = useToast()
  const { haptic } = useTelegram()
  const [value, setValue] = useState(links[field.key])
  const [editing, setEditing] = useState(false)

  const save = () => {
    setLink(field.key, value.trim())
    toast.show(lang === 'ru' ? 'Сохранено' : 'Saved', 'success')
    haptic('success')
    setEditing(false)
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{field.emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{field.label}</span>
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.hint}
            style={{ fontSize: 12, fontFamily: 'monospace' }}
          />
          {field.key === 'channelUrl' && (
            <div className="t-xs t-muted" style={{ lineHeight: 1.4 }}>
              {lang === 'ru'
                ? 'Для закрытых каналов используйте инвайт-ссылку (t.me/+ABC...)'
                : 'For private channels use invite links (t.me/+ABC...)'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={save}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: '#22c55e', color: '#000', border: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {lang === 'ru' ? 'СОХРАНИТЬ' : 'SAVE'}
            </button>
            <button
              onClick={() => { setValue(links[field.key]); setEditing(false) }}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {lang === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, fontSize: 11, fontFamily: 'monospace',
            color: links[field.key] ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {links[field.key] || (lang === 'ru' ? '— не задано —' : '— not set —')}
          </div>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {lang === 'ru' ? 'ИЗМЕНИТЬ' : 'EDIT'}
          </button>
        </div>
      )}
    </div>
  )
}

function EditableText({ field }: { field: typeof TEXT_FIELDS[number] }) {
  const lang = useStore((s) => s.lang)
  const content = useStore((s) => s.siteContent)
  const setContent = useStore((s) => s.setSiteContent)
  const toast = useToast()
  const { haptic } = useTelegram()
  const [value, setValue] = useState(content[field.key])
  const [editing, setEditing] = useState(false)

  const save = () => {
    setContent(field.key, value)
    toast.show(lang === 'ru' ? 'Сохранено' : 'Saved', 'success')
    haptic('success')
    setEditing(false)
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{field.emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{field.label}</span>
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            style={{ fontSize: 12, resize: 'vertical', minHeight: 80 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={save}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: '#22c55e', color: '#000', border: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {lang === 'ru' ? 'СОХРАНИТЬ' : 'SAVE'}
            </button>
            <button
              onClick={() => { setValue(content[field.key]); setEditing(false) }}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {lang === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{
            flex: 1, fontSize: 12,
            color: content[field.key] ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
            whiteSpace: 'pre-wrap', lineHeight: 1.5,
            maxHeight: 60, overflow: 'hidden',
          }}>
            {content[field.key] || (lang === 'ru' ? '— пусто —' : '— empty —')}
          </div>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {lang === 'ru' ? 'ИЗМЕНИТЬ' : 'EDIT'}
          </button>
        </div>
      )}
    </div>
  )
}

function RefCoinSelector() {
  const lang = useStore((s) => s.lang)
  const networks = useStore((s) => s.refWithdrawNetworks)
  const setNetworks = useStore((s) => s.setRefWithdrawNetworks)
  const toast = useToast()
  const { haptic } = useTelegram()

  const toggle = (id: CryptoNetwork) => {
    const next = networks.includes(id)
      ? networks.filter((n) => n !== id)
      : [...networks, id]
    setNetworks(next)
    haptic('light')
    toast.show(lang === 'ru' ? 'Обновлено' : 'Updated', 'success')
  }

  return (
    <div>
      <div className="t-xs t-muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>
        {lang === 'ru'
          ? 'Выберите монеты, в которых пользователи смогут выводить реферальный баланс.'
          : 'Select which coins users can withdraw their referral balance in.'}
      </div>
      {CRYPTO_OPTIONS.map((opt) => {
        const active = networks.includes(opt.id)
        return (
          <motion.button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', marginBottom: 8,
              background: active ? 'rgba(57,255,99,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${active ? 'rgba(57,255,99,0.25)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 12, cursor: 'pointer', color: '#fff',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 18 }}>{opt.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{opt.symbol}</div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: active ? '#22c55e' : 'rgba(255,255,255,0.06)',
              border: `1.5px solid ${active ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 900, color: active ? '#000' : 'transparent',
            }}>
              ✓
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

export default function AdminCustomize() {
  const lang = useStore((s) => s.lang)
  const [tab, setTab] = useState<Tab>('links')

  return (
    <PageTransition>
      <div className="page">
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
            fontFamily: "'JetBrains Mono', monospace", marginBottom: 6,
          }}>
            /admin/customize
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#fff' }}>
            🎨 {lang === 'ru' ? 'Кастомизация' : 'Customization'}
          </h2>
        </div>

        {/* Tab pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map((t) => {
            const meta = TAB_META[t]
            const active = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '8px 14px', borderRadius: 999,
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.1em',
                  background: active ? '#39ff63' : 'rgba(255,255,255,0.04)',
                  color: active ? '#000' : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${active ? '#39ff63' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {meta.emoji} {lang === 'ru' ? meta.ru : meta.en}
              </button>
            )
          })}
        </div>

        {tab === 'links' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {LINK_FIELDS.map((f) => <EditableLink key={f.key} field={f} />)}
          </motion.div>
        )}

        {tab === 'texts' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {TEXT_FIELDS.map((f) => <EditableText key={f.key} field={f} />)}
          </motion.div>
        )}

        {tab === 'ref_coins' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <RefCoinSelector />
          </motion.div>
        )}
      </div>
    </PageTransition>
  )
}
