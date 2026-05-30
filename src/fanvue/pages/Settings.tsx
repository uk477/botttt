import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import PageTransition from '../components/PageTransition'
import { useT } from '../i18n'
import { useStore } from '../store'
import { useTelegram } from '../hooks/useTelegram'
import { useToast } from '../components/Toast'
import { CONFIG } from '../config'
import { openTelegramUrl } from '../utils/telegramLink'
import type { Lang } from '../store/types'
import type { SiteContent } from '../store'
import fanvueMarkSrc from '../assets/fanvue-mark.png'

const NEON = '#00FF88'
const FONT_LINK_ID = 'fv-settings-fonts'
const inter = "'Inter', system-ui, sans-serif"
const mono  = "'Space Mono', ui-monospace, monospace"

const DocIcon     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
const RulesIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
const ContactIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const ReferralIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const StarIcon     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
const EditIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>
const BackIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
const ChevronIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }
const fadeUp = { hidden: { opacity: 0, y: 18, filter: 'blur(6px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }

function LangToggle() {
  const lang    = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const { haptic } = useTelegram()
  const toast   = useToast()

  const toggle = (l: Lang) => {
    if (l === lang) return
    haptic('light')
    setLang(l)
    toast.show(l === 'ru' ? 'Русский язык включён' : 'English enabled', 'success')
  }

  return (
    <div className="lang-toggle">
      <motion.div
        className="lang-track"
        animate={{ x: lang === 'en' ? '100%' : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
      <button className={`lang-btn${lang === 'ru' ? ' active' : ''}`} onClick={() => toggle('ru')}>RU</button>
      <button className={`lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => toggle('en')}>EN</button>
    </div>
  )
}

const NEON_COLORS = ['#00FF88', '#FF3366', '#FFB800', '#3DA9FC', '#B967FF', '#FFFFFF']

function EditorToolbar({
  textareaRef, setDraft, lang,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  setDraft: React.Dispatch<React.SetStateAction<string>>
  lang: Lang
}) {
  const [showColors, setShowColors] = useState(false)

  const getLinkSelection = (ta: HTMLTextAreaElement) => {
    let start = ta.selectionStart
    let end = ta.selectionEnd
    const value = ta.value

    if (start === end) {
      while (start > 0 && !/\s/.test(value[start - 1])) start -= 1
      while (end < value.length && !/\s/.test(value[end])) end += 1
    }

    const text = value.slice(start, end) || (lang === 'ru' ? 'ссылка' : 'link')
    return { start, end, text }
  }

  const wrap = (before: string, after: string = before, placeholder = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const sel   = ta.value.slice(start, end) || placeholder
    const next  = ta.value.slice(0, start) + before + sel + after + ta.value.slice(end)
    setDraft(next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + before.length + sel.length
      ta.setSelectionRange(start + before.length, pos)
    })
  }

  const insertAtLineStart = (prefix: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const v = ta.value
    const start = ta.selectionStart
    const lineStart = v.lastIndexOf('\n', start - 1) + 1
    const next = v.slice(0, lineStart) + prefix + v.slice(lineStart)
    setDraft(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  const insertLink = () => {
    const ta = textareaRef.current
    if (!ta) return
    const { start, end, text } = getLinkSelection(ta)
    const url = window.prompt(lang === 'ru' ? 'Вставьте URL:' : 'Paste URL:', 'https://')
    if (!url) return
    const token = `[${text}](${url.trim()})`
    const next = ta.value.slice(0, start) + token + ta.value.slice(end)
    setDraft(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const applyColor = (hex: string) => {
    wrap(`{c:${hex}}`, '{/c}', lang === 'ru' ? 'текст' : 'text')
    setShowColors(false)
  }

  const Btn = ({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        minWidth: 32, height: 30, padding: '0 8px', borderRadius: 8,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: inter,
      }}
    >
      {children}
    </button>
  )

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 6, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Btn title="Bold"          onClick={() => wrap('**', '**', lang==='ru'?'жирный':'bold')}><b>B</b></Btn>
        <Btn title="Italic"        onClick={() => wrap('*', '*', lang==='ru'?'курсив':'italic')}><i>I</i></Btn>
        <Btn title="Underline"     onClick={() => wrap('__', '__', lang==='ru'?'подчёрк':'underline')}><span style={{ textDecoration:'underline' }}>U</span></Btn>
        <Btn title="Strike"        onClick={() => wrap('~~', '~~', lang==='ru'?'зачёрк':'strike')}><span style={{ textDecoration:'line-through' }}>S</span></Btn>
        <Btn title="Inline code"   onClick={() => wrap('`', '`', 'code')}><span style={{ fontFamily: mono }}>{'</>'}</span></Btn>
        <Btn title="Link"          onClick={insertLink}>🔗</Btn>
        <Btn title="Color"         onClick={() => setShowColors(s => !s)}><span style={{ color: NEON }}>A</span></Btn>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 4px' }} />
        <Btn title="Heading"       onClick={() => insertAtLineStart('## ')}>H1</Btn>
        <Btn title="Subheading"    onClick={() => insertAtLineStart('### ')}>H2</Btn>
        <Btn title="List"          onClick={() => insertAtLineStart('• ')}>•</Btn>
      </div>
      {showColors && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 10,
          display: 'flex', gap: 6, padding: 8, borderRadius: 10,
          background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {NEON_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => applyColor(c)}
              title={c}
              style={{
                width: 24, height: 24, borderRadius: 6, background: c,
                border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ContentSheet({
  title, contentKey, onClose,
}: {
  title: string; contentKey: keyof SiteContent; onClose: () => void
}) {
  const lang        = useStore((s) => s.lang)
  const isAdmin     = useStore((s) => s.isAdmin)
  const siteContent = useStore((s) => s.siteContent)
  const setSiteContent = useStore((s) => s.setSiteContent)
  const { haptic }  = useTelegram()
  const toast       = useToast()
  const [editing, setEditing] = useState(false)
  const [visible, setVisible] = useState(true)
  const langKey = (contentKey.endsWith('_ru') || contentKey.endsWith('_en')
    ? contentKey
    : `${contentKey}_${lang}`) as keyof SiteContent
  const [draft, setDraft]     = useState(siteContent[langKey] ?? '')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const closingRef = useRef(false)
  const admin = isAdmin()

  useEffect(() => {
    return () => {
      closingRef.current = false
    }
  }, [])

  const closeSheet = () => {
    if (closingRef.current) return
    closingRef.current = true
    setVisible(false)
  }

  const defaultTexts: Partial<Record<keyof SiteContent, string>> = {
    offer_ru: `## Публичная оферта

Настоящий документ является официальным предложением **Fanvue Market** на оказание услуг по продаже цифровых товаров и аккаунтов платформы Fanvue.

## Предмет договора

Продавец передаёт покупателю цифровой товар в соответствии с описанием на странице. Покупатель оплачивает товар в **полном объёме** до его получения.

## Условия оплаты

Оплата производится криптовалютой через встроенную систему. Сумма фиксируется в **USD** на момент создания заказа. Оплата должна поступить в течение **30 минут**.

## Доставка

**Автоматическая доставка** — товар передаётся сразу после подтверждения оплаты.

**Ручная доставка** — администратор передаёт товар в течение **1–24 часов**. После оплаты напишите в поддержку с ID заказа.

## Возврат и гарантии

Возврат возможен в течение **24 часов**, если товар не был использован.`,
    offer_en: `## Public Offer

This document is the official offer of **Fanvue Market** for the sale of digital goods and Fanvue platform accounts.

## Payment Terms

Payment is made in cryptocurrency. The amount is fixed in **USD** at order creation. Payment must arrive within **30 minutes**.

## Delivery

**Automatic** — product transferred immediately after payment. **Manual** — within 1–24 hours, contact support with your order ID.

## Returns

Returns accepted within **24 hours** if the product has not been used.`,
    rules_ru: `## Правила использования

Используя **Fanvue Market**, вы принимаете настоящие правила.

## Реферальная программа

За каждую покупку приглашённого вами друга вы получаете **$5** на реферальный баланс.

## Бонусное вознаграждение

Пригласите **10 пользователей** за месяц, каждый из которых совершит покупку — получите **бонус $50** автоматически.

• Счётчик обнуляется в начале каждого месяца
• Минимальная сумма вывода: **$10**`,
    rules_en: `## Terms of Use

By using **Fanvue Market** you accept these rules.

## Referral Program

Earn **$5** for every purchase made by a user you invited.

## Bonus Reward

Invite **10 users** who each make a purchase in a month — earn an automatic **$50 bonus**.

• Counter resets monthly
• Minimum withdrawal: **$10**`,
    referral_rules_ru: `## Реферальная программа Fanvue Market

### Как это работает
Приглашайте друзей в Fanvue Market и зарабатывайте с каждой их покупки!

### Условия
• **$5** за каждого приглашённого друга, совершившего покупку
• Бонус начисляется после первого оплаченного заказа реферала
• Реферальные средства отображаются на отдельном балансе

### Ежемесячный бонус
• Пригласите **10 активных клиентов** за месяц
• Каждый из них должен совершить хотя бы 1 заказ
• Получите дополнительно **$100** к реферальному балансу
• Счётчик обновляется 1-го числа каждого месяца

### Вывод средств
• Минимальная сумма вывода: **$10**
• Доступные валюты: USDT (TRC20/ERC20), ETH, BTC, SOL, USDC
• Срок обработки: до **24 часов**
• Комиссия сети оплачивается из суммы вывода

### Правила
• Запрещены самоприглашения и мультиаккаунты
• Администрация оставляет за собой право отклонить подозрительные заявки
• Программа может быть изменена с уведомлением участников`,
    referral_rules_en: `## Fanvue Market Referral Program

### How It Works
Invite friends to Fanvue Market and earn from every purchase they make!

### Terms
• **$5** for each invited friend who makes a purchase
• Bonus is credited after the referral's first paid order
• Referral funds appear on a separate balance

### Monthly Bonus
• Invite **10 active clients** within a calendar month
• Each must complete at least 1 order
• Receive an additional **$100** to your referral balance
• Counter resets on the 1st of each month

### Withdrawal
• Minimum withdrawal: **$10**
• Available currencies: USDT (TRC20/ERC20), ETH, BTC, SOL, USDC
• Processing time: up to **24 hours**
• Network fees are deducted from the withdrawal amount

### Rules
• Self-referrals and multi-accounts are prohibited
• Administration reserves the right to decline suspicious requests
• Program terms may change with prior notice to participants`,
    contacts_ru: `## Контакты

**Поддержка** — вкладка в нижнем меню, ответ до 30 минут.

Бот: **@${CONFIG.botUsername}**
Канал: **@${CONFIG.channelUsername}**
Сообщество: **@${CONFIG.communityUsername}**

При обращении всегда указывайте **ID заказа**.`,
    contacts_en: `## Contacts

**Support** — bottom menu tab, response within 30 minutes.

Bot: **@${CONFIG.botUsername}**
Channel: **@${CONFIG.channelUsername}**
Community: **@${CONFIG.communityUsername}**

Always provide your **Order ID** when contacting support.`,
  }

  const displayText = siteContent[langKey] || defaultTexts[langKey] || ''

  const handleSave = () => {
    setSiteContent(langKey, draft)
    setEditing(false)
    haptic('success')
    toast.show(lang === 'ru' ? 'Сохранено' : 'Saved', 'success')
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeSheet()
  }

  return (
    <motion.div
      className="modal-overlay"
      data-closing={closingRef.current ? 'true' : undefined}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        if (!visible) onClose()
      }}
      onClick={handleBackdropClick}
    >
      <motion.div
        ref={sheetRef}
        className="sheet"
        initial={{ y: '100%' }}
        animate={{ y: visible ? 0 : '100%' }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34, mass: 0.75 }}
        style={{ maxHeight: '85dvh', willChange: 'transform', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          className="sheet-handle"
          style={{ cursor: editing ? 'default' : 'grab', touchAction: 'none' }}
          drag={!editing ? 'y' : false}
          dragDirectionLock
          dragMomentum={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={(_, info) => {
            if (editing || closingRef.current) return
            if (info.offset.y > 80 || info.velocity.y > 500) closeSheet()
          }}
        />
        <div className="row-between mb-4">
          <div className="t-md fw-black">{title}</div>
          <div className="row gap-2">
            {admin && !editing && (
              <motion.button
                className="card"
                style={{ padding: '6px 12px', color: 'var(--brand)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => { setDraft(displayText); setEditing(true) }}
                whileTap={{ scale: 0.95 }}
              >
                <EditIcon /> {lang === 'ru' ? 'Изменить' : 'Edit'}
              </motion.button>
            )}
            <motion.button
              className="card"
              style={{ padding: '6px 12px', color: 'var(--t-muted)', fontSize: 12 }}
              onClick={closeSheet}
              whileTap={{ scale: 0.95 }}
            >
              {lang === 'ru' ? 'Закрыть' : 'Close'}
            </motion.button>
          </div>
        </div>

        {editing ? (
          <>
            <EditorToolbar textareaRef={textareaRef} setDraft={setDraft} lang={lang} />
            <textarea
              ref={textareaRef}
              className="input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={lang === 'ru' ? 'Введите текст...' : 'Enter text...'}
              style={{ width: '100%', minHeight: 260, borderRadius: 12, padding: '12px 14px', resize: 'vertical', lineHeight: 1.6, fontFamily: mono, fontSize: 13 }}
            />
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 1.5 }}>
              {lang === 'ru'
                ? 'Markdown: ## Заголовок · ### Подзаголовок · **жирный** · *курсив* · __подчёрк__ · ~~зачёрк~~ · {c:#00FF88}цвет{/c} · [текст](https://...) · • список'
                : 'Markdown: ## Heading · ### Subheading · **bold** · *italic* · __underline__ · ~~strike~~ · {c:#00FF88}color{/c} · [text](https://...) · • list'}
            </div>
            <div className="row gap-2 mt-3">
              <motion.button className="btn btn-primary" onClick={handleSave} whileTap={{ scale: 0.97 }} style={{ flex: 1 }}>
                {lang === 'ru' ? 'Сохранить' : 'Save'}
              </motion.button>
              <motion.button className="btn btn-secondary" onClick={() => { setDraft(displayText); setEditing(false) }} whileTap={{ scale: 0.97 }}>
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </motion.button>
            </div>
          </>
        ) : (
          <motion.div
            style={{ overflowY: 'auto', maxHeight: '60dvh', paddingRight: 4 }}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } } }}
          >
            {(() => {
              const lines = displayText.split('\n')
              const renderInline = (text: string) => {
                const tokens: Array<JSX.Element | string> = []
                const regex = /(\{c:#[0-9a-fA-F]{3,8}\}[\s\S]+?\{\/c\}|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
                let lastIdx = 0
                let m: RegExpExecArray | null
                let key = 0
                while ((m = regex.exec(text)) !== null) {
                  if (m.index > lastIdx) tokens.push(text.slice(lastIdx, m.index))
                  const tok = m[0]
                  if (tok.startsWith('{c:')) {
                    const cm = /^\{c:(#[0-9a-fA-F]{3,8})\}([\s\S]+?)\{\/c\}$/.exec(tok)!
                    tokens.push(<span key={key++} style={{ color: cm[1] }}>{cm[2]}</span>)
                  } else if (tok.startsWith('**')) {
                    tokens.push(<strong key={key++} style={{ color: '#fff', fontWeight: 800 }}>{tok.slice(2, -2)}</strong>)
                  } else if (tok.startsWith('__')) {
                    tokens.push(<span key={key++} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{tok.slice(2, -2)}</span>)
                  } else if (tok.startsWith('~~')) {
                    tokens.push(<span key={key++} style={{ textDecoration: 'line-through', opacity: 0.7 }}>{tok.slice(2, -2)}</span>)
                  } else if (tok.startsWith('`')) {
                    tokens.push(
                      <code key={key++} style={{
                        fontFamily: mono, fontSize: 12, padding: '2px 6px',
                        background: `${NEON}1A`, color: NEON, borderRadius: 6,
                        border: `1px solid ${NEON}33`,
                      }}>{tok.slice(1, -1)}</code>
                    )
                  } else if (tok.startsWith('[')) {
                    const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!
                    tokens.push(
                      <a key={key++} href={mm[2]} target="_blank" rel="noreferrer" style={{ color: NEON, borderBottom: `1px dashed ${NEON}66`, textDecoration: 'none' }}>
                        {mm[1]}
                      </a>
                    )
                  } else if (tok.startsWith('*')) {
                    tokens.push(<em key={key++} style={{ color: 'rgba(255,255,255,0.85)' }}>{tok.slice(1, -1)}</em>)
                  }
                  lastIdx = m.index + tok.length
                }
                if (lastIdx < text.length) tokens.push(text.slice(lastIdx))
                return tokens
              }

              const itemVariant = {
                hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
                show:   { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
              }

              return lines.map((line, i) => {
                if (line.startsWith('### ')) {
                  return (
                    <motion.div key={i} variants={itemVariant} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      marginTop: 18, marginBottom: 8,
                    }}>
                      <div style={{ width: 3, height: 14, background: NEON, borderRadius: 2 }} />
                      <span style={{
                        fontSize: 13, fontWeight: 800, color: '#fff',
                        letterSpacing: '-0.01em',
                      }}>{line.slice(4)}</span>
                    </motion.div>
                  )
                }
                if (line.startsWith('## ')) {
                  return (
                    <motion.div key={i} variants={itemVariant} style={{ marginTop: i === 0 ? 4 : 24, marginBottom: 10 }}>
                      <div style={{ fontFamily: mono, fontSize: 9, color: NEON, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
                        § {String(i + 1).padStart(2, '0')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                        {line.slice(3)}
                      </div>
                      <div style={{ marginTop: 8, height: 1, background: `linear-gradient(90deg, ${NEON}55, transparent)` }} />
                    </motion.div>
                  )
                }
                if (/^\s*[•-]\s+/.test(line)) {
                  return (
                    <motion.div key={i} variants={itemVariant} style={{
                      display: 'flex', gap: 10, marginBottom: 6, paddingLeft: 4,
                    }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: NEON, marginTop: 9, flexShrink: 0,
                        boxShadow: `0 0 8px ${NEON}66`,
                      }} />
                      <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.78)' }}>
                        {renderInline(line.replace(/^\s*[•-]\s+/, ''))}
                      </div>
                    </motion.div>
                  )
                }
                if (line.trim() === '') return <div key={i} style={{ height: 8 }} />
                return (
                  <motion.div key={i} variants={itemVariant} style={{
                    fontSize: 13.5, lineHeight: 1.7, color: 'rgba(255,255,255,0.72)',
                    marginBottom: 4,
                  }}>
                    {renderInline(line)}
                  </motion.div>
                )
              })
            })()}

            {/* End ornament */}
            <motion.div
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.3 } } }}
              style={{
                marginTop: 24, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
              }}
            >
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em' }}>END · v2.0.0</span>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.06)' }} />
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const t        = useT()
  const lang     = useStore((s) => s.lang)
  const siteLinks = useStore((s) => s.siteLinks)
  const setLang  = useStore((s) => s.setLang)
  const { haptic } = useTelegram()
  const toast    = useToast()
  const [openSheet, setOpenSheet] = useState<keyof SiteContent | null>(null)
  

  // Inject Inter + Space Mono once (scoped via CSS classes below)
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return
    const link = document.createElement('link')
    link.id = FONT_LINK_ID
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,500;0,900;1,900&family=Space+Mono:wght@400;700&display=swap'
    document.head.appendChild(link)
  }, [])

  const switchLang = (l: Lang) => {
    if (l === lang) return
    haptic('light')
    setLang(l)
    toast.show(l === 'ru' ? 'Русский язык включён' : 'English enabled', 'success')
  }

  type Link = { key: keyof SiteContent; label: string }
  const links: Link[] = [
    { key: (lang === 'ru' ? 'offer_ru'          : 'offer_en')          as keyof SiteContent, label: t('settings_offer')    },
    { key: (lang === 'ru' ? 'rules_ru'          : 'rules_en')          as keyof SiteContent, label: t('settings_rules')    },
    { key: (lang === 'ru' ? 'referral_rules_ru' : 'referral_rules_en') as keyof SiteContent, label: t('settings_referral') },
  ]


  return (
    <>
      <PageTransition>
        <motion.div
          className="page"
          variants={stagger}
          initial="hidden"
          animate="show"
          style={{ position: 'relative', overflow: 'hidden', fontFamily: inter, padding: '20px 18px 60px' }}
        >
          {/* === Animated diagonal speed lines === */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
            {[0.18, 0.38, 0.58, 0.78].map((left, i) => (
              <motion.div
                key={i}
                style={{
                  position: 'absolute', top: '-30%', left: `${left * 100}%`,
                  width: 1, height: '160%',
                  background: `linear-gradient(180deg, transparent, ${NEON}55, transparent)`,
                  transform: 'rotate(12deg)', transformOrigin: 'top',
                  opacity: 0.35,
                }}
                animate={{ y: ['-12%', '12%', '-12%'] }}
                transition={{ duration: 6 + i * 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
              />
            ))}
            {/* Soft neon halo */}
            <motion.div
              style={{
                position: 'absolute', top: '-15%', right: '-25%',
                width: 380, height: 380, borderRadius: '50%',
                background: `${NEON}20`, filter: 'blur(110px)',
              }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* === HEADER === */}
            <motion.div variants={fadeUp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
              <motion.button
                onClick={() => navigate(-1)}
                whileTap={{ scale: 0.96 }}
                whileHover={{ borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.04)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                style={{
                  height: 40, padding: '0 16px',
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  cursor: 'pointer', borderRadius: 4,
                  fontFamily: mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                Назад
              </motion.button>
              <div style={{ textAlign: 'right', fontFamily: mono, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: NEON, lineHeight: 1.5 }}>
                Internal Build<br />
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>v2.0.0_</span>
                <motion.span
                  animate={{ opacity: [1, 1, 0, 0, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear', times: [0, 0.49, 0.5, 0.99, 1] }}
                  style={{ color: NEON }}
                >STABLE</motion.span>
              </div>
            </motion.div>

            {/* === HERO LOGO + TITLE === */}
            <motion.div variants={fadeUp} style={{ position: 'relative', marginBottom: 28 }}>
              {/* Ghost text behind */}
              <div aria-hidden style={{
                position: 'absolute', top: -6, left: -8,
                fontSize: 88, fontWeight: 900, fontStyle: 'italic',
                color: 'rgba(255,255,255,0.04)', lineHeight: 0.9, letterSpacing: '-0.05em',
                userSelect: 'none', pointerEvents: 'none', fontFamily: inter,
              }}>
                FANVUE
              </div>

              {/* anvue with logo F mark */}
              <div style={{ display: 'flex', alignItems: 'baseline', position: 'relative' }}>
                <motion.span
                  initial={false}
                  animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                  whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.6 } }}
                  style={{
                    display: 'inline-block',
                    width: 44, height: 46,
                    transform: 'translateY(4px)',
                    backgroundColor: '#fff',
                    WebkitMaskImage: `url(${fanvueMarkSrc})`,
                    maskImage: `url(${fanvueMarkSrc})`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    filter: `drop-shadow(0 0 12px ${NEON}55)`,
                  }}
                />
                <motion.span
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
                  style={{
                    fontSize: 50, fontWeight: 900, fontStyle: 'italic',
                    color: '#fff', letterSpacing: '-0.045em', lineHeight: 0.9,
                    fontFamily: inter, marginLeft: -4,
                  }}
                >
                  anvue
                </motion.span>
              </div>

              <motion.div
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35 }}
                style={{
                  fontSize: 56, fontWeight: 900, fontStyle: 'italic',
                  color: NEON, letterSpacing: '-0.045em', lineHeight: 0.9,
                  fontFamily: inter, textShadow: `0 0 24px ${NEON}66`,
                }}
              >
                MARKET
              </motion.div>
            </motion.div>

            {/* === LANGUAGE + SOCIALS GRID === */}
            <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {/* Language tile */}
              <div style={{
                background: 'rgba(255,255,255,0.04)', padding: 14, position: 'relative', overflow: 'hidden',
                borderTop: '1px solid rgba(255,255,255,0.06)', borderLeft: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontFamily: mono, fontSize: 9, color: NEON, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 6 }}>Language</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.02em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {lang === 'ru' ? 'РУССКИЙ' : 'ENGLISH'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['ru','en'] as Lang[]).map((l) => (
                    <motion.button
                      key={l}
                      onClick={() => switchLang(l)}
                      whileTap={{ scale: 0.92 }}
                      style={{
                        padding: '5px 12px', fontSize: 11, fontWeight: 800, fontStyle: 'italic',
                        background: lang === l ? NEON : 'rgba(255,255,255,0.08)',
                        color: lang === l ? '#000' : 'rgba(255,255,255,0.45)',
                        border: 0, borderRadius: 0, cursor: 'pointer',
                        fontFamily: inter, letterSpacing: '0.05em',
                      }}
                    >
                      {l.toUpperCase()}
                    </motion.button>
                  ))}
                </div>
                <motion.div
                  aria-hidden
                  style={{
                    position: 'absolute', bottom: -10, right: -10,
                    width: 28, height: 28, background: `${NEON}22`,
                    transform: 'rotate(45deg)',
                  }}
                  animate={{ rotate: [45, 90, 45] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>

              {/* Socials column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ background: 'rgba(0,255,136,0.08)' }}
                  onClick={() => { haptic('light'); openTelegramUrl(siteLinks.channelUrl, CONFIG.channelUsername) }}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)',
                    border: 0, padding: 12, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ fontFamily: mono, fontSize: 8.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>Telegram</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                      {lang === 'ru' ? 'КАНАЛ' : 'CHANNEL'}
                    </div>
                  </div>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ background: 'rgba(0,255,136,0.08)' }}
                  onClick={() => { haptic('light'); openTelegramUrl(siteLinks.reviewsUrl || siteLinks.channelUrl, CONFIG.channelUsername) }}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)',
                    border: 0, padding: 12, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ fontFamily: mono, fontSize: 8.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>Feedback</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                      {lang === 'ru' ? 'ОТЗЫВЫ' : 'REVIEWS'}
                    </div>
                  </div>
                </motion.button>
              </div>
            </motion.div>

            {/* === MAIN DIAGONAL CTA: НАШ ЧАТ === */}
            <motion.button
              variants={fadeUp}
              whileTap={{ scale: 0.985 }}
              whileHover={{ borderColor: 'rgba(0,255,136,0.38)', backgroundColor: 'rgba(0,255,136,0.08)' }}
              onClick={() => { haptic('medium'); openTelegramUrl(siteLinks.chatUrl || siteLinks.communityUrl, CONFIG.communityUsername) }}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)', color: '#fff',
                padding: '18px 18px', position: 'relative', overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.11)', cursor: 'pointer', textAlign: 'left',
                clipPath: 'none',
                marginBottom: 36,
                boxShadow: '0 18px 44px -26px rgba(0,0,0,0.85)',
                fontFamily: inter,
                backdropFilter: 'blur(14px)',
              }}
            >
              <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: NEON, boxShadow: `0 0 16px ${NEON}77` }} />
              {/* Ghost label */}
              <div aria-hidden style={{
                position: 'absolute', right: -12, bottom: -34,
                fontSize: 110, fontWeight: 900, fontStyle: 'italic',
                color: 'rgba(255,255,255,0.025)', lineHeight: 1, letterSpacing: '-0.06em',
                userSelect: 'none', pointerEvents: 'none', fontFamily: inter,
              }}>
                CHAT
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: NEON, marginBottom: 4 }}>
                    {lang === 'ru' ? 'New · Сообщество' : 'New · Community'}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.03em', lineHeight: 0.95, textTransform: 'uppercase' }}>
                    {lang === 'ru' ? 'НАШ ЧАТ' : 'OUR CHAT'}
                  </div>
                </div>
                <motion.div
                  style={{
                    width: 44, height: 44, flexShrink: 0,
                    border: '1px solid rgba(0,255,136,0.28)', color: NEON,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,255,136,0.08)',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </motion.div>
              </div>
            </motion.button>

            {/* === DOCS LIST with outline italic numbers === */}
            <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{ height: 2, flex: 1, background: `linear-gradient(90deg, ${NEON}, transparent)` }} />
                <h2 style={{
                  fontFamily: mono, fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.3em',
                  color: NEON, margin: 0,
                }}>
                  {lang === 'ru' ? 'Документация' : 'Documentation'}
                </h2>
              </div>

              <motion.div
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
                initial="hidden"
                animate="show"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                {links.map((item, i) => (
                  <motion.button
                    key={item.key}
                    variants={{
                      hidden: { opacity: 0, x: -20, filter: 'blur(6px)' },
                      show: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
                    }}
                    whileTap={{ scale: 0.985 }}
                    whileHover={{ background: 'rgba(0,255,136,0.06)', x: 4 }}
                    onClick={() => { haptic('light'); setOpenSheet(item.key) }}
                    className="settings-doc-row"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 12px', background: 'transparent', cursor: 'pointer',
                      border: 0, borderBottom: '1px solid rgba(255,255,255,0.06)',
                      textAlign: 'left', position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                      <span
                        className="settings-doc-num"
                        style={{
                          fontSize: 30, fontWeight: 900, fontStyle: 'italic',
                          letterSpacing: '-0.04em', lineHeight: 1, fontFamily: inter,
                          color: 'transparent',
                          WebkitTextStroke: `1px ${NEON}88`,
                          minWidth: 38,
                          transition: 'color 280ms, -webkit-text-stroke-color 280ms, text-shadow 280ms',
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{
                        fontSize: 16, fontWeight: 900, fontStyle: 'italic',
                        letterSpacing: '-0.015em', color: '#fff', fontFamily: inter,
                        textTransform: 'uppercase',
                      }}>
                        {item.label}
                      </span>
                    </div>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      border: `1px solid ${NEON}55`, background: 'transparent',
                      transition: 'all 300ms',
                    }} />
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>

            {/* === FOOTER METADATA === */}
            <motion.div variants={fadeUp} style={{
              marginTop: 24, padding: '16px 14px',
              background: `${NEON}0D`,
              borderLeft: `2px solid ${NEON}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <motion.div
                    style={{ width: 6, height: 6, borderRadius: '50%', background: NEON, boxShadow: `0 0 8px ${NEON}` }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <span style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.2em', color: NEON, fontWeight: 700 }}>
                    {lang === 'ru' ? 'Шифрование активно' : 'Encryption active'}
                  </span>
                </div>
                <span style={{ fontFamily: mono, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.3)' }}>
                  {lang === 'ru' ? 'Защита маркета · SECURE_256' : 'Market security · SECURE_256'}
                </span>
              </div>
              <div style={{
                fontSize: 32, fontWeight: 900, fontStyle: 'italic',
                color: 'rgba(255,255,255,0.12)', letterSpacing: '-0.04em',
                userSelect: 'none', fontFamily: inter, lineHeight: 1,
              }}>
                2.0.0
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* hover-fill style for outlined doc numbers */}
        <style>{`
          .settings-doc-row:hover .settings-doc-num {
            color: ${NEON} !important;
            -webkit-text-stroke-color: ${NEON} !important;
            text-shadow: 0 0 18px ${NEON}88;
          }
        `}</style>
      </PageTransition>

      <AnimatePresence>
        {openSheet && (
          <ContentSheet
            key={openSheet}
            title={links.find((l) => l.key === openSheet)!.label}
            contentKey={openSheet}
            onClose={() => setOpenSheet(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

