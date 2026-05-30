import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { AdminConfirmSheet } from './ui'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import { api } from '../store/api'

export default function AdminBroadcast() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const broadcasts = useStore((s) => s.broadcasts)
  const addBroadcast = useStore((s) => s.addBroadcast)
  const toast = useToast()
  const { haptic } = useTelegram()
  const [text, setText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!api.isEnabled()) return
    api.adminBroadcasts().then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        useStore.setState({
          broadcasts: res as { id: number; text: string; sent_to: number; ts: string }[],
        })
      }
    })
  }, [])

  const handleSend = () => {
    if (!text.trim()) return
    setShowConfirm(true)
  }

  const doSend = async () => {
    const trimmed = text.trim()
    setSending(true)
    setShowConfirm(false)
    try {
      if (api.isEnabled()) {
        const res = await api.adminBroadcast(trimmed)
        if (!res || !res.ok) {
          toast.show(lang === 'ru' ? 'Ошибка рассылки' : 'Broadcast failed', 'error')
          setSending(false)
          return
        }
        haptic('success')
        addBroadcast(trimmed, res.sent_to)
        toast.show(`${t('admin_broadcast_sent')}: ${res.sent_to}${res.failed ? ` (${res.failed} ${lang === 'ru' ? 'ошибок' : 'failed'})` : ''}`, 'success')
      } else {
        haptic('success')
        addBroadcast(trimmed, 0)
        toast.show(lang === 'ru' ? 'Нужен сервер (API) для рассылки' : 'Server API required for broadcast', 'error')
      }
      setText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <PageTransition>
      <div className="adm-page">
        <div className="adm-card" style={{ marginBottom: 16 }}>
          <div className="adm-section-label" style={{ marginBottom: 12 }}>{t('admin_broadcast_text')}</div>
          <textarea
            className="adm-input"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={lang === 'ru'
              ? 'Введите сообщение для рассылки всем пользователям...'
              : 'Enter message to broadcast to all users...'}
            style={{ resize: 'vertical', minHeight: 120 }}
          />
          <div className="t-xs t-muted mt-2">{text.length} / 4096</div>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            style={{ marginTop: 12, width: '100%' }}
            onClick={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (lang === 'ru' ? 'Отправка…' : 'Sending…') : t('admin_broadcast_send')}
          </button>
        </div>

        <div className="adm-section-label">{t('admin_broadcast_history')}</div>
        {broadcasts.length === 0 ? (
          <div className="adm-empty" style={{ marginTop: 12 }}>
            {lang === 'ru' ? 'История пуста' : 'History is empty'}
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {broadcasts.map((b, i) => (
              <motion.div
                key={b.id}
                className="adm-card"
                style={{ marginBottom: 8 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="row-between mb-2">
                  <div className="t-xs t-muted">{new Date(b.ts).toLocaleString()}</div>
                  <span className="adm-badge adm-badge--ok">→ {b.sent_to}</span>
                </div>
                <div className="t-sm" style={{ lineHeight: 1.5 }}>{b.text}</div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AdminConfirmSheet
        open={showConfirm}
        title={lang === 'ru' ? 'Отправить рассылку?' : 'Send broadcast?'}
        message={text.slice(0, 120) + (text.length > 120 ? '…' : '')}
        confirmLabel={lang === 'ru' ? 'Отправить' : 'Send'}
        cancelLabel={lang === 'ru' ? 'Отмена' : 'Cancel'}
        onConfirm={doSend}
        onCancel={() => setShowConfirm(false)}
      />
    </PageTransition>
  )
}
