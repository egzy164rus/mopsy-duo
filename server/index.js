/**
 * index.js — HTTP-сервер «Мопсик вдвоём».
 *
 * Роуты:
 *   POST /api/auth/register | login | telegram | demo | logout
 *   GET  /api/bootstrap
 *   POST /api/pets                — создать мопса
 *   POST /api/pets/join           — присоединиться по коду
 *   GET  /api/pets/:id/stream     — SSE-поток состояния (realtime)
 *   POST /api/pets/:id/action     — действие (кормление, игра, прогулка…)
 *   POST /api/pets/:id/game       — результат мини-игры
 *   POST /api/pets/:id/buy|equip|room
 *   POST /api/pets/:id/task       — забрать награду за задание
 *   POST /api/pets/:id/read       — отметить уведомления прочитанными
 *   GET  /api/health
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load, flush, getDb, save, table, DB_FILE_PATH } from './store.js';
import {
  createSession,
  destroySession,
  resolveSession,
  verifyTelegramInitData,
  upsertTelegramUser,
  createUser,
  verifyPassword,
  httpError,
} from './auth.js';
import {
  ACTIONS,
  STATS,
  CLOTHES,
  ROOMS,
  SLOTS,
  GAMES,
  ACHIEVEMENTS,
  DAILY_REWARDS,
  CATALOG_VERSION,
  PUG_COLORS,
} from './content.js';
import {
  snapshotFor,
  createPet,
  joinPetByCode,
  performAction,
  playGame,
  buyItem,
  equipItem,
  setRoom,
  claimTask,
  markNotificationsRead,
  ensureReminders,
  touchDailyBonus,
  findPet,
  petsOfUser,
  isOwner,
  getStats,
  applyDecay,
  ownersOf,
  findUser,
} from './engine.js';
import { subscribe, broadcast, onlineIds, stats as realtimeStats } from './realtime.js';
import { ensureDemoData } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

/** Публичные данные для клиента (не секреты!). */
const PUBLIC_CONFIG = {
  telegram: {
    bot_username: process.env.TELEGRAM_BOT_USERNAME || null,
    app_short_name: process.env.TELEGRAM_APP_SHORT_NAME || null,
    bot_token_set: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  },
  demo: (process.env.DEMO_MODE || '1') !== '0',
};

load();
// Демо-аккаунты (anya/ilya с известным паролем) создаём только когда демо разрешено.
// В продакшене (DEMO_MODE=0) база стартует пустой — иначе любой желающий мог бы
// войти логином anya / demo1234 в обход скрытых кнопок на экране входа.
if (PUBLIC_CONFIG.demo) {
  ensureDemoData();
} else if (getDb().users.some((u) => u.username === 'anya' || u.username === 'ilya')) {
  console.warn(
    '⚠️  DEMO_MODE=0, но в базе остались демо-аккаунты anya/ilya с паролем demo1234.\n' +
      '    Удалите их командой: npm run purge-demo',
  );
}

/* ----------------------------------------------------------------- helpers */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const json = (res, status, data, headers = {}) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
};

const readBody = (req, limit = 256 * 1024) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(httpError(413, 'Слишком большой запрос'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(httpError(400, 'Ожидался JSON'));
      }
    });
    req.on('error', reject);
  });

const tokenFrom = (req, url) =>
  req.headers.authorization?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || null;

function requireUser(req, url) {
  const user = resolveSession(tokenFrom(req, url));
  if (!user) throw httpError(401, 'Нужно войти в игру');
  user.last_seen_at = Date.now();
  return user;
}

/** Простое ограничение частоты запросов: 60 действий в минуту на игрока. */
const rateBucket = new Map();
function rateLimit(userId, cost = 1, max = 60) {
  const now = Date.now();
  const arr = (rateBucket.get(userId) || []).filter((t) => now - t < 60_000);
  if (arr.length + cost > max) throw httpError(429, 'Слишком много действий подряд. Переведите дух 🙂');
  arr.push(now);
  rateBucket.set(userId, arr);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBucket) {
    const arr = v.filter((t) => now - t < 60_000);
    if (!arr.length) rateBucket.delete(k);
    else rateBucket.set(k, arr);
  }
}, 60_000).unref?.();

function activePetFor(user) {
  const pets = petsOfUser(user.id);
  return pets[0] || null;
}

function petFromRequest(user, petId) {
  const pet = petId ? findPet(petId) : activePetFor(user);
  if (!pet) throw httpError(404, 'Питомец не найден');
  if (!isOwner(pet.id, user.id)) throw httpError(403, 'Нет доступа к этому питомцу');
  return pet;
}

/** Персонализированная рассылка состояния всем, кто сейчас на экране питомца. */
function pushState(petId, { exceptUserId = null } = {}) {
  const pet = findPet(petId);
  if (!pet) return;
  const online = onlineIds(petId);
  broadcast(
    petId,
    'state',
    (userId) => ({ type: 'state', snapshot: snapshotFor(pet, userId, { onlineIds: online }) }),
    { exceptUserId },
  );
}

