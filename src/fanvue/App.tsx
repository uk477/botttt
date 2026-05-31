import { useEffect, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
// AnimatePresence removed — caused blank screen in Telegram WebView
import ErrorBoundary from './components/ErrorBoundary'
import BackgroundOrbs from './components/BackgroundOrbs'
import Navigation from './components/Navigation'
import LoadingScreen from './components/LoadingScreen'
import Home from './pages/Home'
import Market from './pages/Market'
import ProductDetail from './pages/ProductDetail'
import Deposit from './pages/Deposit'
import Profile from './pages/Profile'
import Orders from './pages/Orders'
import Deposits from './pages/Deposits'
import Support from './pages/Support'
import SupportHub from './pages/SupportHub'
import Settings from './pages/Settings'
import RefCalendar from './pages/RefCalendar'

const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))
const AdminOrders = lazy(() => import('./admin/AdminOrders'))
const AdminProducts = lazy(() => import('./admin/AdminProducts'))
const AdminUsers = lazy(() => import('./admin/AdminUsers'))
const AdminSupport = lazy(() => import('./admin/AdminSupport'))
const AdminSettings = lazy(() => import('./admin/AdminSettings'))
const AdminLogs = lazy(() => import('./admin/AdminLogs'))
const AdminBroadcast = lazy(() => import('./admin/AdminBroadcast'))
const AdminPhotos = lazy(() => import('./admin/AdminPhotos'))
const AdminMore = lazy(() => import('./admin/AdminMore'))
const AdminReferrals = lazy(() => import('./admin/AdminReferrals'))
const AdminDeposits = lazy(() => import('./admin/AdminDeposits'))
const AdminCustomize = lazy(() => import('./admin/AdminCustomize'))
import { useStore } from './store'
import { useTelegram } from './hooks/useTelegram'
import { ToastProvider } from './components/Toast'

const HIDE_NAV = ['/deposit', '/settings', '/admin', '/support', '/referral-calendar']
const APP_ROUTES = ['/', '/market', '/product/', '/deposit', '/profile', '/orders', '/deposits', '/support', '/settings', '/referral-calendar', '/admin']

function MaintenanceScreen() {
  const lang = useStore((s) => s.lang)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 32, textAlign: 'center', gap: 16 }}>
      <div style={{ fontSize: 56 }}>🔧</div>
      <div className="t-lg fw-black">
        {lang === 'ru' ? 'Технические работы' : 'Maintenance'}
      </div>
      <div className="t-sm t-muted">{lang === 'ru' ? 'Магазин временно недоступен. Вернитесь через несколько минут.' : 'The shop is temporarily unavailable. Please check back in a few minutes.'}</div>
    </div>
  )
}

function AppInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const initUser = useStore((s) => s.initUser)
  const maintenance = useStore((s) => s.maintenance)
  const storeConfigLoaded = useStore((s) => s.storeConfigLoaded)
  const isAdminVerified = useStore((s) => s._adminVerified)
  const { init, showBackButton } = useTelegram()
  const isKnownRoute = APP_ROUTES.some((p) =>
    p === '/' ? location.pathname === '/' : location.pathname.startsWith(p),
  )

  useEffect(() => {
    init()
    initUser()
    const unsub = useStore.persist.onFinishHydration(() => {
      void useStore.getState().bootstrapSession()
    })
    if (useStore.persist.hasHydrated()) {
      void useStore.getState().bootstrapSession()
    }

    const block = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', block, { passive: false })
    return () => {
      document.removeEventListener('contextmenu', block)
      unsub()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const sync = useStore.getState().syncStoreConfig
    const id = window.setInterval(() => void sync(), 45_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const tick = () => {
      const hasOpen = useStore.getState().orders.some(
        (o) => o.status === 'pending' || o.status === 'paid',
      )
      if (hasOpen) void useStore.getState().refreshUser()
    }
    const id = window.setInterval(tick, 12_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void useStore.getState().pullServerSession()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Pages with overlays register their own back handler (/orders, /deposits)
  const PAGE_OWNED_BACK = ['/orders', '/deposits']

  useEffect(() => {
    if (location.pathname === '/') return
    if (PAGE_OWNED_BACK.includes(location.pathname)) return
    const cleanup = showBackButton(() => {
      const returnTo = (location.state as { returnTo?: string } | null)?.returnTo
      if (returnTo) {
        navigate(returnTo, { replace: true })
        return
      }
      navigate(-1)
    })
    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.state])

  useEffect(() => {
    if (!isKnownRoute) navigate('/', { replace: true })
  }, [isKnownRoute, navigate])

  const isAdminRoute = location.pathname.startsWith('/admin')
  const showNav = !HIDE_NAV.some((p) => location.pathname.startsWith(p)) &&
    !location.pathname.startsWith('/product/')

  if (!storeConfigLoaded && !isAdminRoute) {
    return <LoadingScreen />
  }

  if (maintenance && !isAdminRoute && !isAdminVerified) {
    return <MaintenanceScreen />
  }

  if (isAdminRoute) {
    return (
      <div className="app" role="application">
        <a href="#main-content" className="sr-only-focusable" style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden', zIndex: 999 }}>Skip to content</a>
        <BackgroundOrbs />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="broadcast" element={<AdminBroadcast />} />
              <Route path="photos" element={<AdminPhotos />} />
              <Route path="more" element={<AdminMore />} />
              <Route path="referrals" element={<AdminReferrals />} />
              <Route path="deposits" element={<AdminDeposits />} />
              <Route path="customize" element={<AdminCustomize />} />
            </Route>
          </Routes>
        </Suspense>
      </div>
    )
  }

  return (
    <div className="app" role="application">
      <a href="#main-content" className="sr-only-focusable" style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden', zIndex: 999 }}>Skip to content</a>
      <BackgroundOrbs />
      <div
        id="main-content"
        className={`scroll-area${location.pathname === '/' ? ' vault-scroll' : ''}${!showNav ? ' no-nav' : ''}`}
        role="main"
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/market" element={<Market />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/deposits" element={<Deposits />} />
          <Route path="/support" element={<SupportHub />} />
          <Route path="/support/chat" element={
            <div className="fv-support-chat-shell">
              <Support />
            </div>
          } />
          <Route path="/settings" element={<Settings />} />
          <Route path="/referral-calendar" element={<RefCalendar />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      {showNav && <Navigation />}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ToastProvider>
          <AppInner />
        </ToastProvider>
      </HashRouter>
    </ErrorBoundary>
  )
}
