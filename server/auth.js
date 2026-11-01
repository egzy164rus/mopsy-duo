/**
 * auth.js — пароли, сессии и проверка Telegram WebApp initData.
 * Без внешних зависимостей: scrypt + HMAC-SHA256 из node:crypto.
 */
import crypto from 'node:crypto';
import { getDb, newId, save, table } from './store.js';

const SESSION_TTL = 1000 * 60 * 60 * 24 * 60; // 60 дней — игрок не теряет вход

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const session = { token, user_id: userId, created_at: Date.now(), expires_at: Date.now() + SESSION_TTL };
  table.sessions().push(session);
  // чистим просроченные
  const db = getDb();
  db.sessions = db.sessions.filter((s) => s.expires_at > Date.now());
  save();
  return token;
}

export function resolveSession(token) {
  if (!token) return null;
  const session = table.sessions().find((s) => s.token === token);
  if (!session || session.expires_at < Date.now()) return null;
  return getDb().users.find((u) => u.id === session.user_id) || null;
}

export function destroySession(token) {
  const db = getDb();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  save();
}

export function createUser({ username, displayName, password, telegramId = null, avatar = '🐶' }) {
  const db = getDb();
  const clean = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,20}$/.test(clean)) {
    throw httpError(400, 'Логин: 3–20 символов, латиница, цифры, _ и .');
  }
  if (db.users.some((u) => u.username === clean)) {
    throw httpError(409, 'Такой логин уже занят');
  }
  if (!password || String(password).length < 4) {
    throw httpError(400, 'Пароль должен быть не короче 4 символов');
  }
  const { salt, hash } = hashPassword(String(password));
  const user = {
    id: newId('u'),
    username: clean,
    display_name: String(displayName || username).trim().slice(0, 24) || clean,
    password_salt: salt,
    password_hash: hash,
    telegram_id: telegramId,
    avatar_emoji: avatar,
    created_at: Date.now(),
    last_seen_at: Date.now(),
  };
  db.users.push(user);
  save();
  return user;
}

/**
 * Проверка подписи Telegram WebApp initData.
 * Если TELEGRAM_BOT_TOKEN не задан (локальная разработка) — режим доверия,
 * данные принимаются как есть, но сервер помечает их как dev.
 */
export function verifyTelegramInitData(initData) {
  if (!initData || typeof initData !== 'string') throw httpError(400, 'Пустые данные Telegram');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date') || 0);
  const userRaw = params.get('user');
  if (!userRaw) throw httpError(400, 'Telegram не передал профиль');
  let tgUser;
  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    throw httpError(400, 'Некорректный профиль Telegram');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if (computed !== hash) throw httpError(401, 'Подпись Telegram не совпала');
    if (Date.now() / 1000 - authDate > 60 * 60 * 24) throw httpError(401, 'Данные Telegram устарели');
  }
  return { tgUser, trusted: Boolean(botToken) };
}

export function upsertTelegramUser(tgUser) {
  const db = getDb();
  const tgId = String(tgUser.id);
  let user = db.users.find((u) => u.telegram_id === tgId);
  const username = (tgUser.username || `tg${tgId}`).toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20) || `tg${tgId}`;
  if (!user) {
    let unique = username;
    let i = 1;
    while (db.users.some((u) => u.username === unique)) unique = `${username}${i++}`;
    const { salt, hash } = hashPassword(crypto.randomBytes(12).toString('hex'));
    user = {
      id: newId('u'),
      username: unique,
      display_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 24) || 'Игрок',
      password_salt: salt,
      password_hash: hash,
      telegram_id: tgId,
      avatar_emoji: '🐶',
      created_at: Date.now(),
      last_seen_at: Date.now(),
    };
    db.users.push(user);
  } else {
    user.display_name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 24) || user.display_name;
    user.last_seen_at = Date.now();
  }
  save();
  return user;
}

export function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.extra = extra;
  return err;
}
