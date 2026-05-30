import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import PhotoUploader from '../components/PhotoUploader'
import CryptoLogo from '../components/CryptoLogo'
import { useStore, CRYPTO_OPTIONS } from '../store'

type Tab = 'welcome' | 'crypto' | 'products'

const WelcomeTabIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const CryptoTabIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"/></svg>
const ProductsTabIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>

export default function AdminPhotos() {
  const lang = useStore((s) => s.lang)
  const products = useStore((s) => s.products)
  const photos = useStore((s) => s.photos)
  const [tab, setTab] = useState<Tab>('welcome')

  const tabs: Array<{ key: Tab; label: string; Icon: () => JSX.Element }> = lang === 'ru'
    ? [
        { key: 'welcome',  label: 'Приветствие', Icon: WelcomeTabIcon  },
        { key: 'crypto',   label: 'Крипта',       Icon: CryptoTabIcon  },
        { key: 'products', label: 'Товары',        Icon: ProductsTabIcon },
      ]
    : [
        { key: 'welcome',  label: 'Welcome',  Icon: WelcomeTabIcon  },
        { key: 'crypto',   label: 'Crypto',   Icon: CryptoTabIcon  },
        { key: 'products', label: 'Products', Icon: ProductsTabIcon },
      ]

  return (
    <PageTransition>
      <div className="page">
        <div className="chip-row mb-5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              className={`chip${tab === tb.key ? ' active' : ''}`}
              onClick={() => setTab(tb.key)}
            >
              <tb.Icon /> {tb.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="col gap-5"
            >
              <PhotoUploader
                photoKey="welcome_ru"
                label={lang === 'ru' ? 'Приветственное фото (RU)' : 'Welcome photo (RU)'}
                hint={lang === 'ru' ? 'Показывается русскоязычным пользователям при /start' : 'Shown to Russian users on /start'}
              />
              <PhotoUploader
                photoKey="welcome_en"
                label={lang === 'ru' ? 'Приветственное фото (EN)' : 'Welcome photo (EN)'}
                hint={lang === 'ru' ? 'Показывается англоязычным пользователям' : 'Shown to English users on /start'}
              />
            </motion.div>
          )}

          {tab === 'crypto' && (
            <motion.div
              key="crypto"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="col gap-4"
            >
              <div className="t-xs t-muted mb-2" style={{ lineHeight: 1.55 }}>
                {lang === 'ru'
                  ? 'Если не загружать — используется стандартный логотип в HD из публичного CDN'
                  : 'If not uploaded — high-quality default logo from public CDN is used'}
              </div>
              {CRYPTO_OPTIONS.map((opt) => {
                const photoKey = `crypto_${opt.id}`
                return (
                  <div key={opt.id} className="card" style={{ padding: '14px' }}>
                    <div className="row gap-3 mb-3">
                      <CryptoLogo network={opt.id} size={48} />
                      <div style={{ flex: 1 }}>
                        <div className="t-sm fw-bold">{opt.name}</div>
                        <div className="t-xs t-muted">{opt.symbol}</div>
                      </div>
                      {photos[photoKey] && (
                        <span className="badge badge-completed" style={{ fontSize: 10 }}>
                          ✓ {lang === 'ru' ? 'Свой' : 'Custom'}
                        </span>
                      )}
                    </div>
                    <PhotoUploader
                      photoKey={photoKey}
                      label=""
                      aspect="square"
                      maxBytes={500 * 1024}
                    />
                  </div>
                )
              })}
            </motion.div>
          )}

          {tab === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="col gap-4"
            >
              {products.map((p) => (
                <div key={p.id} className="card" style={{ padding: '14px' }}>
                  <div className="row gap-3 mb-3">
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: 'var(--surface-hover)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--brand)', flexShrink: 0,
                    }}>
                      {p.delivery === 'auto'
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="t-sm fw-bold">
                        {lang === 'ru' ? p.title : p.title_en}
                      </div>
                      <div className="t-xs t-muted">${p.price.toFixed(2)}</div>
                    </div>
                  </div>
                  <PhotoUploader photoKey={`product_${p.id}`} label="" aspect="wide" />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  )
}
