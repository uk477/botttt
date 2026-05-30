import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'

interface Account {
  fanvueLogin: string
  fanvuePassword: string
  mailEmail: string
  mailPassword: string
  instruction: string
}

const EMPTY: Account = {
  fanvueLogin: '', fanvuePassword: '',
  mailEmail: '', mailPassword: '',
  instruction: '',
}

function parseItem(raw: string): Account {
  const acc: Account = { ...EMPTY }
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const extraInstr: string[] = []
  for (const ln of lines) {
    const line = ln.trim()
    if (!line) continue
    const m = line.match(/^([^:：]+)[:：]\s*(.+)$/)
    if (!m) { extraInstr.push(line); continue }
    const k = m[1].trim().toLowerCase()
    const v = m[2].trim()
    if (/инструкц|instruct|примеч|safety|безопасн/.test(k)) { extraInstr.push(v); continue }
    if (/(почт|mail|email).*парол|парол.*(почт|mail|email)|mail[ _-]?pass|email[ _-]?pass/.test(k)) { acc.mailPassword = v; continue }
    if (/^(почт[аы]?|email|e[-_ ]?mail|mail)(?:\s|$)/.test(k)) { acc.mailEmail = v; continue }
    if (/^(логин|login|username|user)(?:\s|$)/.test(k)) { acc.fanvueLogin = v; continue }
    if (/^(пароль|password|pass)(?:\s|$)/.test(k)) { acc.fanvuePassword = v; continue }
    extraInstr.push(`${m[1].trim()}: ${v}`)
  }
  acc.instruction = extraInstr.join('\n')
  return acc
}

function serializeItem(a: Account): string {
  const lines: string[] = []
  if (a.fanvueLogin.trim()) lines.push(`Логин: ${a.fanvueLogin.trim()}`)
  if (a.fanvuePassword.trim()) lines.push(`Пароль: ${a.fanvuePassword.trim()}`)
  if (a.mailEmail.trim()) lines.push(`Почта: ${a.mailEmail.trim()}`)
  if (a.mailPassword.trim()) lines.push(`Пароль почты: ${a.mailPassword.trim()}`)
  if (a.instruction.trim()) lines.push(`Инструкция: ${a.instruction.trim()}`)
  return lines.join('\n')
}

const GREEN = '#39ff63'
const BLUE = '#00A4E4'

function FieldRow({
  label, value, onChange, placeholder, accent, mono = true,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  accent: string
  mono?: boolean
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.45)', fontFamily: 'ui-monospace, monospace', fontWeight: 700,
      }}>{label}</span>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          fontFamily: mono ? 'ui-monospace, monospace' : undefined,
          fontSize: 13, fontWeight: 600,
          borderColor: value ? `${accent}55` : undefined,
        }}
      />
    </label>
  )
}

function BrandHeader({ icon, title, accent, index, total, onDelete, onUp, onDown }: {
  icon: React.ReactNode; title: string; accent: string;
  index: number; total: number;
  onDelete: () => void; onUp: () => void; onDown: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: `linear-gradient(180deg, ${accent}1a, transparent)`,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: `${accent}22`, color: accent,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 12, flexShrink: 0,
      }}>#{index + 1}</div>
      <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#fff', letterSpacing: '-0.01em' }}>
        {title}
      </div>
      <button
        type="button" onClick={onUp} disabled={index === 0}
        style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#fff', opacity: index === 0 ? 0.3 : 1 }}
      >↑</button>
      <button
        type="button" onClick={onDown} disabled={index === total - 1}
        style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#fff', opacity: index === total - 1 ? 0.3 : 1 }}
      >↓</button>
      <button
        type="button" onClick={onDelete}
        style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(239,68,68,0.18)', color: '#ff5b5b' }}
      >🗑</button>
    </div>
  )
}

