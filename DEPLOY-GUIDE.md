# Гайд по запуску Fanvue Shop на Windows-дедике

Пошагово, для тех кто делает это впервые.

---

## Что тебе понадобится

- Windows-дедик (VPS/VDS) с доступом по RDP
- Домен (купи на namecheap.com, подойдёт любой .com/.shop за $2-10/год)
- Telegram-бот (создаётся за 1 минуту через @BotFather)

---

## Часть 1. Подготовка (на своём компе)

### 1.1. Создай Telegram-бота

1. Открой Telegram, найди бота **@BotFather**
2. Напиши ему `/newbot`
3. Придумай имя бота (например: `Fanvue Notify`)
4. Придумай username (например: `FanvueNotifyBot`)
5. BotFather даст тебе **токен** — длинная строка вида:
   ```
   7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. **Сохрани этот токен** — он нужен для .env

### 1.2. Узнай свой Telegram ID

1. Найди в Telegram бота **@userinfobot**
2. Напиши ему `/start`
3. Он ответит твой **ID** — число вида `123456789`
4. **Сохрани этот ID** — это ADMIN_CHAT_ID

### 1.3. Залей проект на GitHub

1. Зайди на https://github.com → зелёная кнопка **New** (новый репозиторий)
2. Имя: `fanvue-shop` (или любое другое)
3. **Private** (приватный!) — чтобы код не был публичным
4. Нажми **Create repository**
5. GitHub покажет команды. Открой терминал в папке проекта и выполни:

```bash
git add -A
git commit -m "initial"
git branch -M main
git remote add origin https://github.com/ТВОЙ_ЛОГИН/fanvue-shop.git
git push -u origin main
```

Если спросит логин/пароль — используй GitHub Personal Access Token:
- GitHub → Settings → Developer settings → Personal access tokens → Generate new token
- Дай права `repo`, скопируй токен, вставь вместо пароля

---

## Часть 2. Настройка домена

### 2.1. Купи домен

1. Зайди на https://www.namecheap.com
2. Найди домен (например `fanvue-shop.com`)
3. Купи (от $2/год)

### 2.2. Привяжи домен к серверу

1. В Namecheap: **Domain List** → нажми на свой домен → **Advanced DNS**
2. Удали все существующие записи (если есть)
3. Добавь новую запись:
   - Type: **A Record**
   - Host: **@**
   - Value: **IP твоего дедика** (например 180.91.123.46)
   - TTL: **Automatic**
4. Нажми сохранить
5. Подожди 5-15 минут

---

## Часть 3. Настройка дедика (Windows)

Подключись к дедику через RDP (Удалённый рабочий стол).

### 3.1. Установи программы

Открой браузер на дедике и скачай:

**Node.js:**
1. Зайди на https://nodejs.org
2. Скачай **LTS** версию (зелёная кнопка)
3. Запусти установщик, жми Next-Next-Next
4. ВАЖНО: на шаге "Tools for Native Modules" поставь галочку!

**Git:**
1. Зайди на https://git-scm.com/download/win
2. Скачай, установи (всё по умолчанию, жми Next)

**Caddy:**
1. Зайди на https://caddyserver.com/download
2. Platform: **Windows amd64**
3. Нажми **Download**
4. Переименуй скачанный файл в `caddy.exe`
5. Создай папку `C:\caddy` и положи туда `caddy.exe`

### 3.2. Скачай проект

Открой **PowerShell** (найди в меню Пуск, запусти **от администратора**):

```powershell
cd C:\
git clone https://github.com/ТВОЙ_ЛОГИН/fanvue-shop.git app
cd C:\app
```

Если репо приватный — Git спросит логин и токен (тот же Personal Access Token).

### 3.3. Установи зависимости

```powershell
cd C:\app
npm install
```

Подожди пока всё скачается (1-3 минуты).

### 3.4. Создай файл .env

```powershell
copy .env.example .env
notepad .env
```

Откроется блокнот. Заполни эти строки (остальное оставь как есть):

```
BOT_TOKEN=7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ADMIN_CHAT_ID=123456789
ADMIN_HASHES=71ff3087360063a84423e4bf06ad77cf050af2f1c0dda5d7f81bb7f07fd7e2bf

