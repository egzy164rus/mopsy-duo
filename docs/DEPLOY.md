# Публикация «Мопсика вдвоём» в Telegram

Пошаговый путь от локальной папки до работающего Mini App.
Всё, что нужно от кода, уже сделано — остаётся хостинг и бот.

```
1. Выложить сервер на HTTPS-домен        ~10 минут
2. Создать бота и Mini App у BotFather   ~5 минут
3. Прописать переменные окружения        2 минуты
4. Проверить в Telegram                  3 минуты
```

> 🙋 Если вы никогда не выкладывали проекты в интернет — начните с простой версии
> этой инструкции: **`docs/ПУБЛИКАЦИЯ.md`** (те же шаги, но «для чайника», без команд).
> Здесь — техническая версия со всеми деталями.

---

## Шаг 0. Что понадобится

| Что | Зачем |
| --- | --- |
| Node.js 18+ на сервере | в проекте нет зависимостей, только `node server/index.js` |
| HTTPS-домен с валидным сертификатом | Telegram открывает Mini App только по `https://` |
| Аккаунт Telegram | для [@BotFather](https://t.me/BotFather) |
| 5 минут | на настройку бота |

Готовые ассеты для BotFather лежат в репозитории:

| Файл | Куда |
| --- | --- |
| `docs/telegram/bot-avatar-512.png` | аватар бота (`/setuserpic`) |
| `docs/telegram/miniapp-banner-640x360.png` | картинка Mini App при создании в `/newapp` |

---

## Шаг 1. Хостинг

Нужен публичный HTTPS-адрес. Три рабочих варианта — выбирайте один.

### Вариант А. VPS + nginx + Let's Encrypt (полный контроль, ~10 мин)

```bash
# на сервере (Ubuntu/Debian)
sudo apt update && sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www && cd /var/www
git clone <ваш-репозиторий> mopsy && cd mopsy
```

Сервис `/etc/systemd/system/mopsy.service`:

```ini
[Unit]
Description=Mopsy Duo (Telegram Mini App)
After=network.target

[Service]
WorkingDirectory=/var/www/mopsy
Environment=PORT=3000
Environment=DEMO_MODE=0
Environment=TELEGRAM_BOT_USERNAME=my_mopsy_bot
Environment=TELEGRAM_APP_SHORT_NAME=mopsy
Environment=TELEGRAM_BOT_TOKEN=123456:AA...
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now mopsy
```

Nginx `/etc/nginx/sites-available/mopsy`:

```nginx
server {
    listen 80;
    server_name mopsy.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # ВАЖНО для realtime (SSE): без этого события будут «залипать»
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        chunked_transfer_encoding on;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mopsy /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d mopsy.example.com      # HTTPS за 30 секунд
```

Проверка:

```bash
curl https://mopsy.example.com/api/health
# {"ok":true,"uptime":5,"realtime":{"pets":0,"connections":0}}
```

### Вариант Б. Render / Railway / Fly.io (без своего сервера, ~5 мин)

* Репозиторий → **Build command:** `npm install` (зависимостей нет, пройдёт мгновенно)
* **Start command:** `npm start`
* **Переменные окружения:** как в примере выше (`DEMO_MODE`, `TELEGRAM_*`)
* **Persistent disk:** обязательно примонтируйте диск на `/app/data`
  (или сразу переходите на PostgreSQL — см. `docs/BACKEND.md`).
  Без диска `data/db.json` обнулится при следующем деплое.

Важно: бесплатные тарифы «засыпают» — первый заход будет медленным,
а ночные напоминания не сработают. Для реальной аудитории нужен платный инстанс.

### Вариант В. Docker на любом сервере

```bash
docker build -t mopsy .
docker run -d --name mopsy --restart=always \
  -p 3000:3000 \
  -v /srv/mopsy-data:/app/data \
  -e DEMO_MODE=0 \
  -e TELEGRAM_BOT_USERNAME=my_mopsy_bot \
  -e TELEGRAM_APP_SHORT_NAME=mopsy \
  -e TELEGRAM_BOT_TOKEN=123456:AA... \
  mopsy
```

Дальше — тот же nginx + certbot перед контейнером (порт 3000 → 443).

> ⚠️ **Проверьте до похода в BotFather:** `https://ваш-домен/api/health` открывается
> по HTTPS без предупреждений сертификата, и `/` показывает экран входа.

---

## Шаг 2. Бот и Mini App у BotFather

### 2.1 Создать бота

1. Откройте [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Имя: `Мопсик вдвоём`, username: например `mopsy_duo_bot` (должен заканчиваться на `bot`).
3. BotFather выдаст токен вида `7123456789:AAH...` — это `TELEGRAM_BOT_TOKEN`.

```bash
# аватар бота
/setuserpic → выбрать бота → отправить docs/telegram/bot-avatar-512.png
/setdescription → «Заботьтесь о мопсе вдвоём: кормите, гуляйте, играйте»
/setabouttext  → «Добрый тамагочи для двоих 🐶»
```

### 2.2 Создать Mini App

1. `/newapp` → выбрать бота.
2. **Title:** `Мопсик вдвоём`
3. **Description:** `Тамагочи для двоих — заботьтесь об общем мопсе вместе`
4. **Photo:** `docs/telegram/miniapp-banner-640x360.png` (640×360)
5. **Demo GIF:** можно пропустить или записать 5-секундную запись экрана.
6. **Web App URL:** `https://mopsy.example.com/`
7. **Short name:** `mopsy` — именно он попадёт в ссылки `t.me/mopsy_duo_bot/mopsy`.

### 2.3 Включить кнопку меню

`/mybots` → ваш бот → **Bot Settings → Menu Button → Configure menu button** →
URL `https://mopsy.example.com/`, текст `🐶 Играть`.

Теперь у бота в чате будет постоянная кнопка, открывающая игру.

---

## Шаг 3. Переменные окружения

```ini
PORT=3000
HOST=0.0.0.0

# секрет из BotFather — включает строгую проверку подписи initData
TELEGRAM_BOT_TOKEN=7123456789:AAH...

# нужны, чтобы приглашения превращались в красивые deep links
TELEGRAM_BOT_USERNAME=mopsy_duo_bot
TELEGRAM_APP_SHORT_NAME=mopsy

# 0 — выключает кнопки «Аня»/«Илья» на экране входа (для продакшена так и надо)
DEMO_MODE=0

# путь к базе MVP (не нужен при переходе на PostgreSQL)
# DB_FILE=/var/lib/mopsy/db.json
```

Как применить: `sudo systemctl restart mopsy` (VPS) или «Redeploy» (PaaS).

---

## Шаг 4. Проверка в Telegram

Откройте бота → кнопка «🐶 Играть». Ожидаемое поведение:

| Проверка | Как убедиться |
| --- | --- |
| Авторизация без пароля | сразу открывается комната с мопсом, в профиле ваш аватар и имя из Telegram |
| Подпись `initData` валидна | в ответе `POST /api/auth/telegram` поле `trusted: true` (видно в DevTools) |
| Realtime работает | откройте игру со второго аккаунта по коду приглашения — действия появляются у обоих мгновенно |
| Приглашение по ссылке | «Пригласить» → ссылка `t.me/mopsy_duo_bot/mopsy?startapp=invite_XXXXXX` → у друга сразу открывается ваша игра с предложением присоединиться |
| Вибрация | нажатия на действия дают лёгкий отклик на телефоне |
| Безопасные зоны | верхняя панель Telegram не перекрывает имя мопса и монеты |
| Звук | включается/выключается переключателем в профиле, состояние сохраняется |

Полезные ссылки для ручной проверки:

```
https://t.me/mopsy_duo_bot/mopsy                     — обычный запуск
https://t.me/mopsy_duo_bot/mopsy?startapp=invite_BUBLIK — приглашение (демо-код)
https://t.me/mopsy_duo_bot?startapp=invite_ABC123    — вариант без short name
```

---

## Шаг 5. Что проверить перед «релизом»

- [ ] `DEMO_MODE=0` — иначе любой желающий зайдёт под демо-аккаунтом с паролем `demo1234`
- [ ] в базе нет остатков демо-данных: `npm run purge-demo` (сервер при старте с `DEMO_MODE=0` сам предупредит, если они есть)
- [ ] `TELEGRAM_BOT_TOKEN` задан (иначе сервер доверяет любым `initData`)
- [ ] `data/` на постоянном диске, либо база перенесена в PostgreSQL (`sql/schema.sql`)
- [ ] `proxy_buffering off` в nginx — иначе partner-действия приходят с задержкой
- [ ] HTTPS-сертификат обновляется (`certbot renew --dry-run`)
- [ ] Сделан бэкап `data/db.json` (cron + `cp` в отдельную папку) — или настроен `pg_dump`
- [ ] Проверено на iPhone (Safari) и Android (Chrome внутри Telegram) в узком окне 360 px
- [ ] Кнопка «назад» на Android не выкидывает из игры на первом экране (у нас один экран — проблемы нет)
- [ ] Тексты без опечаток, ссылки в профиле кликабельны

---

## Частые проблемы

| Симптом | Причина и решение |
| --- | --- |
| «Bot domain invalid» / Mini App не открывается | URL не HTTPS или домен не тот, что в BotFather — исправьте `/mybots → Bot Settings → Menu Button` |
| Игра открылась, но демо-экран входа вместо Telegram-профиля | `telegram-web-app.js` не загрузился (CSP/блокировка CDN) или открыли в обычном браузере. Проверьте подключение SDK в `public/index.html` |
| `401 Подпись Telegram не совпала` | `TELEGRAM_BOT_TOKEN` от другого бота, либо между сервером и Telegram разные часы (проверьте NTP) |
| `401 Данные Telegram устарели` | клиент прислал `initData` старше 24 часов — обновите страницу внутри Telegram |
| Действия партнёра приходят с паузой 10–30 с | в nginx включён буфер: `proxy_buffering off; proxy_read_timeout 3600s;` |
| После деплоя потерялись питомцы | `data/db.json` на эфемерном диске — смонтируйте volume или перейдите на PostgreSQL |
| Ссылка-приглашение открывает бота, но не игру | не задан `TELEGRAM_APP_SHORT_NAME` (нужен для формата `t.me/bot/app`) |
| В логах `EADDRINUSE` | занят порт: `PORT=8080 npm start` или остановите старый процесс |
| Telegram-кэш показывает старую версию | откройте «Настройки → Данные и память → Очистить кэш», либо смените URL на `?v=2` |

---

## Что дальше (после публикации)

1. **Бэкапы:** `pg_dump` или `cp data/db.json`, например cron-задачей каждые 6 часов.
2. **Уведомления в чат:** cron + `sendMessage` по таблице `notifications` (пример кода в `docs/TELEGRAM.md`).
3. **Мониторинг:** `/api/health` отдаёт `realtime.connections` — удобно для внешнего аптайм-бота.
4. **Масштабирование:** замените файловую базу на PostgreSQL (`docs/BACKEND.md`) и вынесите SSE-хаб
   в отдельный процесс/pub-sub; схема БД уже готова.
5. **Аналитика:** подключите собственный счётчик на `bootstrap` — без сторонних SDK внутри Mini App.
6. **Монетизация:** косметика за Telegram Stars — см. раздел «Планы развития» в `docs/BACKEND.md`.

---

## Краткая шпаргалка

```bash
# локально
cd mopsy && npm start                  # http://localhost:3000

# боевой запуск на сервере
sudo systemctl restart mopsy && sudo journalctl -u mopsy -f

# проверка здоровья
curl -s https://mopsy.example.com/api/health

# бэкап файловой базы
cp data/db.json "backups/db-$(date +%F-%H%M).json"
```
