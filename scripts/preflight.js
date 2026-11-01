#!/usr/bin/env node
/**
 * preflight.js — «проверка перед публикацией».
 * Запуск:  npm run check
 *
 * Скрипт ничего не меняет и не ломает: просто смотрит настройки и по-человечески
 * объясняет, что уже хорошо, а что нужно поправить перед публикацией в Telegram.
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

const ok = (text) => console.log(`  ✅ ${text}`);
const warn = (text, hint) => console.log(`  ⚠️  ${text}${hint ? `\n      → ${hint}` : ''}`);
const bad = (text, hint) => console.log(`  ❌ ${text}${hint ? `\n      → ${hint}` : ''}`);

console.log('\n🐶  Проверка готовности «Мопсика вдвоём» к публикации\n');

let problems = 0;
let warnings = 0;

/* ---------------------------------------------------------------- 1. Node */
const major = Number(process.versions.node.split('.')[0]);
if (major >= 18) ok(`Node.js ${process.versions.node} — подходит`);
else {
  bad(`Node.js ${process.versions.node} слишком старый`, 'Нужен Node.js 18 или новее: https://nodejs.org');
  problems += 1;
}

/* ------------------------------------------------------------ 2. Файлы и база */
const root = process.cwd();
if (fs.existsSync(path.join(root, 'server/index.js')) && fs.existsSync(path.join(root, 'public/index.html'))) {
  ok('файлы игры на месте (server/ и public/)');
} else {
  bad('запущено не из папки проекта', 'Откройте терминал в папке mopsy и повторите: npm run check');
  problems += 1;
}

const dataDir = path.resolve(root, 'data');
try {
  fs.mkdirSync(dataDir, { recursive: true });
  const probe = path.join(dataDir, '.write-test');
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
  ok(`папка данных доступна для записи: ${dataDir}`);
} catch (err) {
  bad(`нет прав на запись в ${dataDir}`, `Проверьте права или задайте DB_FILE на доступный путь. (${err.message})`);
  problems += 1;
}

const dbFile = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(dataDir, 'db.json');
if (fs.existsSync(dbFile)) {
  const size = fs.statSync(dbFile).size;
  ok(`база найдена: ${path.relative(root, dbFile)} (${Math.round(size / 1024)} КБ)`);
} else {
  warn('база ещё не создана — она появится при первом запуске сервера с демо-данными');
  warnings += 1;
}

/* --------------------------------------------- 2b. демо-аккаунты в базе */
let demoUsersInDb = 0;
if (fs.existsSync(dbFile)) {
  try {
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    demoUsersInDb = (db.users || []).filter((u) => u.username === 'anya' || u.username === 'ilya').length;
  } catch {
    warn('база есть, но прочитать её не получилось (возможно, файл повреждён)', 'Сделайте копию data/db.json и запустите npm run reset');
    warnings += 1;
  }
}

/* -------------------------------------------------------- 3. Порт и занятость */
const port = Number(process.env.PORT || 3000);
const portFree = await new Promise((resolve) => {
  const srv = net.createServer();
  srv.once('error', (err) => resolve(err.code !== 'EADDRINUSE'));
  srv.once('listening', () => srv.close(() => resolve(true)));
  srv.listen(port, '0.0.0.0');
});
if (portFree) {
  ok(`порт ${port} свободен — сервер запустится без конфликтов`);
} else {
  warn(
    `порт ${port} уже занят (скорее всего, игра уже запущена)`,
    'Если это ваш работающий сервер — всё в порядке. Иначе запустите на другом порту: PORT=3001 npm start',
  );
  warnings += 1;
}

/* ------------------------------------------------------- 4. Telegram-настройки */
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const botUser = process.env.TELEGRAM_BOT_USERNAME || '';
const appName = process.env.TELEGRAM_APP_SHORT_NAME || '';
const demoMode = (process.env.DEMO_MODE || '1') !== '0';

if (!token) {
  warn(
    'TELEGRAM_BOT_TOKEN не задан — сервер работает в «режиме доверия»',
    'Для разработки это нормально. Для публикации обязательно добавьте токен из @BotFather, иначе любой сможет подделать вход.',
  );
  warnings += 1;
} else if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token)) {
  bad('TELEGRAM_BOT_TOKEN выглядит неправильно', 'Токен имеет вид 7123456789:AAH... — скопируйте его целиком из BotFather');
  problems += 1;
} else {
  ok('TELEGRAM_BOT_TOKEN задан — подпись Telegram будет проверяться по-настоящему');
}

if (!botUser) {
  warn(
    'TELEGRAM_BOT_USERNAME не задан — приглашения будут обычными ссылками на сайт',
    'Добавьте юзернейм бота (например mopsy_duo_bot), чтобы ссылки стали вида https://t.me/…?startapp=invite_XXX',
  );
  warnings += 1;
} else ok(`ссылки-приглашения пойдут через бота: https://t.me/${botUser}`);

if (botUser && !appName) {
  warn(
    'TELEGRAM_APP_SHORT_NAME не задан — будет короткая ссылка t.me/бот?startapp=… ',
    'Она работает, если Mini App подключён кнопкой меню. Short name (например mopsy) даёт ссылку вида t.me/бот/mopsy?startapp=…',
  );
  warnings += 1;
} else if (appName) ok(`короткое имя Mini App: ${appName}`);

if (demoMode) {
  warn(
    'DEMO_MODE включён — на экране входа есть кнопки «Аня» и «Илья» с известным паролем',
    'Перед показом людям поставьте DEMO_MODE=0',
  );
  warnings += 1;
} else ok('демо-аккаунты отключены (DEMO_MODE=0)');

if (!demoMode && demoUsersInDb > 0) {
  bad(
    `в базе остались демо-аккаунты anya/ilya с паролем demo1234 (${demoUsersInDb} шт.)`,
    'Их можно удалить одной командой: npm run purge-demo (или npm run reset, если своих игроков ещё нет)',
  );
  problems += 1;
} else if (demoUsersInDb > 0) {
  ok(`в базе есть демо-аккаунты (${demoUsersInDb}) — для тестов удобно, перед публикацией уберите`);
}

/* ----------------------------------------------------------------- 5. Итог */
console.log('');
if (problems > 0) {
  console.log(`  Итог: ${problems} ${plural(problems, 'критичная проблема', 'критичные проблемы', 'критичных проблем')} и ${warnings} ${plural(warnings, 'предупреждение', 'предупреждения', 'предупреждений')}.`);
  console.log('  Пока их не исправите — публиковать рано. Подробная инструкция: docs/ПУБЛИКАЦИЯ.md (для новичков) или docs/DEPLOY.md (технически подробно)\n');
  process.exit(1);
}
if (warnings > 0) {
  console.log(`  Итог: критичных проблем нет, но есть ${warnings} ${plural(warnings, 'предупреждение', 'предупреждения', 'предупреждений')} — прочитайте подсказки выше.`);
  console.log('  Для локальной игры всё в порядке. Для публикации: docs/ПУБЛИКАЦИЯ.md (для новичков) или docs/DEPLOY.md (технически подробно)\n');
  process.exit(0);
}
console.log('  Итог: всё готово 🎉  Осталось выложить на HTTPS-домен и создать Mini App у @BotFather.');
console.log('  Пошаговая инструкция: docs/ПУБЛИКАЦИЯ.md (для новичков) или docs/DEPLOY.md (технически подробно)\n');