export default function AccountsPoolEditor({
  items, onChange,
}: {
  items: string[]
  onChange: (items: string[]) => void
}) {
  const lang = useStore((s) => s.lang)
  const accounts = useMemo(() => items.map(parseItem), [items])

  const update = (i: number, next: Account) => {
    const copy = [...accounts]
    copy[i] = next
    onChange(copy.map(serializeItem))
  }
  const add = () => onChange([...items, serializeItem(EMPTY)])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const copy = [...items]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    onChange(copy)
  }

  return (
    <div className="col gap-3">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderRadius: 10,
        background: 'rgba(57,255,99,0.06)', border: `1px solid ${GREEN}33`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
            🎁 {lang === 'ru' ? 'Пул аккаунтов' : 'Accounts pool'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {lang === 'ru'
              ? '1 аккаунт = 1 продажа. Заполняй как в выдаче клиенту.'
              : '1 account = 1 sale. Fill as the client will see.'}
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 999,
          background: GREEN, color: '#000', fontWeight: 800, fontSize: 12,
        }}>
          {accounts.length} {lang === 'ru' ? 'шт' : 'pcs'}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {accounts.map((a, i) => (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            style={{
              background: '#0f0f0f',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, overflow: 'hidden',
            }}
          >
            <BrandHeader
              icon={null}
              title={lang === 'ru' ? `Аккаунт #${i + 1}` : `Account #${i + 1}`}
              accent={GREEN}
              index={i}
              total={accounts.length}
              onDelete={() => remove(i)}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
            />

            {/* Fanvue */}
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: `linear-gradient(180deg, ${GREEN}08, transparent)`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              }}>
                <span style={{
                  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: GREEN, fontWeight: 800,
                }}>Fanvue</span>
                <span style={{ flex: 1, height: 1, background: `${GREEN}22` }} />
              </div>
              <div className="col gap-2">
                <FieldRow
                  label={lang === 'ru' ? 'Логин' : 'Login'}
                  value={a.fanvueLogin}
                  onChange={(v) => update(i, { ...a, fanvueLogin: v })}
                  placeholder="username"
                  accent={GREEN}
                />
                <FieldRow
                  label={lang === 'ru' ? 'Пароль' : 'Password'}
                  value={a.fanvuePassword}
                  onChange={(v) => update(i, { ...a, fanvuePassword: v })}
                  placeholder="••••••••"
                  accent={GREEN}
                />
              </div>
            </div>

            {/* Mail */}
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: `linear-gradient(180deg, ${BLUE}08, transparent)`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              }}>
                <span style={{
                  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: BLUE, fontWeight: 800,
                }}>mail.com</span>
                <span style={{ flex: 1, height: 1, background: `${BLUE}22` }} />
              </div>
              <div className="col gap-2">
                <FieldRow
                  label={lang === 'ru' ? 'Почта' : 'Email'}
                  value={a.mailEmail}
                  onChange={(v) => update(i, { ...a, mailEmail: v })}
                  placeholder="name@mail.com"
                  accent={BLUE}
                />
                <FieldRow
                  label={lang === 'ru' ? 'Пароль' : 'Password'}
                  value={a.mailPassword}
                  onChange={(v) => update(i, { ...a, mailPassword: v })}
                  placeholder="••••••••"
                  accent={BLUE}
                />
              </div>
            </div>

            {/* Instruction */}
            <div style={{ padding: '12px 14px' }}>
              <div style={{
                fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)', fontFamily: 'ui-monospace, monospace',
                fontWeight: 700, marginBottom: 4,
              }}>
                {lang === 'ru' ? 'Инструкция (опционально)' : 'Instruction (optional)'}
              </div>
              <textarea
                className="input"
                rows={2}
                value={a.instruction}
                onChange={(e) => update(i, { ...a, instruction: e.target.value })}
                placeholder={lang === 'ru' ? 'Например: войти и сразу сменить пароль' : 'e.g. log in and change password'}
                style={{ fontSize: 12, lineHeight: 1.45 }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={add}
        whileTap={{ scale: 0.97 }}
        style={{
          padding: '12px 14px', borderRadius: 12,
          background: GREEN, color: '#000', fontWeight: 800,
          fontSize: 13, letterSpacing: '0.04em',
          boxShadow: `0 8px 24px -10px ${GREEN}88`,
        }}
      >
        + {lang === 'ru' ? 'Добавить аккаунт' : 'Add account'}
      </motion.button>
    </div>
  )
}