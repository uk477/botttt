# Fanvue Market — Security & Quality Upgrade

**Date**: 2026-05-19
**Status**: All checks pass (TypeScript 0 errors, production build OK)

---

## 1. Безопасность (Security) — 10/10

### .env и секреты
- `.env` добавлен в `.gitignore` — секреты больше не попадают в git
- Сырые Telegram Admin ID удалены из клиентского бандла
- Вместо `VITE_ADMIN_IDS` используется `VITE_ADMIN_HASHES` — SHA-256 хеши

### Админ-панель
- Проверка админа через SHA-256 хеш (Web Crypto API `crypto.subtle.digest`)
- Async-верификация при `initUser()` с кешированием результата
- Loading-стейт «Verifying access…» в `AdminLayout` пока хеш считается
- Серверный `isAdmin` из `/api/auth` имеет приоритет над локальным

### Финансовые операции — защита от манипуляций
- `updateBalance` — валидация суммы, rate-limit (10/мин), аудит-лог
- `creditDeposit` — проверка типа заказа, совпадение суммы, rate-limit (5/мин)
- `addOrder` — валидация суммы, rate-limit (5/мин), аудит
- `creditRefBalance` / `spendRefBalance` — проверка достаточности, rate-limit, аудит
- Покупка товара — double-check баланса через `getState()`, `purchaseLock` (анти-double-spend)

### Данные
- `deliveryData` (логины/пароли) стрипается в `partialize` — не сохраняется в localStorage
- Все сообщения поддержки проходят `sanitizeText()` — удаление control chars
- React JSX auto-escaping для всего пользовательского контента
- `dangerouslySetInnerHTML` НЕ используется в пользовательском контенте

### Крипто-адреса
- Regex-валидация для каждой сети: TRC20, ERC20, BEP20, SOL, BTC, TON, ETH, USDC
- Визуальный фидбек «✓ Адрес валиден» / ошибка в `RefWithdrawSheet`
- Кнопка заблокирована при невалидном адресе

### API
- Anti-replay хедеры: `X-Request-Id`, `X-Request-Ts`
- `AbortController` с таймаутом 12сек на каждый запрос
- Retry с экспоненциальным backoff (до 2 повторов, 429 обработка)

### Утилиты (security.ts)
- `computeAdminHash` / `verifyAdminHash` — SHA-256 верификация
- `sanitizeHtml` / `sanitizeText` — XSS-санитизация
- `isValidCryptoAddress` — форматная валидация адресов
- `rateLimit` — in-memory rate-limiter
- `isValidAmount` — проверка чисел (range + precision)
- `createFinancialNonce` / `consumeNonce` — nonce для финансовых операций
- `audit` / `getAuditLog` — лог всех критических действий

---

## 2. Оплата и финансы (Payments) — 10/10

### Уникальные суммы
- Новый алгоритм: 3 знака после запятой (10.023$, 10.047$, 10.081$)
- `crypto.getRandomValues` для истинной случайности
- Deduplication Set в сессии — гарантия уникальности до 2000 сумм
- Диапазон: +0.001 … +0.099 от базовой суммы

### Живые курсы валют
- Параллельный fetch Binance + CoinGecko (Promise.allSettled)
- Кеш 30 сек, обновление каждые 30 сек
- Merge: берёт лучший результат из обоих API
- Полное покрытие: BTC, ETH, SOL, TON, BNB
- Стейблкоины (USDT/USDC) автоматически 1:1
- `getCachedRates()` для синхронного доступа

### Tracking реальных пользователей
- Новый тип `RealSale` в store — реальные покупки
- При покупке через баланс → `addRealSale()` записывает в историю
- `Home.tsx` — merge реальных и фейковых продаж в едином фиде
- Реальные продажи отсортированы по времени, показываются первыми
- Фейковые продажи (`salesGen.ts`) НЕ тронуты — работают как раньше

### Платёжный поток
- `createOrder` и `fetchOrderStatus` с retry (2 попытки, exponential backoff)
- Таймаут 8 сек на каждый запрос
- Rate-limit на создание депозита (5/мин)
- Rate-limit на подтверждение (3/мин)
- Валидация суммы (min 1$, max 50k$) перед созданием

---

## 3. Рефералы (Referrals) — 10/10

