import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { AdminConfirmSheet } from './ui'
import AdminBroadcastKeyboard, {
  defaultKeyboardRows,
  keyboardFromRows,
  type BroadcastBtn,
} from './AdminBroadcastKeyboard'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import { api } from '../store/api'
import { keyboardSummary } from '../../../shared/broadcastKeyboard'
import type { BroadcastKeyboardInput } from '../../../shared/broadcastKeyboard'

export default function AdminBroadcast() {
  const t = useT()
  const lang = useStore((s) => s.lang) as 'ru' | 'en'
  const broadcasts = useStore((s) => s.broadcasts)
  const addBroadcast = useStore((s) => s.addBroadcast)
  const toast = useToast()
  const { haptic } = useTelegram()
  const [text, setText] = useState('')
  const [buttonsEnabled, setButtonsEnabled] = useState(true)
  const [rows, setRows] = useState<BroadcastBtn[][]>(() => defaultKeyboardRows())
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!api.isEnabled()) return
    api.adminBroadcasts().then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        useStore.setState({
          broadcasts: res as typeof broadcasts,
        })
      }
    })
  }, [])

  const keyboardPayload = (): BroadcastKeyboardInput =>
    keyboardFromRows(rows, buttonsEnabled)

  const handleSend = () => {
    if (!text.trim()) return
    if (buttonsEnabled && rows.every((r) => r.every((b) => !b.text.trim()))) {
      toast.show(
        lang === 'ru' ? 'Добавьте текст хотя бы одной кнопки' : 'Add at least one button label',
        'error',
      )
      return
    }
    setShowConfirm(true)
  }

  const doSend = async () => {
    const trimmed = text.trim()
    const keyboard = keyboardPayload()
    setSending(true)
    setShowConfirm(false)
    try {
      if (api.isEnabled()) {
        const res = await api.adminBroadcast({ text: trimmed, keyboard })
        if (!res || !res.ok) {
          toast.show(lang === 'ru' ? 'Ошибка рассылки' : 'Broadcast failed', 'error')
          setSending(false)
          return
        }
        haptic('success')
        addBroadcast(trimmed, res.sent_to, keyboard)
        toast.show(`${t('admin_broadcast_sent')}: ${res.sent_to}${res.failed ? ` (${res.failed} ${lang === 'ru' ? 'ошибок' : 'failed'})` : ''}`, 'success')
      } else {
        haptic('success')
        addBroadcast(trimmed, 0, keyboard)
        toast.show(lang === 'ru' ? 'Нужен сервер (API) для рассылки' : 'Server API required for broadcast', 'error')
      }
      setText('')
    } finally {
      setSending(false)
    }
  }

  const confirmExtra =
    lang === 'ru'
      ? `Кнопки: ${keyboardSummary(keyboardPayload(), 'ru')}`
      : `Buttons: ${keyboardSummary(keyboardPayload(), 'en')}`

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

          <AdminBroadcastKeyboard
            lang={lang}
            messagePreview={text.trim()}
            enabled={buttonsEnabled}
            onEnabledChange={setButtonsEnabled}
            rows={rows}
            onRowsChange={setRows}
          />

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
                  <div className="row gap-2">
                    {b.keyboard && (
                      <span className="adm-badge">{keyboardSummary(b.keyboard, lang)}</span>
                    )}
                    <span className="adm-badge adm-badge--ok">→ {b.sent_to}</span>
                  </div>
                </div>
                <div className="t-sm" style={{ lineHeight: 1.5 }}>{b.text}</div>
                {b.keyboard?.enabled && b.keyboard.rows.length > 0 && (
                  <div className="adm-bcast-preview" style={{ marginTop: 10, padding: 8 }}>
                    {b.keyboard.rows.map((row, ri) => (
                      <div key={ri} className="adm-bcast-preview-row">
                        {row.map((btn, bi) => (
                          <span key={bi} className="adm-bcast-preview-btn">{btn.text}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AdminConfirmSheet
        open={showConfirm}
        title={lang === 'ru' ? 'Отправить рассылку?' : 'Send broadcast?'}
        message={`${text.slice(0, 120)}${text.length > 120 ? '…' : ''}\n\n${confirmExtra}`}
        confirmLabel={lang === 'ru' ? 'Отправить' : 'Send'}
        cancelLabel={lang === 'ru' ? 'Отмена' : 'Cancel'}
        onConfirm={doSend}
        onCancel={() => setShowConfirm(false)}
      />
    </PageTransition>
  )
}
