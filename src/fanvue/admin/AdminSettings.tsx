import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import CryptoLogo from '../components/CryptoLogo'
import type { CryptoNetwork } from '../store/types'
import type { SiteLinks } from '../store'

const LINK_FIELDS: { key: keyof SiteLinks; label: string; hint: string }[] = [
  { key: 'supportUrl',   label: 'Поддержка / связь со мной', hint: 'https://t.me/your_support' },
  { key: 'adminUrl',     label: 'Админ (контакт)',           hint: 'https://t.me/your_admin' },
  { key: 'chatUrl',      label: 'Общий чат',                 hint: 'https://t.me/your_chat' },
  { key: 'communityUrl', label: 'Сообщество',                hint: 'https://t.me/your_community' },
  { key: 'channelUrl',   label: 'Канал с новостями',         hint: 'https://t.me/your_channel' },
  { key: 'reviewsUrl',   label: 'Отзывы',                    hint: 'https://t.me/your_reviews' },
  { key: 'botUrl',       label: 'Бот',                       hint: 'https://t.me/your_bot' },
  { key: 'securityInstructionUrl', label: 'Инструкция по безопасности (в блоке выдачи)', hint: 'https://example.com/safety' },
]

function LinkRow({ field }: { field: typeof LINK_FIELDS[number] }) {
  const lang     = useStore((s) => s.lang)
  const links    = useStore((s) => s.siteLinks)
  const setLink  = useStore((s) => s.setSiteLink)
  const toast    = useToast()
  const { haptic } = useTelegram()
  const [value, setValue] = useState(links[field.key])
  const [editing, setEditing] = useState(false)

  const save = () => {
    setLink(field.key, value.trim())
    toast.show(lang === 'ru' ? 'Ссылка сохранена' : 'Link saved', 'success')
    haptic('success')
    setEditing(false)
  }

  return (
    <motion.div className="card mb-3" style={{ padding: 14 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="t-sm fw-bold mb-1">{field.label}</div>
      {editing ? (
        <div className="col gap-2">
          <input
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.hint}
            style={{ fontSize: 12, fontFamily: 'monospace' }}
          />
          <div className="row gap-2">
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={save}>
              {lang === 'ru' ? 'Сохранить' : 'Save'}
            </button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setValue(links[field.key]); setEditing(false) }}>
              {lang === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="address-text" style={{ padding: 10, background: 'var(--surface)', borderRadius: 10, fontSize: 11, marginBottom: 10, wordBreak: 'break-all' }}>
            {links[field.key] || (lang === 'ru' ? '— не задано —' : '— not set —')}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setEditing(true)}>
            {lang === 'ru' ? 'Изменить' : 'Edit'}
          </button>
        </>
      )}
    </motion.div>
  )
}

