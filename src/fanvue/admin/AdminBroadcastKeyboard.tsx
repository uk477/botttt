import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BroadcastButtonType, BroadcastKeyboardInput } from '../../../shared/broadcastKeyboard'
import { defaultBroadcastKeyboard } from '../../../shared/broadcastKeyboard'

export type BroadcastBtn = {
  id: string
  text: string
  type: BroadcastButtonType
  url: string
}

let _bid = 0
function newId() {
  return `b${Date.now()}_${++_bid}`
}

export function rowsFromKeyboard(kb: BroadcastKeyboardInput): BroadcastBtn[][] {
  if (!kb.enabled || !kb.rows?.length) return []
  return kb.rows.map((row) =>
    row.map((b) => ({
      id: newId(),
      text: b.text,
      type: b.type,
      url: b.url ?? '',
    })),
  )
}

export function keyboardFromRows(rows: BroadcastBtn[][], enabled: boolean): BroadcastKeyboardInput {
  if (!enabled) return { enabled: false, rows: [] }
  return {
    enabled: true,
    rows: rows.map((row) =>
      row.map(({ text, type, url }) => ({ text, type, url })),
    ),
  }
}

export function defaultKeyboardRows(): BroadcastBtn[][] {
  return rowsFromKeyboard(defaultBroadcastKeyboard())
}

type Props = {
  lang: 'ru' | 'en'
  messagePreview: string
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  rows: BroadcastBtn[][]
  onRowsChange: (rows: BroadcastBtn[][]) => void
}

