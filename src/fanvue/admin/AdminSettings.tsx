import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useStore, CRYPTO_OPTIONS } from '../store'
import { AdminSection, AdminCard, AdminToggle } from './ui'
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
    <motion.div className="adm-card" style={{ marginBottom: 8 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="t-sm fw-bold mb-1">{field.label}</div>
      {editing ? (
        <div className="col gap-2">
          <input
            className="adm-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.hint}
            style={{ fontSize: 12, fontFamily: 'monospace' }}
          />
          <div className="row gap-2">
            <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" style={{ flex: 1 }} onClick={save}>
              {lang === 'ru' ? 'Сохранить' : 'Save'}
            </button>
            <button type="button" className="adm-btn adm-btn--sm" style={{ flex: 1 }} onClick={() => { setValue(links[field.key]); setEditing(false) }}>
              {lang === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="adm-mono">
            {links[field.key] || (lang === 'ru' ? '— не задано —' : '— not set —')}
          </div>
          <button type="button" className="adm-btn adm-btn--sm adm-btn--block" onClick={() => setEditing(true)}>
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
      className="adm-card"
      style={{ marginBottom: 8 }}
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
          <span className="adm-badge adm-badge--ok">QR</span>
        )}
      </div>

      {editing ? (
        <div className="col gap-2">
          <input
            className="adm-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={network.name}
            style={{ fontSize: 12, fontFamily: 'monospace' }}
          />
          <div className="row gap-2">
            <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" style={{ flex: 1 }} onClick={save}>
              {t('admin_save')}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--sm"
              style={{ flex: 1 }}
              onClick={() => { setValue(addresses[network.id]); setEditing(false) }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="adm-mono">
            {addresses[network.id] || (lang === 'ru' ? '— не задано —' : '— not set —')}
          </div>
          <div className="adm-btn-row">
            <button type="button" className="adm-btn adm-btn--sm" style={{ flex: 1 }} onClick={() => setEditing(true)}>
              {lang === 'ru' ? 'Изменить' : 'Edit'}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--sm"
              style={{ flex: 1 }}
              onClick={() => fileRef.current?.click()}
            >
              {hasQr ? (lang === 'ru' ? 'Заменить QR' : 'Replace QR') : t('admin_qr_upload')}
            </button>
            {hasQr && (
              <button type="button" className="adm-btn adm-btn--sm adm-btn--danger" onClick={removeQr}>
                {lang === 'ru' ? 'Удалить QR' : 'Remove QR'}
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
  const syncAdminData = useStore((s) => s.syncAdminData)
  const toast = useToast()

  useEffect(() => {
    syncAdminData()
  }, [syncAdminData])

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
      <div className="adm-page">
        <AdminSection label={t('admin_maintenance')}>
          <AdminCard variant={maintenance ? 'danger' : undefined}>
            <AdminToggle
              on={maintenance}
              onToggle={handleToggle}
              label={maintenance ? (lang === 'ru' ? 'Магазин закрыт' : 'Shop closed') : (lang === 'ru' ? 'Магазин открыт' : 'Shop open')}
              description={lang === 'ru' ? 'Синхронизируется на все устройства' : 'Syncs across all devices'}
            />
          </AdminCard>
        </AdminSection>

        <AdminSection label={t('admin_addresses')}>
        <p style={{ margin: '0 0 12px', fontSize: 12, lineHeight: 1.5, color: 'var(--adm-muted)' }}>
          {t('admin_addr_hint')}. {t('admin_qr_hint')}
        </p>
        {CRYPTO_OPTIONS.map((opt) => (
          <AddressRow key={opt.id} network={opt} />
        ))}
        </AdminSection>

        <AdminSection label={lang === 'ru' ? 'Ссылки и контакты' : 'Links & contacts'}>
        <p style={{ fontSize: 12, color: 'var(--adm-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
          {lang === 'ru'
            ? 'Для закрытого канала — инвайт t.me/+...'
            : 'Private channel — use t.me/+... invite'}
        </p>
        {LINK_FIELDS.map((f) => <LinkRow key={f.key} field={f} />)}
        </AdminSection>
      </div>
    </PageTransition>
  )
}

export function _useNoUnused(_x: CryptoNetwork) { /* satisfies type-only import */ }