function AddressRow({ network }: { network: typeof CRYPTO_OPTIONS[number] }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const addresses = useStore((s) => s.cryptoAddresses)
  const setAddress = useStore((s) => s.setCryptoAddress)
  const qrOverrides = useStore((s) => s.qrOverrides)
  const setQrOverride = useStore((s) => s.setQrOverride)
  const toast = useToast()
  const { haptic } = useTelegram()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(addresses[network.id])

  const save = () => {
    setAddress(network.id, value.trim())
    toast.show(lang === 'ru' ? 'Адрес сохранён' : 'Address saved', 'success')
    haptic('success')
    setEditing(false)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      toast.show(lang === 'ru' ? 'Файл > 1 МБ' : 'File > 1 MB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setQrOverride(network.id, reader.result as string)
      toast.show(lang === 'ru' ? 'QR загружен' : 'QR uploaded', 'success')
      haptic('success')
    }
    reader.readAsDataURL(file)
  }

  const removeQr = () => {
    setQrOverride(network.id, null)
    toast.show(lang === 'ru' ? 'QR удалён' : 'QR removed', 'info')
  }

  const hasQr = !!qrOverrides[network.id]

  return (
    <motion.div
      className="card mb-3"
      style={{ padding: '14px' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="row gap-3 mb-3">
        <CryptoLogo network={network.id} size={40} />
        <div style={{ flex: 1 }}>
          <div className="t-sm fw-bold">{network.name}</div>
          <div className="t-xs t-muted">{network.symbol}</div>
        </div>
        {hasQr && (
          <span className="badge badge-completed" style={{ fontSize: 10 }}>QR</span>
        )}
      </div>

      {editing ? (
        <div className="col gap-2">
          <input
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={network.name}
            style={{ fontSize: 12, fontFamily: 'monospace' }}
          />
          <div className="row gap-2">
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={save}>
              {t('admin_save')}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={() => { setValue(addresses[network.id]); setEditing(false) }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="address-text"
            style={{ padding: 10, background: 'var(--surface)', borderRadius: 10, fontSize: 11, marginBottom: 10 }}
          >
            {addresses[network.id] || (lang === 'ru' ? '— не задано —' : '— not set —')}
          </div>
          <div className="row gap-2">
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setEditing(true)}>
              {lang === 'ru' ? 'Изменить' : 'Edit'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={() => fileRef.current?.click()}
            >
              📷 {hasQr ? (lang === 'ru' ? 'Заменить QR' : 'Replace QR') : t('admin_qr_upload')}
            </button>
            {hasQr && (
              <button className="btn btn-danger btn-sm" onClick={removeQr} style={{ width: 'auto', padding: '8px 12px' }}>
                🗑
              </button>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </>
      )}
    </motion.div>
  )
}

export default function AdminSettings() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const maintenance = useStore((s) => s.maintenance)
  const toggleMaintenance = useStore((s) => s.toggleMaintenance)
  const toast = useToast()

  const handleToggle = () => {
    toggleMaintenance()
    toast.show(
      maintenance
        ? (lang === 'ru' ? 'Режим обслуживания выключен' : 'Maintenance OFF')
        : (lang === 'ru' ? 'Режим обслуживания включён' : 'Maintenance ON'),
      'info',
    )
  }

  return (
    <PageTransition>
      <div className="page">
        {/* Maintenance toggle */}
        <div className="section-title mb-3">{t('admin_maintenance')}</div>
        <motion.div
          className="card mb-5"
          style={{
            padding: '16px',
            background: maintenance ? 'rgba(239,68,68,0.08)' : 'var(--surface)',
            border: maintenance ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--b-default)',
          }}
        >
          <div className="row-between">
            <div style={{ flex: 1 }}>
              <div className="t-sm fw-bold">
                {maintenance ? t('admin_maintenance_on') : t('admin_maintenance_off')}
              </div>
              <div className="t-xs t-muted mt-1">
                {lang === 'ru' ? 'Боту прекращают приходить новые заказы' : 'No new orders accepted'}
              </div>
            </div>
            <motion.button
              className="lang-toggle"
              style={{ width: 56, height: 30, padding: 3 }}
              onClick={handleToggle}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: maintenance ? 'var(--red)' : 'var(--green)',
                  position: 'absolute', top: 3,
                }}
                animate={{ left: maintenance ? 28 : 3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            </motion.button>
          </div>
        </motion.div>

        {/* Crypto addresses */}
        <div className="section-title mb-2">{t('admin_addresses')}</div>
        <div className="t-xs t-muted mb-3">{t('admin_addr_hint')}</div>
        <div className="t-xs t-muted mb-4" style={{ lineHeight: 1.5 }}>
          {t('admin_qr_hint')}
        </div>

        {CRYPTO_OPTIONS.map((opt) => (
          <AddressRow key={opt.id} network={opt} />
        ))}

        {/* Site links */}
        <div className="section-title mt-5 mb-2">
          {lang === 'ru' ? 'Ссылки и контакты' : 'Links & contacts'}
        </div>
        <div className="t-xs t-muted mb-3">
          {lang === 'ru'
            ? 'Чат, отзывы, канал, связь со мной — меняй в любое время, изменения видны сразу.'
            : 'Chat, reviews, channel, contact — edit anytime, changes apply instantly.'}
        </div>
        {LINK_FIELDS.map((f) => <LinkRow key={f.key} field={f} />)}
      </div>
    </PageTransition>
  )
}

export function _useNoUnused(_x: CryptoNetwork) { /* satisfies type-only import */ }
