import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import type { SiteLinks, SiteContent } from '../store'
import type { CryptoNetwork } from '../store/types'

const TABS = ['links', 'texts', 'ref_coins'] as const
type Tab = typeof TABS[number]

const TAB_META: Record<Tab, { ru: string; en: string }> = {
  links:     { ru: 'Ссылки',  en: 'Links' },
  texts:     { ru: 'Тексты',  en: 'Texts' },
  ref_coins: { ru: 'Монеты вывода', en: 'Withdraw coins' },
}

const LINK_FIELDS: { key: keyof SiteLinks; label: string; hint: string }[] = [
  { key: 'botUrl',       label: 'Бот',                       hint: 'https://t.me/your_bot' },
  { key: 'channelUrl',   label: 'Канал / новости',           hint: 'https://t.me/your_channel' },
  { key: 'reviewsUrl',   label: 'Отзывы',                    hint: 'https://t.me/your_reviews' },
  { key: 'chatUrl',      label: 'Общий чат',                 hint: 'https://t.me/your_chat' },
  { key: 'communityUrl', label: 'Сообщество',                hint: 'https://t.me/your_community' },
  { key: 'supportUrl',   label: 'Поддержка',                 hint: 'https://t.me/your_support' },
  { key: 'adminUrl',     label: 'Админ (контакт)',           hint: 'https://t.me/your_admin' },
  { key: 'securityInstructionUrl', label: 'Инструкция безопасности', hint: 'https://...' },
]

const TEXT_FIELDS: { key: keyof SiteContent; label: string }[] = [
  { key: 'offer_ru',           label: 'Оферта (RU)' },
  { key: 'offer_en',           label: 'Оферта (EN)' },
  { key: 'rules_ru',           label: 'Правила (RU)' },
  { key: 'rules_en',           label: 'Правила (EN)' },
  { key: 'contacts_ru',        label: 'Контакты (RU)' },
  { key: 'contacts_en',        label: 'Контакты (EN)' },
  { key: 'referral_rules_ru',  label: 'Реферальные правила (RU)' },
  { key: 'referral_rules_en',  label: 'Реферальные правила (EN)' },
]

function EditableLink({ field }: { field: typeof LINK_FIELDS[number] }) {
  const lang     = useStore((s) => s.lang)
  const links    = useStore((s) => s.siteLinks)
  const setLink  = useStore((s) => s.setSiteLink)
  const persist  = useStore((s) => s.persistAdminSettings)
  const toast    = useToast()
  const { haptic } = useTelegram()
  const [value, setValue] = useState(links[field.key])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(links[field.key])
  }, [links[field.key], field.key])

  const save = async () => {
    setSaving(true)
    setLink(field.key, value.trim())
    const ok = await persist({ siteLinks: useStore.getState().siteLinks })
    setSaving(false)
    if (!ok) {
      toast.show(lang === 'ru' ? 'Не удалось сохранить на сервер' : 'Failed to save to server', 'error')
      haptic('error')
      return
    }
    toast.show(lang === 'ru' ? 'Сохранено для всех' : 'Saved for everyone', 'success')
    haptic('success')
    setEditing(false)
  }

  return (
    <div className="adm-card" style={{ marginBottom: 8 }}>
      <div className="adm-section-label" style={{ marginBottom: 8 }}>{field.label}</div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="adm-input"
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
            <button type="button" className="adm-btn adm-btn--primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
              {saving ? (lang === 'ru' ? 'Сохранение…' : 'Saving…') : (lang === 'ru' ? 'Сохранить' : 'Save')}
            </button>
            <button
              type="button"
              className="adm-btn"
              style={{ flex: 1 }}
              onClick={() => { setValue(links[field.key]); setEditing(false) }}
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
          <button type="button" className="adm-btn" style={{ flexShrink: 0 }} onClick={() => setEditing(true)}>
            {lang === 'ru' ? 'Изменить' : 'Edit'}
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
  const persist = useStore((s) => s.persistAdminSettings)
  const toast = useToast()
  const { haptic } = useTelegram()
  const [value, setValue] = useState(content[field.key])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(content[field.key])
  }, [content[field.key], field.key])

  const save = async () => {
    setSaving(true)
    setContent(field.key, value)
    const ok = await persist({ siteContent: useStore.getState().siteContent })
    setSaving(false)
    if (!ok) {
      toast.show(lang === 'ru' ? 'Не удалось сохранить на сервер' : 'Failed to save to server', 'error')
      haptic('error')
      return
    }
    toast.show(lang === 'ru' ? 'Сохранено для всех' : 'Saved for everyone', 'success')
    haptic('success')
    setEditing(false)
  }

  return (
    <div className="adm-card" style={{ marginBottom: 8 }}>
      <div className="adm-section-label" style={{ marginBottom: 8 }}>{field.label}</div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            className="adm-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            style={{ fontSize: 12, resize: 'vertical', minHeight: 80 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="adm-btn adm-btn--primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
              {saving ? (lang === 'ru' ? 'Сохранение…' : 'Saving…') : (lang === 'ru' ? 'Сохранить' : 'Save')}
            </button>
            <button
              type="button"
              className="adm-btn"
              style={{ flex: 1 }}
              onClick={() => { setValue(content[field.key]); setEditing(false) }}
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
          <button type="button" className="adm-btn" style={{ flexShrink: 0 }} onClick={() => setEditing(true)}>
            {lang === 'ru' ? 'Изменить' : 'Edit'}
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
          <button
            key={opt.id}
            type="button"
            className="adm-menu-item"
            onClick={() => toggle(opt.id)}
            style={active ? { borderColor: 'rgba(61, 220, 132, 0.35)' } : undefined}
          >
            <div className="adm-menu-body">
              <div className="adm-menu-title">{opt.name}</div>
              <div className="adm-menu-desc">{opt.symbol}</div>
            </div>
            {active && <span className="adm-menu-badge">ON</span>}
          </button>
        )
      })}
    </div>
  )
}

export default function AdminCustomize() {
  const lang = useStore((s) => s.lang)
  const syncAdminData = useStore((s) => s.syncAdminData)
  const [tab, setTab] = useState<Tab>('links')

  useEffect(() => {
    syncAdminData()
  }, [syncAdminData])

  return (
    <PageTransition>
      <div className="adm-page">
        <div className="adm-seg" style={{ marginBottom: 20 }}>
          {TABS.map((tb) => {
            const meta = TAB_META[tb]
            return (
              <button
                key={tb}
                type="button"
                className={tab === tb ? 'is-active' : ''}
                onClick={() => setTab(tb)}
              >
                {lang === 'ru' ? meta.ru : meta.en}
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