function pushEvent(petId, event, payloadBuilder, opts) {
  broadcast(petId, event, payloadBuilder, opts);
}

/* ------------------------------------------------------------------ роуты */

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname.replace(/\/+$/, '') || '/'}`;

  if (route === 'GET /api/health') {
    return json(res, 200, { ok: true, uptime: Math.round(process.uptime()), realtime: realtimeStats() });
  }

  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};

  /* --- авторизация --- */
  if (route === 'POST /api/auth/register') {
    const user = createUser({
      username: body.username,
      displayName: body.displayName,
      password: body.password,
      avatar: body.avatar,
    });
    const token = createSession(user.id);
    return json(res, 201, { token, user: publicUser(user), pet: null });
  }

  if (route === 'POST /api/auth/login') {
    const username = String(body.username || '').trim().toLowerCase();
    const user = table.users().find((u) => u.username === username);
    if (!user || !verifyPassword(String(body.password || ''), user.password_salt, user.password_hash)) {
      throw httpError(401, 'Неверный логин или пароль');
    }
    user.last_seen_at = Date.now();
    save();
    const token = createSession(user.id);
    return json(res, 200, { token, user: publicUser(user) });
  }

  if (route === 'POST /api/auth/telegram') {
    const { tgUser, trusted } = verifyTelegramInitData(body.initData);
    const user = upsertTelegramUser(tgUser);
    const token = createSession(user.id);
    return json(res, 200, { token, user: publicUser(user), trusted });
  }

  if (route === 'POST /api/auth/demo') {
    if (!PUBLIC_CONFIG.demo) throw httpError(403, 'Демо-доступ отключён в этом окружении');
    const demo = getDb().users.find((u) => u.username === (body.who === 'ilya' ? 'ilya' : 'anya'));
    if (!demo) throw httpError(503, 'Демо-данные ещё не готовы, попробуйте через минуту');
    demo.last_seen_at = Date.now();
    save();
    const token = createSession(demo.id);
    return json(res, 200, { token, user: publicUser(demo) });
  }

  if (route === 'POST /api/auth/logout') {
    destroySession(tokenFrom(req, url));
    return json(res, 200, { ok: true });
  }

  /* --- всё ниже требует авторизации --- */
  const user = requireUser(req, url);

  if (route === 'GET /api/bootstrap') {
    rateLimit(user.id, 1, 120);
    const pets = petsOfUser(user.id);
    const pet = pets[0] || null;
    const payload = {
      user: publicUser(user),
      config: PUBLIC_CONFIG,
      catalog: catalogPayload(),
      pets: pets.map((p) => ({ id: p.id, name: p.name, color: p.color, level: p.level })),
      snapshot: null,
      dailyBonus: null,
    };
    if (pet) {
      const stats = getStats(pet.id);
      applyDecay(pet, stats);
      payload.dailyBonus = touchDailyBonus(pet, user.id);
      ensureReminders(pet, stats);
      ensureDailyTasksSafe(pet);
      payload.snapshot = snapshotFor(pet, user.id, { onlineIds: onlineIds(pet.id) });
    } else {
      const invite = url.searchParams.get('invite');
      if (invite) payload.pendingInvite = invite;
    }
    return json(res, 200, payload);
  }

  if (route === 'POST /api/pets') {
    rateLimit(user.id);
    const pet = createPet({ userId: user.id, name: body.name, colorId: body.color });
    return json(res, 201, { pet: { id: pet.id }, snapshot: snapshotFor(pet, user.id, { onlineIds: [] }) });
  }

  if (route === 'POST /api/pets/join') {
    rateLimit(user.id);
    const pet = joinPetByCode({ userId: user.id, code: body.code });
    pushState(pet.id);
    return json(res, 200, { pet: { id: pet.id }, snapshot: snapshotFor(pet, user.id, { onlineIds: onlineIds(pet.id) }) });
  }

  /* --- realtime-поток --- */
  const streamMatch = url.pathname.match(/^\/api\/pets\/([^/]+)\/stream$/);
  if (req.method === 'GET' && streamMatch) {
    const pet = petFromRequest(user, streamMatch[1]);
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write('retry: 3000\n\n');

    const online = [...new Set([...onlineIds(pet.id), user.id])];
    const unsubscribe = subscribe(pet.id, user.id, res);
    pushState(pet.id); // всем сообщаем, что состав онлайн обновился
    broadcast(pet.id, 'presence', () => ({ type: 'presence', online }), {});
    req.on('close', () => {
      unsubscribe();
      if (findPet(pet.id)) {
        pushState(pet.id);
        broadcast(pet.id, 'presence', () => ({ type: 'presence', online: onlineIds(pet.id) }), {});
      }
    });
    return;
  }

  const petRoute = url.pathname.match(/^\/api\/pets\/([^/]+)\/(action|game|buy|equip|room|task|read)$/);
  if (req.method === 'POST' && petRoute) {
    const [, petId, kind] = petRoute;
    const pet = petFromRequest(user, petId);
    rateLimit(user.id);

    if (kind === 'action') {
      const result = performAction({
        petId: pet.id,
        userId: user.id,
        type: body.type,
        idempotencyKey: body.idempotencyKey,
      });
      pushEvent(pet.id, 'pulse', () => ({
        type: 'pulse',
        icon: ACTIONS[body.type]?.icon || '✨',
        text: result.action?.text || result.message,
        animation: result.animation,
        at: Date.now(),
      }), { exceptUserId: user.id });
      pushState(pet.id);
      return json(res, 200, {
        ...result,
        snapshot: snapshotFor(pet, user.id, { onlineIds: onlineIds(pet.id) }),
      });
    }

    if (kind === 'game') {
      const result = playGame({
        petId: pet.id,
        userId: user.id,
        game: body.game,
        score: body.score,
        idempotencyKey: body.idempotencyKey,
      });
      pushEvent(pet.id, 'pulse', () => ({ type: 'pulse', icon: '🎮', text: result.action?.text, at: Date.now() }), {
        exceptUserId: user.id,
      });
      pushState(pet.id);
      return json(res, 200, {
        ...result,
        snapshot: snapshotFor(pet, user.id, { onlineIds: onlineIds(pet.id) }),
      });
    }

    if (kind === 'buy') {
      const result = buyItem({ petId: pet.id, userId: user.id, itemId: body.itemId });
      pushState(pet.id);
      return json(res, 200, { ...result, snapshot: snapshotFor(pet, user.id, { onlineIds: onlineIds(pet.id) }) });
    }
    if (kind === 'equip') {
      const result = equipItem({ petId: pet.id, userId: user.id, itemId: body.itemId });
      pushState(pet.id);
      return json(res, 200, { ...result, snapshot: snapshotFor(pet, user.id, { onlineIds: onlineIds(pet.id) }) });
    }
    if (kind === 'room') {
      const result = setRoom({ petId: pet.id, userId: user.id, roomId: body.roomId });
      pushState(pet.id);
      return json(res, 200, { ...result, snapshot: snapshotFor(pet, user.id, { onlineIds: onlineIds(pet.id) }) });
    }
    if (kind === 'task') {
      const result = claimTask({ petId: pet.id, userId: user.id, taskId: body.taskId });
      pushState(pet.id);
      return json(res, 200, { ...result, snapshot: snapshotFor(pet, user.id, { onlineIds: onlineIds(pet.id) }) });
    }
    if (kind === 'read') {
      markNotificationsRead(pet.id, user.id);
      return json(res, 200, { ok: true });
    }
  }

  throw httpError(404, 'Метод не найден');
}

function ensureDailyTasksSafe(pet) {
  try {
    // eslint-disable-next-line no-unused-expressions
    snapshotFor(pet, ownersOf(pet.id)[0]?.user_id || 'system', { onlineIds: [] });
  } catch (err) {
    console.error('[tasks]', err.message);
  }
}

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  name: u.display_name,
  avatar: u.avatar_emoji,
  telegram_id: u.telegram_id || null,
});

const catalogPayload = () => ({
  version: CATALOG_VERSION,
  actions: Object.entries(ACTIONS).map(([key, a]) => ({
    key,
    title: a.title,
    icon: a.icon,
    cooldown: a.cooldown,
    label: a.label,
  })),
  stats: STATS,
  clothes: CLOTHES,
  rooms: ROOMS,
  slots: SLOTS,
  games: GAMES,
  achievements: ACHIEVEMENTS,
  dailyRewards: DAILY_REWARDS,
  colors: PUG_COLORS,
});

/* -------------------------------------------------------------- статика */

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA-fallback: любой неизвестный путь отдаёт index.html (deep links из Telegram)
      if (!path.extname(pathname)) return sendFile(path.join(PUBLIC_DIR, 'index.html'), res);
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Не найдено');
      return;
    }
    sendFile(filePath, res, stat);
  });
}

function sendFile(filePath, res, stat) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end('Не найдено');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'content-length': data.length,
    });
    res.end(data);
  });
}

/* ---------------------------------------------------------------- сервер */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': req.headers.origin || '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-credentials': 'true',
    });
    return res.end();
  }

  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, url);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error('[api]', err);
      if (!res.headersSent) {
        json(res, status, { error: err.message || 'Внутренняя ошибка', ...(err.extra || {}) });
      } else {
        res.end();
      }
    }
    return;
  }

  serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`\n  🐶  Мопсик вдвоём — сервер запущен`);
  console.log(`      http://localhost:${PORT}`);
  console.log(`      данные: ${DB_FILE_PATH} · realtime: SSE\n`);
});

process.on('uncaughtException', (err) => console.error('[uncaught]', err));
process.on('unhandledRejection', (err) => console.error('[unhandled]', err));
process.on('SIGTERM', () => {
  flush();
  server.close(() => process.exit(0));
});
