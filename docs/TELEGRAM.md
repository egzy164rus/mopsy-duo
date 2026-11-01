# Публикация как Telegram Mini App

> 🚀 Нужен пошаговый чек-лист «от папки до кнопки в боте» — он в
> [**docs/DEPLOY.md**](DEPLOY.md): хостинг, BotFather, переменные окружения,
> проверка и таблица частых проблем.

## 1. Что уже готово в коде

* SDK подключается в `public/index.html` (`telegram-web-app.js`). В браузере он
  просто не загружается — игра работает как обычный сайт.
* Автоматическая тихая авторизация: если `window.Telegram.WebApp.initData` есть,
  клиент отправляет его на `POST /api/auth/telegram`.
* Проверка подписи на сервере (`server/auth.js → verifyTelegramInitData`):
  HMAC-SHA256 по схеме `WebAppData` + проверка свежести `auth_date`.
* `ready()`, `expand()`, `setHeaderColor`, `setBackgroundColor`, `disableVerticalSwipes`.
* Deep link `?startapp=invite_CODE` — приглашение приходит через `initDataUnsafe.start_param`,
  а ссылки на приглашение автоматически превращаются в `t.me/<bot>/<app>?startapp=…`,
  если заданы `TELEGRAM_BOT_USERNAME` и `TELEGRAM_APP_SHORT_NAME`.
* Тактильная отбратная связь (`HapticFeedback`) и шаринг приглашения (`shareUrl`).
* Учёт `safe-area-inset` — интерфейс не уезжает под системные панели.

## 2. Бот и Mini App

1. Создайте бота у [@BotFather](https://t.me/BotFather): `/newbot` → получите токен.
2. `/newapp` (или `/mybots` → *Bot Settings → Menu Button → Configure menu button*):
   укажите URL `https://ваш-домен/` и заголовок «Мопсик вдвоём».
3. Прокиньте токен в переменную окружения сервера:

```bash
TELEGRAM_BOT_TOKEN=123456:AA...   # .env или панель хостинга
```

Без этой переменной сервер работает в dev-режиме «доверия» (удобно локально),
с ней — любые поддельные `initData` отклоняются с `401`.

4. Deep link на приглашение:

```
https://t.me/<bot_username>/<app_short_name>?startapp=invite_BUBLIK
```

В этом случае Telegram передаст `start_param`; игра уже поддерживает обычный
`?invite=CODE` — можно использовать и прямую ссылку на сайт.

## 3. Обязательные требования Telegram

| Требование | Как выполнено |
| --- | --- |
| HTTPS | нужен домен с TLS (см. README → «Публикация») |
| Мобильная адаптивность | mobile-first, 320–430 px, safe-area |
| Никаких внешних попапов | всё в модалках внутри приложения |
| Быстрая первая отрисовка | один HTML + 2 CSS + ES-модули, шрифт локальный |
| Кнопка «назад» | навигация внизу; при желании можно подключить `BackButton` |
| Тема | фиксированная светлая палитра, `setHeaderColor('#FFF9F2')` |

## 4. Уведомления внутри Telegram

Сейчас напоминания живут внутри приложения (колокольчик + тосты + бейджи).
Чтобы присылать их в чат, добавьте cron-задачу:

```js
// пример: раз в 15 минут
const rows = await db.query(`
  select n.id, n.text, u.telegram_id
  from notifications n
  join pet_owners o on o.pet_id = n.pet_id
  join users u on u.id = o.user_id
  where n.created_at > now() - interval '20 minutes'
    and u.telegram_id is not null
    and not n.sent_to_telegram
`);
for (const r of rows) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: r.telegram_id, text: r.text, disable_notification: false }),
  });
}
```

Важно: Telegram запрещает спам — не чаще 1–2 уведомлений в день на игрока,
напоминания о голоде/грусти уже троттлятся на сервере (2–4 часа).

## 5. Проверка локально

1. `npm start` → откройте `http://localhost:3000`.
2. Для теста Telegram-режима удобнее туннель:
   `npx localtunnel --port 3000` (или ngrok/cloudflared) → полученный HTTPS-URL
   вставьте в BotFather как URL Mini App.
3. Откройте бота, нажмите кнопку меню — игра должна авторизоваться без пароля.