export default function AdminBroadcastKeyboard({
  lang,
  messagePreview,
  enabled,
  onEnabledChange,
  rows,
  onRowsChange,
}: Props) {
  const ru = lang === 'ru'
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = (() => {
    if (!selectedId) return null
    for (let ri = 0; ri < rows.length; ri++) {
      const bi = rows[ri].findIndex((b) => b.id === selectedId)
      if (bi >= 0) return { ri, bi, btn: rows[ri][bi] }
    }
    return null
  })()

  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null)
  }, [rows, selectedId, selected])

  const patchRow = (ri: number, row: BroadcastBtn[]) => {
    const next = [...rows]
    next[ri] = row
    onRowsChange(next)
  }

  const selectBtn = (id: string) => setSelectedId(id)

  const addRow = (withButton = true) => {
    const btn: BroadcastBtn = { id: newId(), text: '', type: 'url', url: '' }
    onRowsChange(withButton ? [...rows, [btn]] : [...rows, []])
    if (withButton) selectBtn(btn.id)
  }

  const removeRow = (ri: number) => {
    onRowsChange(rows.filter((_, i) => i !== ri))
    setSelectedId(null)
  }

  const moveRow = (ri: number, dir: -1 | 1) => {
    const j = ri + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[ri], next[j]] = [next[j], next[ri]]
    onRowsChange(next)
  }

  const addButton = (ri: number) => {
    const btn: BroadcastBtn = { id: newId(), text: '', type: 'url', url: '' }
    patchRow(ri, [...(rows[ri] ?? []), btn])
    selectBtn(btn.id)
  }

  const updateButton = (ri: number, bi: number, patch: Partial<BroadcastBtn>) => {
    const row = rows[ri].map((b, i) => (i === bi ? { ...b, ...patch } : b))
    patchRow(ri, row)
  }

  const removeButton = (ri: number, bi: number) => {
    const id = rows[ri][bi]?.id
    const row = rows[ri].filter((_, i) => i !== bi)
    if (row.length === 0) removeRow(ri)
    else patchRow(ri, row)
    if (id === selectedId) setSelectedId(null)
  }

  const moveButton = (ri: number, bi: number, dir: -1 | 1) => {
    const j = bi + dir
    const row = [...rows[ri]]
    if (j < 0 || j >= row.length) return
    ;[row[bi], row[j]] = [row[j], row[bi]]
    patchRow(ri, row)
  }

  const startWithButton = () => {
    const btn: BroadcastBtn = {
      id: newId(),
      text: ru ? 'Открыть приложение' : 'Open app',
      type: 'web_app',
      url: '',
    }
    onRowsChange([[btn]])
    selectBtn(btn.id)
  }

  return (
    <div className="adm-bcast-studio">
      <div className="adm-bcast-studio-head">
        <div>
          <div className="adm-bcast-studio-title">
            {ru ? 'Кнопки в Telegram' : 'Telegram buttons'}
          </div>
          <div className="adm-bcast-studio-sub">
            {ru
              ? 'Пишите прямо на кнопках — как увидят пользователи'
              : 'Type on the buttons — users see the same layout'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          className={`adm-bcast-switch${enabled ? ' is-on' : ''}`}
          onClick={() => {
            const on = !enabled
            onEnabledChange(on)
            if (on && rows.length === 0) onRowsChange(defaultKeyboardRows())
            if (!on) setSelectedId(null)
          }}
        >
          <span className="adm-bcast-switch-knob" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            className="adm-bcast-studio-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            <ol className="adm-bcast-steps">
              <li>{ru ? 'Текст сообщения — в поле выше' : 'Message text — field above'}</li>
              <li>{ru ? 'Нажмите кнопку и введите название' : 'Tap a button and type its label'}</li>
              <li>{ru ? 'Ниже выберите: приложение или ссылка' : 'Below pick: app or link'}</li>
            </ol>

            <div className="adm-bcast-tg">
              <div className="adm-bcast-tg-bubble">
                <span className="adm-bcast-tg-bubble-text">
                  {messagePreview || (ru ? 'Ваш текст рассылки…' : 'Your broadcast text…')}
                </span>
                <span className="adm-bcast-tg-time">20:33</span>
              </div>

              {rows.length === 0 ? (
                <button type="button" className="adm-bcast-tg-first" onClick={startWithButton}>
                  <span className="adm-bcast-tg-first-icon">+</span>
                  <span>{ru ? 'Добавить первую кнопку' : 'Add first button'}</span>
                </button>
              ) : (
                <div className="adm-bcast-tg-keys">
                  {rows.map((row, ri) => (
                    <div key={ri} className="adm-bcast-tg-row-wrap">
                      <div className="adm-bcast-tg-row">
                        {row.map((b, bi) => (
                          <label
                            key={b.id}
                            className={`adm-bcast-tg-key${selectedId === b.id ? ' is-active' : ''}${!b.text.trim() ? ' is-empty' : ''}`}
                          >
                            <input
                              className="adm-bcast-tg-key-input"
                              value={b.text}
                              maxLength={64}
                              placeholder={ru ? 'Название кнопки' : 'Button label'}
                              onFocus={() => selectBtn(b.id)}
                              onChange={(e) => updateButton(ri, bi, { text: e.target.value })}
                            />
                            {b.type === 'web_app' && (
                              <span className="adm-bcast-tg-key-badge" title={ru ? 'Приложение' : 'Web App'}>
                                📱
                              </span>
                            )}
                          </label>
                        ))}
                        <button
                          type="button"
                          className="adm-bcast-tg-key adm-bcast-tg-key--add"
                          onClick={() => addButton(ri)}
                          title={ru ? 'Ещё кнопка в эту строку' : 'Another button in this row'}
                        >
                          +
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {selected && selected.ri === ri && (
                          <motion.div
                            key={selected.btn.id}
                            className="adm-bcast-panel"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                          >
                            <div className="adm-bcast-panel-head">
                              <span className="adm-bcast-panel-title">
                                {ru ? 'Куда ведёт кнопка' : 'Where the button goes'}
                              </span>
                              <button
                                type="button"
                                className="adm-bcast-panel-close"
                                onClick={() => setSelectedId(null)}
                                aria-label={ru ? 'Закрыть' : 'Close'}
                              >
                                ×
                              </button>
                            </div>

                            <div className="adm-bcast-type-pills">
                              <button
                                type="button"
                                className={`adm-bcast-type-pill${selected.btn.type === 'web_app' ? ' is-on' : ''}`}
                                onClick={() => updateButton(ri, selected.bi, { type: 'web_app' })}
                              >
                                <span>📱</span>
                                {ru ? 'Открыть приложение' : 'Open mini-app'}
                              </button>
                              <button
                                type="button"
                                className={`adm-bcast-type-pill${selected.btn.type === 'url' ? ' is-on' : ''}`}
                                onClick={() => updateButton(ri, selected.bi, { type: 'url' })}
                              >
                                <span>🔗</span>
                                {ru ? 'Ссылка' : 'Link'}
                              </button>
                            </div>

                            <input
                              className="adm-input adm-bcast-panel-url"
                              value={selected.btn.url}
                              onChange={(e) => updateButton(ri, selected.bi, { url: e.target.value })}
                              placeholder={
                                selected.btn.type === 'web_app'
                                  ? (ru ? 'URL приложения — можно оставить пустым' : 'App URL — can stay empty')
                                  : (ru ? 'https://t.me/... или любая ссылка' : 'https://t.me/... or any URL')
                              }
                            />
                            <p className="adm-bcast-panel-hint">
                              {selected.btn.type === 'web_app'
                                ? (ru
                                  ? 'Пустое поле = адрес мини-приложения с сервера.'
                                  : 'Empty = mini-app URL from server.')
                                : (ru
                                  ? 'Вставьте ссылку на канал, чат t.me/+… или сайт.'
                                  : 'Paste channel, t.me/+… invite, or any URL.')}
                            </p>

                            <div className="adm-bcast-panel-actions">
                              <button
                                type="button"
                                className="adm-bcast-icon-btn"
                                disabled={selected.bi === 0}
                                onClick={() => moveButton(ri, selected.bi, -1)}
                                title={ru ? 'Левее' : 'Move left'}
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                className="adm-bcast-icon-btn"
                                disabled={selected.bi >= row.length - 1}
                                onClick={() => moveButton(ri, selected.bi, 1)}
                                title={ru ? 'Правее' : 'Move right'}
                              >
                                →
                              </button>
                              <span className="adm-bcast-panel-divider" />
                              <button
                                type="button"
                                className="adm-bcast-icon-btn"
                                disabled={ri === 0}
                                onClick={() => moveRow(ri, -1)}
                                title={ru ? 'Строка выше' : 'Row up'}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="adm-bcast-icon-btn"
                                disabled={ri >= rows.length - 1}
                                onClick={() => moveRow(ri, 1)}
                                title={ru ? 'Строка ниже' : 'Row down'}
                              >
                                ↓
                              </button>
                              <span className="adm-bcast-panel-divider" />
                              <button
                                type="button"
                                className="adm-bcast-icon-btn adm-bcast-icon-btn--danger"
                                onClick={() => removeButton(ri, selected.bi)}
                              >
                                {ru ? 'Удалить' : 'Delete'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {ri < rows.length - 1 && (
                        <div className="adm-bcast-row-gap" aria-hidden />
                      )}
                    </div>
                  ))}

                  <button type="button" className="adm-bcast-add-row" onClick={() => addRow(true)}>
                    <span className="adm-bcast-add-row-line" />
                    <span>{ru ? 'Новая строка кнопок' : 'New row of buttons'}</span>
                    <span className="adm-bcast-add-row-line" />
                  </button>
                </div>
              )}
            </div>

            {rows.length > 0 && (
              <p className="adm-bcast-foot">
                {ru
                  ? 'Несколько кнопок в одной строке — стоят рядом, как в Telegram.'
                  : 'Multiple buttons on one line sit side by side, like in Telegram.'}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!enabled && (
        <p className="adm-bcast-off">
          {ru ? 'Сообщение уйдёт без кнопок — только текст.' : 'Message sends as text only, no buttons.'}
        </p>
      )}
    </div>
  )
}