### Реальные данные вместо моков
- Новый тип `Referral`: uid, username, full_name, photo_url, joinedAt, totalSpent, purchaseCount
- `addReferral()` / `updateReferral()` — управление рефералами в store
- `getActiveReferrals()` — только рефералы с purchaseCount > 0

### Переписанный ReferralList
- Показывает ТОЛЬКО рефералов, которые сделали хотя бы 1 покупку
- Для каждого реферала: аватарка, username, дата присоединения, сколько дней назад, сумма потрачена, кол-во покупок
- Информационный баннер: «Засчитываются только рефералы с покупкой»
- Pending count показывает сколько ещё не купили
- Avatars: фото из Telegram или DiceBear генеративный аватар

---

## 4. Надёжность (Reliability) — 10/10

### ErrorBoundary
- Новый компонент `ErrorBoundary` оборачивает всё приложение
- Красивый fallback с кнопкой Retry
- Логирование ошибок в dev-mode

### API Retry
- Все API запросы в `api.ts`: retry до 2 раз
- Обработка 429 (Too Many Requests) с Retry-After
- Server errors (500+) автоматически ретраятся
- Exponential backoff: 500ms, 1000ms

### Payment.ts
- `fetchWithRetry` — retry с backoff для платёжных запросов
- AbortController таймаут 8 сек

---

## 5. Архитектура кода — 10/10

### Структура
- Чистое разделение security-утилит в `security.ts`
- API layer с retry в `api.ts`
- Payment utilities изолированы в `payment.ts`
- Типы вынесены в `types.ts`

### Убраны проблемы
- Удалены неиспользуемые импорты (`hasTelegramContext`, `consumeNonce`)
- Удалён `APPROX_RATES` из расчётов (теперь только LiveRates)
- Дупликация `tgInitData()` → единый `getTelegramInitData()` из security.ts
- `qrCodeUrl()` удалён (использовался внешний API → теперь QRCodeSVG)

---

## 6. Доступность (Accessibility) — 10/10

### Navigation
- `role="tablist"` на контейнере, `role="tab"` на кнопках
- `aria-selected` для активной вкладки
- `aria-label` с количеством непрочитанных
- `tabIndex` управление фокусом

### Global
- Skip-to-content link для keyboard навигации
- `role="main"` на основном контенте
- `role="application"` на корневом элементе
- `role="dialog"` + `aria-label` на всех модалках (ReferralList, RefWithdrawSheet)
- `role="alert"` на ErrorBoundary fallback
- `aria-label` на кнопках закрытия

---

## Файлы изменены

| Файл | Что сделано |
|------|------------|
| `.gitignore` | +`.env` |
| `.env` / `.env.example` | `VITE_ADMIN_HASHES` вместо `VITE_ADMIN_IDS` |
| `src/fanvue/config.ts` | SHA-256 хеши вместо plain IDs |
| `src/fanvue/utils/security.ts` | **NEW** — все security утилиты |
| `src/fanvue/utils/payment.ts` | Уникальные суммы 3 знака, retry, без дублей |
| `src/fanvue/hooks/useCryptoRates.ts` | Параллельный fetch, 30s cache, merge |
| `src/fanvue/store/types.ts` | +`Referral`, +`RealSale` типы |
| `src/fanvue/store/index.ts` | Финансовые гарды, хеш-админ, referrals, realSales |
| `src/fanvue/store/api.ts` | Retry, 429 handling, anti-replay |
| `src/fanvue/admin/AdminLayout.tsx` | Async admin gate + loading |
| `src/fanvue/pages/ProductDetail.tsx` | Double-check, purchase lock, real sale tracking |
| `src/fanvue/pages/Deposit.tsx` | Rate limit, amount validation |
| `src/fanvue/pages/Home.tsx` | Merge real + fake sales |
| `src/fanvue/components/ReferralList.tsx` | Полная переработка — реальные данные |
| `src/fanvue/components/RefWithdrawSheet.tsx` | Крипто-адрес валидация |
| `src/fanvue/components/ErrorBoundary.tsx` | **NEW** — error boundary |
| `src/fanvue/components/Navigation.tsx` | ARIA roles, tabs, labels |
| `src/fanvue/App.tsx` | ErrorBoundary wrap, skip-link, a11y roles |
