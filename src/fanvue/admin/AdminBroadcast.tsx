import { useState, useEffect, useCallback } from 'react'
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

function mapBroadcastHistory(
  rows: { id: number; text: string; sent_to: number; ts: string; keyboard?: BroadcastKeyboardInput; status?: string }[],
) {
  return rows.map((b) => ({
    id: b.id,
    text: b.text,
    sent_to: b.sent_to,
    ts: b.ts,
    keyboard: b.keyboard,
    status: b.status,
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
  const [buttonsEnabled, setButtonsEnabled] = useState(true)
  const [rows, setRows] = useState<BroadcastBtn[][]>(() => defaultKeyboardRows())
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)

  const loadHistory = useCallback(async () => {
    if (!api.isEnabled()) return
    const res = await api.adminBroadcasts()
    if (Array.isArray(res) && res.length > 0) {
      useStore.setState({ broadcasts: mapBroadcastHistory(res) })
    }
  }, [])

  useEffect(() => {
    void loadHistory()
    const id = window.setInterval(() => void loadHistory(), 4000)
    return () => window.clearInterval(id)
  }, [loadHistory])

  const keyboardPayload = (): BroadcastKeyboardInput =>
    keyboardFromRows(rows, buttonsEnabled)

  const handleSend = () => {
    if (!text.trim()) return
    const kb = keyboardPayload()
    if (kb.enabled && kb.rows.length === 0) {
      toast.show(
        lang === 'ru' ? 'Введите текст кнопки или отключите кнопки' : 'Enter button text or disable buttons',
        'error',
      )
      return
    }
    if (kb.enabled) {
      for (const row of kb.rows) {
        for (const b of row) {
          if (b.type === 'url' && !b.url?.trim()) {
            toast.show(
              lang === 'ru' ? 'Укажите ссылку для кнопки «Ссылка»' : 'Set URL for link buttons',
              'error',
            )
            return
          }
        }
      }
    }
    setShowConfirm(true)
  }

  const doSend = async () => {
    const trimmed = text.trim()
    const keyboard = keyboardPayload()
    setSending(true)
    setShowConfirm(false)
    try {
      if (!api.isEnabled()) {
        toast.show(lang === 'ru' ? 'Нет API (VITE_API_URL)' : 'No API (VITE_API_URL)', 'error')
        return
      }

      const res = await api.adminBroadcast({ text: trimmed, keyboard })
      if (!res?.ok) {
        haptic('error')
        toast.show(
          res?.error
            ? (lang === 'ru' ? `Ошибка: ${res.error}` : `Error: ${res.error}`)
            : (lang === 'ru' ? 'Рассылка не удалась' : 'Broadcast failed'),
          'error',
        )
        return
      }

      haptic('success')
      if (res.status === 'running' && res.total) {
        toast.show(
          lang === 'ru'
            ? `Рассылка запущена: ${res.total} получателей`
            : `Broadcast started: ${res.total} recipients`,
          'success',
        )
      } else {
        toast.show(
          `${t('admin_broadcast_sent')}: ${res.sent_to}${res.failed ? ` (${res.failed} ${lang === 'ru' ? 'ошибок' : 'failed'})` : ''}`,
          'success',
        )
      }

      addBroadcast(trimmed, res.sent_to ?? 0, keyboard)
      setText('')
      void loadHistory()
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
          <div className="adm-section-label" style={{ marginBottom: 8 }}>{t('admin_broadcast_text')}</div>
          <p className="t-xs t-muted" style={{ marginBottom: 12, lineHeight: 1.45 }}>
            {lang === 'ru'
              ? 'Сообщение уйдёт всем, кто хоть раз открывал магазин.'
              : 'Sent to everyone who opened the shop at least once.'}
          </p>
          <textarea
            className="adm-input"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={lang === 'ru' ? 'Текст рассылки…' : 'Broadcast text…'}
            style={{ resize: 'vertical', minHeight: 110 }}
          />
          <div className="t-xs t-muted mt-2">{text.length} / 4096</div>

          <AdminBroadcastKeyboard
            lang={lang}
            enabled={buttonsEnabled}
            onEnabledChange={setButtonsEnabled}
            rows={rows}
            onRowsChange={setRows}
          />

          <button
            type="button"
            className="adm-btn adm-btn--primary"
            style={{ marginTop: 16, width: '100%' }}
            onClick={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (lang === 'ru' ? 'Запуск…' : 'Starting…') : t('admin_broadcast_send')}
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
                    {(b as { status?: string }).status === 'running' && (
                      <span className="adm-badge adm-badge--warn">
                        {lang === 'ru' ? 'отправка…' : 'sending…'}
                      </span>
                    )}
                    {b.keyboard && (
                      <span className="adm-badge">{keyboardSummary(b.keyboard, lang)}</span>
                    )}
                    <span className="adm-badge adm-badge--ok">→ {b.sent_to}</span>
                  </div>
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
        message={`${text.slice(0, 120)}${text.length > 120 ? '…' : ''}\n\n${confirmExtra}`}
        confirmLabel={lang === 'ru' ? 'Отправить' : 'Send'}
        cancelLabel={lang === 'ru' ? 'Отмена' : 'Cancel'}
        onConfirm={doSend}
        onCancel={() => setShowConfirm(false)}
      />
    </PageTransition>
  )
}