VITE_ADDR_TRC20=твой_USDT_TRC20_адрес_кошелька
```

Впиши свои реальные значения! Адреса кошельков — только те сети, которые принимаешь.

Сохрани файл (Ctrl+S), закрой блокнот.

### 3.5. Собери проект

```powershell
cd C:\app
npm run build
npm run server:build
```

Каждая команда займёт несколько секунд. Ошибок быть не должно.

### 3.6. Проверь что работает

```powershell
npm run server
```

Должно появиться:
```
Server running on http://localhost:3000
Serving SPA from C:\app\dist
[poller] Starting blockchain poller (interval: 20000ms)
```

Открой браузер на дедике: http://localhost:3000 — должен открыться магазин.

Нажми **Ctrl+C** чтобы остановить сервер (мы его запустим правильно на следующем шаге).

---

## Часть 4. Запуск 24/7

### 4.1. Установи PM2 (менеджер процессов)

```powershell
npm install -g pm2
```

### 4.2. Запусти сервер через PM2

```powershell
cd C:\app
pm2 start server\dist\index.js --name fanvue
```

Проверь что работает:
```powershell
pm2 status
```

Должен показать `fanvue` со статусом `online`.

### 4.3. Открой порты в файрволе

```powershell
netsh advfirewall firewall add rule name="HTTP" dir=in action=allow protocol=tcp localport=80
netsh advfirewall firewall add rule name="HTTPS" dir=in action=allow protocol=tcp localport=443
```

### 4.4. Настрой Caddyfile

```powershell
notepad C:\app\Caddyfile
```

Замени `YOUR_DOMAIN` на свой домен:
```
fanvue-shop.com {
    reverse_proxy localhost:3000
}
```

Сохрани, закрой.

### 4.5. Запусти Caddy

```powershell
C:\caddy\caddy.exe start --config C:\app\Caddyfile
```

Caddy сам получит SSL-сертификат. Через 10-30 секунд сайт будет доступен по:
```
https://fanvue-shop.com
```

### 4.6. Сделай автозапуск (чтобы после перезагрузки всё само поднялось)

Caddy как служба:
```powershell
C:\caddy\caddy.exe install --config C:\app\Caddyfile
net start caddy
```

PM2 автозапуск:
```powershell
pm2 save
pm2 startup
```

---

## Часть 5. Подключи бота к Telegram

1. Открой **@BotFather** в Telegram
2. Напиши `/mybots`
3. Выбери своего бота
4. **Bot Settings** → **Menu Button** → **Configure menu button**
5. Отправь URL: `https://fanvue-shop.com` (твой домен)
6. Отправь текст кнопки: `Открыть магазин`

Теперь при нажатии кнопки "Открыть магазин" в боте — откроется твой мини-апп.

---

## Как обновлять

Когда изменишь код на своём компе:

**На своём компе:**
```bash
git add -A
git commit -m "описание изменений"
git push
```

**На дедике (PowerShell):**
```powershell
cd C:\app
git pull
npm install
npm run build
npm run server:build
pm2 restart fanvue
```

Всё, обновление применено.

---

## Проверка что всё работает

- Сайт открывается по https://твой-домен.com ✓
- Открывается через кнопку в Telegram-боте ✓
- При создании депозита — QR-код и адрес кошелька ✓
- В консоли PM2 (`pm2 logs fanvue`) видны логи поллера ✓
- При оплате на кошелёк — уведомление в Telegram ✓

---

## Если что-то не работает

Смотри логи:
```powershell
pm2 logs fanvue
```

Перезапуск:
```powershell
pm2 restart fanvue
```

Проверить статус:
```powershell
pm2 status
```
