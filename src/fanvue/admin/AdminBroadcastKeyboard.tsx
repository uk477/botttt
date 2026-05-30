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
    rows: rows
      .map((row) =>
        row
          .filter((b) => b.text.trim())
          .map(({ text, type, url }) => ({ text: text.trim(), type, url: url.trim() })),
      )
      .filter((row) => row.length > 0),
  }
}

export function defaultKeyboardRows(): BroadcastBtn[][] {
  return rowsFromKeyboard(defaultBroadcastKeyboard())
}

type Props = {
  lang: 'ru' | 'en'
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  rows: BroadcastBtn[][]
  onRowsChange: (rows: BroadcastBtn[][]) => void
}

export default function AdminBroadcastKeyboard({
  lang,
  enabled,
  onEnabledChange,
  rows,
  onRowsChange,
}: Props) {
  const ru = lang === 'ru'

  const patchRow = (ri: number, row: BroadcastBtn[]) => {
    const next = [...rows]
    next[ri] = row
    onRowsChange(next)
  }

  const addButton = (ri: number) => {
    const btn: BroadcastBtn = { id: newId(), text: '', type: 'url', url: '' }
    patchRow(ri, [...(rows[ri] ?? []), btn])
  }

  const addRow = () => {
    onRowsChange([
      ...rows,
      [{ id: newId(), text: ru ? 'Открыть приложение' : 'Open app', type: 'web_app', url: '' }],
    ])
  }

  const updateBtn = (ri: number, bi: number, patch: Partial<BroadcastBtn>) => {
    patchRow(
      ri,
      rows[ri].map((b, i) => (i === bi ? { ...b, ...patch } : b)),
    )
  }

  const removeBtn = (ri: number, bi: number) => {
    const row = rows[ri].filter((_, i) => i !== bi)
    if (row.length === 0) onRowsChange(rows.filter((_, i) => i !== ri))
    else patchRow(ri, row)
  }

  const enableButtons = () => {
    onEnabledChange(true)
    if (rows.length === 0) onRowsChange(defaultKeyboardRows())
  }

  return (
    <div className="adm-bcast-simple">
      <div className="adm-bcast-mode">
        <button
          type="button"
          className={`adm-bcast-mode-btn${!enabled ? ' is-on' : ''}`}
          onClick={() => onEnabledChange(false)}
        >
          {ru ? 'Без кнопки' : 'No button'}
        </button>
        <button
          type="button"
          className={`adm-bcast-mode-btn${enabled ? ' is-on' : ''}`}
          onClick={enableButtons}
        >
          {ru ? 'С кнопкой' : 'With button'}
        </button>
      </div>

      {enabled && (
        <div className="adm-bcast-list">
          {rows.length === 0 && (
            <button type="button" className="adm-btn adm-btn--block" onClick={addRow}>
              + {ru ? 'Добавить кнопку' : 'Add button'}
            </button>
          )}

          {rows.map((row, ri) => (
            <div key={ri} className="adm-bcast-line">
              {ri > 0 && (
                <div className="adm-bcast-line-label">
                  {ru ? `Строка ${ri + 1}` : `Row ${ri + 1}`}
                </div>
              )}
              {row.map((b, bi) => (
                <div key={b.id} className="adm-bcast-item">
                  <label className="adm-bcast-field">
                    <span>{ru ? 'Текст на кнопке' : 'Button text'}</span>
                    <input
                      className="adm-input"
                      value={b.text}
                      maxLength={64}
                      placeholder={ru ? 'Открыть приложение' : 'Open app'}
                      onChange={(e) => updateBtn(ri, bi, { text: e.target.value })}
                    />
                  </label>

                  <div className="adm-bcast-type">
                    <button
                      type="button"
                      className={`adm-bcast-type-btn${b.type === 'web_app' ? ' is-on' : ''}`}
                      onClick={() => updateBtn(ri, bi, { type: 'web_app' })}
                    >
                      {ru ? 'Приложение' : 'Mini-app'}
                    </button>
                    <button
                      type="button"
                      className={`adm-bcast-type-btn${b.type === 'url' ? ' is-on' : ''}`}
                      onClick={() => updateBtn(ri, bi, { type: 'url' })}
                    >
                      {ru ? 'Ссылка' : 'Link'}
                    </button>
                  </div>

                  {b.type === 'url' && (
                    <label className="adm-bcast-field">
                      <span>{ru ? 'Куда ведёт' : 'URL'}</span>
                      <input
                        className="adm-input"
                        value={b.url}
                        placeholder="https://t.me/..."
                        onChange={(e) => updateBtn(ri, bi, { url: e.target.value })}
                        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                      />
                    </label>
                  )}

                  {b.type === 'web_app' && (
                    <label className="adm-bcast-field">
                      <span>{ru ? 'URL приложения (необяз.)' : 'App URL (optional)'}</span>
                      <input
                        className="adm-input"
                        value={b.url}
                        placeholder={ru ? 'Пусто = с сервера' : 'Empty = from server'}
                        onChange={(e) => updateBtn(ri, bi, { url: e.target.value })}
                        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    className="adm-bcast-remove"
                    onClick={() => removeBtn(ri, bi)}
                  >
                    {ru ? 'Удалить кнопку' : 'Remove button'}
                  </button>
                </div>
              ))}

              <div className="adm-bcast-line-actions">
                <button type="button" className="adm-btn adm-btn--sm" onClick={() => addButton(ri)}>
                  + {ru ? 'Рядом' : 'Same row'}
                </button>
                {ri === rows.length - 1 && (
                  <button type="button" className="adm-btn adm-btn--sm" onClick={addRow}>
                    + {ru ? 'Новая строка' : 'New row'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
