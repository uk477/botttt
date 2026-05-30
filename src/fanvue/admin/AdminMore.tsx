import PageTransition from '../components/PageTransition'
import { useT } from '../i18n'
import { useStore } from '../store'
import { AdminMenuGroup, AdminMenuItem } from './ui'

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconMoney = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)
const IconDeposit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M12 2v14"/><path d="m5 9 7-7 7 7"/><path d="M4 20h16"/>
  </svg>
)
const IconBroadcast = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="m22 8-6 4 6 4V8z"/><rect x="2" y="9" width="14" height="6" rx="1"/>
  </svg>
)
const IconLogs = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
  </svg>
)
const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
)
const IconCustomize = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
  </svg>
)
const IconPhotos = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
  </svg>
)

export default function AdminMore() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const refW = useStore((s) => s.refWithdrawals)
  const pendingRef = refW.filter((w) => w.status === 'pending').length

  return (
    <PageTransition>
      <div className="adm-page">
        <AdminMenuGroup title={lang === 'ru' ? 'Люди и деньги' : 'People & money'}>
          <AdminMenuItem
            icon={<IconUsers />}
            title={t('admin_users')}
            description={lang === 'ru' ? 'Балансы, история, зачисления' : 'Balances, history, credits'}
            path="/admin/users"
            color="#8b9cf4"
          />
          <AdminMenuItem
            icon={<IconDeposit />}
            title={lang === 'ru' ? 'Пополнения' : 'Deposits'}
            description={lang === 'ru' ? 'Депозиты и экспорт' : 'Deposits and export'}
            path="/admin/deposits"
            color="#5eead4"
          />
          <AdminMenuItem
            icon={<IconMoney />}
            title={lang === 'ru' ? 'Реф. выводы' : 'Ref withdrawals'}
            description={lang === 'ru' ? 'Подтверждение выплат партнёрам' : 'Approve partner payouts'}
            path="/admin/referrals"
            badge={pendingRef}
            color="#f5a623"
          />
        </AdminMenuGroup>

        <AdminMenuGroup title={lang === 'ru' ? 'Коммуникации' : 'Communications'}>
          <AdminMenuItem
            icon={<IconBroadcast />}
            title={t('admin_broadcast')}
            description={lang === 'ru' ? 'Сообщение всем в Telegram' : 'Message all users in Telegram'}
            path="/admin/broadcast"
            color="#f472b6"
          />
        </AdminMenuGroup>

        <AdminMenuGroup title={lang === 'ru' ? 'Настройки магазина' : 'Shop setup'}>
          <AdminMenuItem
            icon={<IconSettings />}
            title={t('admin_settings')}
            description={lang === 'ru' ? 'Кошельки, QR, режим работы' : 'Wallets, QR, maintenance'}
            path="/admin/settings"
            color="#3ddc84"
          />
          <AdminMenuItem
            icon={<IconCustomize />}
            title={lang === 'ru' ? 'Контент и ссылки' : 'Content & links'}
            description={lang === 'ru' ? 'Каналы, чаты, оферта (в т.ч. закрытые)' : 'Channels, chats, terms (incl. private)'}
            path="/admin/customize"
            color="#a78bfa"
          />
          <AdminMenuItem
            icon={<IconPhotos />}
            title={t('admin_photos')}
            description={lang === 'ru' ? 'Приветствие и логотипы сетей' : 'Welcome & crypto logos'}
            path="/admin/photos"
            color="#94a3b8"
          />
        </AdminMenuGroup>

        <AdminMenuGroup title={lang === 'ru' ? 'Аналитика' : 'Analytics'}>
          <AdminMenuItem
            icon={<IconLogs />}
            title={t('admin_logs')}
            description={lang === 'ru' ? 'История оплат, CSV/JSON' : 'Payment history, CSV/JSON'}
            path="/admin/logs"
            color="#6ee7b7"
          />
        </AdminMenuGroup>
      </div>
    </PageTransition>
  )
}
