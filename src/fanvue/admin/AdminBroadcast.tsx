import { useState } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import ConfirmSheet from '../components/ConfirmSheet'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'

export default function AdminBroadcast() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const broadcasts = useStore((s) => s.broadcasts)
  const addBroadcast = useStore((s) => s.addBroadcast)
  const toast = useToast()
  const { haptic } = useTelegram()
  const [text, setText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSend = () => {
    if (!text.trim()) return
    setShowConfirm(true)
  }

  const doSend = () => {
    const trimmed = text.trim()
    haptic('success')
    const sentTo = 247
    addBroadcast(trimmed, sentTo)
    toast.show(`${t('admin_broadcast_sent')}: ${sentTo}`, 'success')
    setText('')
    setShowConfirm(false)
  }

  return (
    <PageTransition>
      <div className="page">
        <div className="card mb-5" style={{ padding: '16px' }}>
          <div className="section-title mb-3">{t('admin_broadcast_text')}</div>
          <textarea
            className="input"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={lang === 'ru'
              ? 'Введите сообщение для рассылки всем пользователям...'
              : 'Enter message to broadcast to all users...'}
            style={{ resize: 'vertical', minHeight: 120 }}
          />
          <div className="t-xs t-muted mt-2">{text.length} / 4096</div>
          <motion.button
            className="btn btn-primary mt-4"
            onClick={handleSend}
            disabled={!text.trim()}
            whileTap={{ scale: 0.97 }}
          >
            📤 {t('admin_broadcast_send')}
          </motion.button>
        </div>

        <div className="section-title mb-3">{t('admin_broadcast_history')}</div>
        {broadcasts.length === 0 ? (
          <div className="text-center t-muted" style={{ padding: 40 }}>
            {lang === 'ru' ? 'История пуста' : 'History is empty'}
          </div>
        ) : (
          <div className="col gap-3">
            {broadcasts.map((b, i) => (
              <motion.div
                key={b.id}
                className="card"
                style={{ padding: '14px' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="row-between mb-2">
                  <div className="t-xs t-muted">{new Date(b.ts).toLocaleString()}</div>
                  <span className="badge badge-completed">→ {b.sent_to}</span>
                </div>
                <div className="t-sm" style={{ lineHeight: 1.5 }}>{b.text}</div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <ConfirmSheet
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
