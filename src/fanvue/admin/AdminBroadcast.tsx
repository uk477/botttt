import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { AdminConfirmSheet } from './ui'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useToast } from '../components/Toast'
import { useTelegram } from '../hooks/useTelegram'
import { api } from '../store/api'
import { simpleButtonSummary } from '../../../shared/broadcastKeyboard'

const DEFAULT_BTN_RU = 'Открыть приложение'
const DEFAULT_BTN_EN = 'Open app'

type HistoryRow = {
  id: number
  text: string
  sent_to: number
  ts: string
  status?: string
  buttonText?: string
}

function parseHistory(rows: HistoryRow[]): HistoryRow[] {
  return rows.map((b) => ({
    ...b,
    buttonText: b.buttonText || undefined,
  }))
}

export default function AdminBroadcast() {
  const t = useT()
  const lang = useStore((s) => s.lang) as 'ru' | 'en'
  const broadcasts = useStore((s) => s.broadcasts)
  const addBroadcast = useStore((s) => s.addBroadcast)
  const toast = useToast()
  const { haptic } = useTelegram()
  const [text, setText] = useState('')
  const [withButton, setWithButton] = useState(true)
  const [buttonText, setButtonText] = useState(lang === 'ru' ? DEFAULT_BTN_RU : DEFAULT_BTN_EN)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)

  const loadHistory = useCallback(async () => {
    if (!api.isEnabled()) return
    const res = await api.adminBroadcasts()
    if (Array.isArray(res)) {
      useStore.setState({
        broadcasts: parseHistory(res as HistoryRow[]) as typeof broadcasts,
      })
    }
  }, [])

  useEffect(() => {
    void loadHistory()
    const id = window.setInterval(() => void loadHistory(), 5000)
    return () => window.clearInterval(id)
  }, [loadHistory])

  const payloadButtonText = () => (withButton ? buttonText.trim() : '')

  const handleSend = () => {
    if (!text.trim()) return
    if (withButton && !buttonText.trim()) {
      toast.show(lang === 'ru' ? 'Введите текст кнопки' : 'Enter button text', 'error')
      return
    }
    setShowConfirm(true)
  }

  const doSend = async () => {
    const trimmed = text.trim()
    const btn = payloadButtonText()
    setSending(true)
    setShowConfirm(false)
    try {
      if (!api.isEnabled()) {
        toast.show(lang === 'ru' ? 'Нет API — проверь VITE_API_URL при сборке' : 'No API — check VITE_API_URL at build', 'error')
        return
      }

      const res = await api.adminBroadcast({ text: trimmed, buttonText: btn })
      if (!res?.ok) {
        haptic('error')
        toast.show(
          res?.error
            ? (lang === 'ru' ? res.error : res.error)
            : (lang === 'ru' ? 'Рассылка не удалась' : 'Broadcast failed'),
          'error',
        )
        return
      }

      haptic('success')
      const total = res.total ?? 0
      if (res.status === 'running') {
        toast.show(
          lang === 'ru'
            ? `Отправка… ${total} чел. (смотри историю)`
            : `Sending… ${total} users (see history)`,
          'success',
        )
      } else {
        toast.show(`${t('admin_broadcast_sent')}: ${res.sent_to ?? 0}`, 'success')
      }

      addBroadcast(trimmed, res.sent_to ?? 0, {
        enabled: !!btn,
        rows: btn ? [[{ text: btn, type: 'web_app' as const, url: '' }]] : [],
      })
      setText('')
      void loadHistory()
    } finally {
      setSending(false)
    }
  }

  const confirmMsg =
    lang === 'ru'
      ? `${text.slice(0, 100)}${text.length > 100 ? '…' : ''}\n\n${simpleButtonSummary(payloadButtonText(), 'ru')}`
      : `${text.slice(0, 100)}${text.length > 100 ? '…' : ''}\n\n${simpleButtonSummary(payloadButtonText(), 'en')}`

  return (
    <PageTransition>
      <div className="adm-page">
        <div className="adm-card" style={{ marginBottom: 16 }}>
          <div className="adm-section-label">{t('admin_broadcast_text')}</div>
          <textarea
            className="adm-input"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={lang === 'ru' ? 'Текст для всех пользователей…' : 'Message for all users…'}
            style={{ resize: 'vertical', minHeight: 120, marginTop: 10 }}
          />
          <div className="t-xs t-muted mt-2">{text.length} / 4096</div>

          <div className="adm-bcast-one" style={{ marginTop: 18 }}>
            <label className="adm-bcast-one-toggle">
              <input
                type="checkbox"
                checked={withButton}
                onChange={(e) => setWithButton(e.target.checked)}
              />
              <span>{lang === 'ru' ? 'Кнопка под сообщением' : 'Button under message'}</span>
            </label>

            {withButton && (
              <label className="adm-bcast-one-field">
                <span>{lang === 'ru' ? 'Текст на кнопке' : 'Button label'}</span>
                <input
                  className="adm-input adm-bcast-one-input"
                  value={buttonText}
                  maxLength={64}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder={lang === 'ru' ? DEFAULT_BTN_RU : DEFAULT_BTN_EN}
                />
                <span className="t-xs t-muted">
                  {lang === 'ru'
                    ? 'Откроет мини-приложение (URL с сервера WEBAPP_URL).'
                    : 'Opens the mini-app (WEBAPP_URL from server).'}
                </span>
              </label>
            )}
          </div>

          <button
            type="button"
            className="adm-btn adm-btn--primary"
            style={{ marginTop: 20, width: '100%' }}
            onClick={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (lang === 'ru' ? 'Отправка…' : 'Sending…') : t('admin_broadcast_send')}
          </button>
        </div>

        <div className="adm-section-label">{t('admin_broadcast_history')}</div>
        {broadcasts.length === 0 ? (
          <div className="adm-empty" style={{ marginTop: 12 }}>
            {lang === 'ru' ? 'История пуста' : 'No history yet'}
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {broadcasts.map((b, i) => {
              const row = b as HistoryRow
              const btn =
                row.buttonText ??
                (b.keyboard?.enabled ? b.keyboard.rows[0]?.[0]?.text : '')
              return (
                <motion.div
                  key={b.id}
                  className="adm-card"
                  style={{ marginBottom: 8 }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="row-between mb-2">
                    <span className="t-xs t-muted">{new Date(b.ts).toLocaleString()}</span>
                    <div className="row gap-2">
                      {row.status === 'running' && (
                        <span className="adm-badge adm-badge--warn">
                          {lang === 'ru' ? 'идёт…' : 'running…'}
                        </span>
                      )}
                      <span className="adm-badge">{simpleButtonSummary(btn, lang)}</span>
                      <span className="adm-badge adm-badge--ok">{row.sent_to ?? b.sent_to}</span>
                    </div>
                  </div>
                  <div className="t-sm" style={{ lineHeight: 1.5 }}>{b.text}</div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <AdminConfirmSheet
        open={showConfirm}
        title={lang === 'ru' ? 'Отправить всем?' : 'Send to everyone?'}
        message={confirmMsg}
        confirmLabel={lang === 'ru' ? 'Отправить' : 'Send'}
        cancelLabel={lang === 'ru' ? 'Отмена' : 'Cancel'}
        onConfirm={doSend}
        onCancel={() => setShowConfirm(false)}
      />
    </PageTransition>
  )
}
