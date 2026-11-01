/**
 * engine.js — вся игровая логика: показатели, действия, уровни, задания,
 * достижения, уведомления. Сервер — единственный источник истины, поэтому
 * одновременные действия двух игроков не конфликтуют (см. performAction).
 */
import { getDb, newId, save, table } from './store.js';
import { httpError } from './auth.js';
import {
  ACTIONS,
  ACHIEVEMENTS,
  DECAY_PER_HOUR,
  DAILY_REWARDS,
  TASK_POOL,
  COOP_TASK,
  XP_PER_LEVEL,
  CLOTHES,
  ROOMS,
  findClothing,
  findRoom,
} from './content.js';

const HOUR = 3_600_000;
const MAX_OFFLINE_HOURS = 36; // сколько времени учитываем, если никто не заходил
const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10);
const prevDayKey = () => dayKey(Date.now() - 24 * HOUR);
const round1 = (v) => Math.round(v * 10) / 10;

/* ------------------------------------------------------------------ доступ */

export const findPet = (id) => table.pets().find((p) => p.id === id) || null;
export const findUser = (id) => table.users().find((u) => u.id === id) || null;
export const ownersOf = (petId) =>
  table
    .petOwners()
    .filter((o) => o.pet_id === petId)
    .map((o) => ({ ...o, user: findUser(o.user_id) }));
export const petsOfUser = (userId) =>
  table
    .petOwners()
    .filter((o) => o.user_id === userId)
    .map((o) => findPet(o.pet_id))
    .filter(Boolean);
export const isOwner = (petId, userId) => table.petOwners().some((o) => o.pet_id === petId && o.user_id === userId);

export function getStats(petId) {
  let stats = table.petStats().find((s) => s.pet_id === petId);
  if (!stats) {
    stats = {
      pet_id: petId,
      satiety: 78,
      hydration: 80,
      energy: 72,
      mood: 85,
      health: 92,
      hygiene: 88,
      love: 40,
      updated_at: Date.now(),
    };
    table.petStats().push(stats);
  }
  return stats;
}

/* ------------------------------------------------------------- время/упадок */

/** Учитываем реальное время с последнего визита и состояние сна. */
export function applyDecay(pet, stats, now = Date.now()) {
  const hours = Math.min(MAX_OFFLINE_HOURS, Math.max(0, (now - stats.updated_at) / HOUR));
  if (hours < 0.001) return;
  const sleeping = pet.sleep_until && pet.sleep_until > now;
  const mult = sleeping ? 0.55 : 1;

  for (const [key, rate] of Object.entries(DECAY_PER_HOUR)) {
    if (key === 'energy') {
      const energyRate = sleeping ? 13 : rate; // во сне энергия восстанавливается
      stats.energy = clamp(stats.energy + energyRate * hours);
      continue;
    }
    if (key === 'health') continue; // здоровье считаем отдельно
    const before = stats[key];
    stats[key] = clamp(before + rate * hours * mult);
  }

  const critical = stats.satiety < 20 || stats.hydration < 20 || stats.hygiene < 15;
  stats.health = clamp(stats.health + (critical ? -1.4 : 0.5) * hours);
  stats.updated_at = now;

  if (sleeping && stats.energy >= 92) pet.sleep_until = null;
  if (pet.sleep_until && pet.sleep_until <= now) pet.sleep_until = null;
  for (const s of Object.keys(DECAY_PER_HOUR)) stats[s] = round1(stats[s]);
}

/** Производное настроение мопса для анимаций и подсказок. */
export function deriveState(pet, stats) {
  const sleeping = Boolean(pet.sleep_until && pet.sleep_until > Date.now());
  if (sleeping) return { state: 'sleepy', sleeping: true, hint: `${pet.name} сладко спит` };
  if (stats.health < 35) return { state: 'sick', hint: `${pet.name} приболел, нужно лечение` };
  if (stats.hygiene < 28) return { state: 'dirty', hint: `${pet.name} испачкался, пора купаться` };
  if (stats.satiety < 28) return { state: 'hungry', hint: `${pet.name} голоден — покормите` };
  if (stats.hydration < 28) return { state: 'hungry', hint: `${pet.name} хочет пить` };
  if (stats.mood < 38) return { state: 'sad', hint: `${pet.name} грустит, поиграйте с ним` };
  if (stats.energy < 25) return { state: 'sleepy', hint: `${pet.name} устал и хочет спать` };
  if (stats.mood >= 75 && stats.health >= 60 && stats.satiety >= 50) {
    return { state: 'happy', hint: `${pet.name} счастлив! Так держать` };
  }
  return { state: 'normal', hint: `${pet.name} в порядке и ждёт заботы` };
}

export const levelInfo = (pet) => {
  const need = XP_PER_LEVEL(pet.level);
  return { level: pet.level, xp: pet.xp, need, pct: Math.min(100, Math.round((pet.xp / need) * 100)) };
};

/* --------------------------------------------------------------- создание */

export function createPet({ userId, name, colorId }) {
  const db = getDb();
  const clean = String(name || '').trim().slice(0, 20);
  if (clean.length < 2) throw httpError(400, 'Имя мопса: минимум 2 символа');
  if (petsOfUser(userId).length >= 3) throw httpError(400, 'Максимум 3 мопса на аккаунт');

  const pet = {
    id: newId('pet'),
    name: clean,
    color: colorId || 'fawn',
    level: 1,
    xp: 0,
    coins: 120,
    care_points: 0,
    room: 'room_cozy',
    equipped: { hat: null, glasses: null, bandana: null, outfit: null },
    sleep_until: null,
    streak: 0,
    streak_last_day: null,
    last_daily_claim: null,
    invite_code: makeInviteCode(),
    reminder_times: {},
    recent_keys: {},
    created_at: Date.now(),
  };
  db.pets.push(pet);
  db.pet_owners.push({ id: newId('po'), pet_id: pet.id, user_id: userId, role: 'owner', joined_at: Date.now() });
  getStats(pet.id);
  ensureDailyTasks(pet);
  logAction(pet, userId, 'create', `Мопс ${pet.name} появился дома — теперь о нём заботятся`);
  save();
  return pet;
}

function makeInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!table.pets().some((p) => p.invite_code === code)) return code;
  }
  return `X${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

export function joinPetByCode({ userId, code }) {
  const clean = String(code || '').trim().toUpperCase();
  const pet = table.pets().find((p) => p.invite_code === clean);
  if (!pet) throw httpError(404, 'Код не найден. Проверьте приглашение');
  if (isOwner(pet.id, userId)) throw httpError(400, 'Вы уже владелец этого мопса');
  const owners = ownersOf(pet.id);
  if (owners.length >= 2) throw httpError(409, 'У этого мопса уже два владельца');

  table.petOwners().push({ id: newId('po'), pet_id: pet.id, user_id: userId, role: 'co-owner', joined_at: Date.now() });
  const user = findUser(userId);
  logAction(pet, userId, 'join', `${user?.display_name || 'Новый игрок'} присоединяется к заботе о ${pet.name}`);
  addNotification(pet.id, { type: 'partner_join', icon: '👫', text: `${user?.display_name || 'Партнёр'} теперь заботится о ${pet.name} вместе с вами!`, userId: owners[0]?.user_id });
  unlockAchievement(pet, 'duo_online');
  save();
  return pet;
}

/* ---------------------------------------------------------------- действия */

function logAction(pet, userId, type, text, meta = {}) {
  const row = {
    id: newId('act'),
    pet_id: pet.id,
    user_id: userId,
    type,
    text,
    meta,
    created_at: Date.now(),
  };
  table.actions().push(row);
  // храним разумный хвост журнала
  const all = table.actions();
  const mine = all.filter((a) => a.pet_id === pet.id);
  if (mine.length > 400) {
    const drop = new Set(mine.slice(0, mine.length - 400).map((a) => a.id));
    getDb().actions = all.filter((a) => !drop.has(a.id));
  }
  return row;
}

/**
 * Простое склонение имени мопса. Полноценная морфология тут не нужна:
 * имена питомцев короткие и придумываются игроками.
 */
const ACCEPT = /[аеёиоуыэюя]$/i;

export function petNameCase(name, form = 'acc') {
  const n = String(name || '').trim() || 'мопса';
  const last = n.slice(-1).toLowerCase();
  const vowel = ACCEPT.test(last);
  if (form === 'ins') {
    if (last === 'а') return `${n.slice(0, -1)}ой`;
    if (last === 'я') return `${n.slice(0, -1)}ей`;
    if (last === 'ь') return `${n.slice(0, -1)}ем`;
    if (vowel) return n;
    return `${n}ом`;
  }
  if (last === 'а') return `${n.slice(0, -1)}у`;
  if (last === 'я') return `${n.slice(0, -1)}ю`;
  if (last === 'ь') return `${n.slice(0, -1)}я`;
  if (last === 'й') return `${n.slice(0, -1)}я`;
  if (vowel) return n;
  return `${n}а`;
}

export const actionText = (displayName, type, petName) => {
  const a = ACTIONS[type];
  if (!a) return `${displayName}: ${type}`;
  const name = petNameCase(petName, a.case === 'ins' ? 'ins' : 'acc');
  return `${displayName} ${a.label} ${name}`;
};

function checkCooldown(pet, type, now) {
  const cfg = ACTIONS[type];
  const last = table
    .actions()
    .filter((a) => a.pet_id === pet.id && a.type === type)
    .sort((a, b) => b.created_at - a.created_at)[0];
  if (!last) return null;
  const left = cfg.cooldown - (now - last.created_at);
  if (left <= 0) return null;
  return { left, by: findUser(last.user_id)?.display_name || 'Кто-то' };
}

function addXp(pet, xp) {
  pet.xp += xp;
  let leveledUp = false;
  while (pet.xp >= XP_PER_LEVEL(pet.level)) {
    pet.xp -= XP_PER_LEVEL(pet.level);
    pet.level += 1;
    pet.coins += 20;
    leveledUp = true;
  }
  return leveledUp;
}

function applyEffects(stats, effects = {}) {
  for (const [key, delta] of Object.entries(effects)) {
    if (typeof stats[key] === 'number') stats[key] = round1(clamp(stats[key] + delta));
  }
}

export function performAction({ petId, userId, type, idempotencyKey }) {
  const pet = findPet(petId);
  if (!pet) throw httpError(404, 'Мопс не найден');
  if (!isOwner(petId, userId)) throw httpError(403, 'Нет доступа к этому питомцу');
  const cfg = ACTIONS[type];
  if (!cfg) throw httpError(400, 'Неизвестное действие');

  // защита от повторной отправки одного и того же действия
  if (idempotencyKey) {
    const cached = pet.recent_keys?.[idempotencyKey];
    if (cached && Date.now() - cached.at < 120_000) return { ...cached.data, duplicated: true };
  }

  const now = Date.now();
  const stats = getStats(pet.id);
  applyDecay(pet, stats, now);

  const isSleeping = Boolean(pet.sleep_until && pet.sleep_until > now);
  if (type === 'sleep') {
    if (isSleeping) {
      pet.sleep_until = null;
      applyEffects(stats, { mood: 4 });
      const row = logAction(pet, userId, 'wake', `${findUser(userId)?.display_name} будит ${petNameCase(pet.name)}`);
      save();
      return { ok: true, message: `${pet.name} проснулся!`, action: row, animation: 'happy' };
    }
    pet.sleep_until = now + 12 * 60_000;
    applyEffects(stats, { energy: 6 });
    const row = logAction(pet, userId, 'sleep', `${findUser(userId)?.display_name} укладывает ${petNameCase(pet.name)} спать`);
    save();
    return { ok: true, message: `${pet.name} засыпает...`, action: row, animation: 'sleep' };
  }

  if (isSleeping) {
    throw httpError(409, `${pet.name} спит. Разбудите его, чтобы продолжить`, { code: 'SLEEPING' });
  }
  if (cfg.minEnergy && stats.energy < cfg.minEnergy) {
    throw httpError(409, `${pet.name} слишком устал. Дайте ему отдохнуть 😴`, { code: 'TIRED' });
  }
  const cd = checkCooldown(pet, type, now);
  if (cd) {
    const sec = Math.ceil(cd.left / 1000);
    throw httpError(429, `Подождите ${sec} с — «${cfg.title}» уже было совсем недавно`, {
      code: 'COOLDOWN',
      retryIn: cd.left,
    });
  }

  applyEffects(stats, cfg.effects);
  const leveledUp = addXp(pet, cfg.xp);
  pet.coins += leveledUp ? 0 : 0;
  pet.care_points += cfg.care;
  touchStreak(pet);

  const user = findUser(userId);
  const row = logAction(pet, userId, type, actionText(user?.display_name || 'Игрок', type, pet.name), {
    coins: cfg.coins,
    xp: cfg.xp,
  });
  pet.coins += cfg.coins;
  if (leveledUp) pet.coins += 20;

  // уведомление партнёру + отложенная идемпотентность
  const partner = ownersOf(pet.id).find((o) => o.user_id !== userId);
  if (partner) {
    addNotification(pet.id, {
      type: 'partner_action',
      icon: cfg.icon,
      text: `${user?.display_name || 'Партнёр'} ${cfg.label} ${pet.name}`,
      userId: partner.user_id,
      throttleMs: 20_000,
    });
  }

  checkAchievements(pet, stats);
  const result = {
    ok: true,
    message: pickMessage(type, pet.name),
    action: row,
    rewards: { coins: cfg.coins + (leveledUp ? 20 : 0), xp: cfg.xp, levelUp: leveledUp ? pet.level : null },
    animation: cfg.animation,
  };
  if (idempotencyKey) {
    pet.recent_keys ||= {};
    pet.recent_keys[idempotencyKey] = { at: now, data: result };
    const keys = Object.keys(pet.recent_keys);
    if (keys.length > 40) delete pet.recent_keys[keys[0]];
  }
  save();
  return result;
}

function pickMessage(type, petName) {
  const pool = {
    feed: [`${petName} с аппетитом всё съел! 🍖`, `Ммм, вкусно! ${petName} доволен 🐶`],
    water: [`${petName} напился 💧`, `Свежая водичка — то, что нужно! 🥣`],
    play: [`${petName} прыгает от радости! 🎾`, `Как же весело играть вдвоём! ✨`],
    walk: [`Прогулка пошла на пользу! 🌳`, `${petName} нанюхался свежего воздуха 🌿`],
    pat: [`${petName} мурчит от удовольствия 🤍`, `Хороший мопсик! 💞`],
    wash: [`${petName} теперь сияет чистотой 🫧`, `Пушистый и свежий! 🛁`],
    heal: [`${petName} чувствует себя лучше 💊`, `Забота — лучшее лекарство ❤️`],
    praise: [`${petName} гордо виляет хвостом ⭐`, `Самый лучший мопс на свете! 🏆`],
  };
  const arr = pool[type] || [`${petName} рад вашей заботе!`];
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ------------------------------------------------------------ мини-игры */

const GAME_REWARD = { bone: 34, treat: 26, jump: 30, tug: 24 };

export function playGame({ petId, userId, game, score, idempotencyKey }) {
  const pet = findPet(petId);
  if (!pet) throw httpError(404, 'Мопс не найден');
  if (!isOwner(petId, userId)) throw httpError(403, 'Нет доступа');
  if (!GAME_REWARD[game]) throw httpError(400, 'Неизвестная игра');

  const cachedGame = idempotencyKey ? pet.recent_keys?.[`g_${idempotencyKey}`] : null;
  if (cachedGame && Date.now() - cachedGame.at < 120_000) {
    return { ...cachedGame.data, duplicated: true };
  }

  const now = Date.now();
  const stats = getStats(pet.id);
  applyDecay(pet, stats, now);

  const lastPlay = table
    .actions()
    .filter((a) => a.pet_id === pet.id && a.type === 'game' && a.meta?.game === game)
    .sort((a, b) => b.created_at - a.created_at)[0];
  if (lastPlay && now - lastPlay.created_at < 45_000) {
    throw httpError(429, 'Мини-игра остывает, попробуйте через несколько секунд', {
      code: 'COOLDOWN',
      retryIn: 45_000 - (now - lastPlay.created_at),
    });
  }
  if (stats.energy < 12) throw httpError(409, `${pet.name} слишком устал для игр 😴`, { code: 'TIRED' });

  const safeScore = Math.max(0, Math.min(100, Number(score) || 0)); // античит: жёсткий предел
  const coins = Math.max(4, Math.round(GAME_REWARD[game] * (safeScore / 100) * 1.3));
  const xp = Math.max(5, Math.round(28 * (safeScore / 100) + 6));

  applyEffects(stats, { mood: 10 + Math.round(safeScore / 12), energy: -8, love: 4, satiety: -2 });
  const leveledUp = addXp(pet, xp);
  pet.coins += coins + (leveledUp ? 20 : 0);
  pet.care_points += 8;
  touchStreak(pet);

  const user = findUser(userId);
  const row = logAction(pet, userId, 'game', `${user?.display_name} играет в «${gameTitle(game)}» — ${Math.round(safeScore)} очков`, {
    game,
    score: safeScore,
  });
  const partner = ownersOf(pet.id).find((o) => o.user_id !== userId);
  if (partner) {
    addNotification(pet.id, {
      type: 'partner_action',
      icon: '🎮',
      text: `${user?.display_name} играет в «${gameTitle(game)}» — ${Math.round(safeScore)} очков`,
      userId: partner.user_id,
      throttleMs: 15_000,
    });
  }
  checkAchievements(pet, stats);
  const result = {
    ok: true,
    message: `Отличная игра! +${coins} монет`,
    action: row,
    rewards: { coins: coins + (leveledUp ? 20 : 0), xp, levelUp: leveledUp ? pet.level : null },
    animation: 'play',
  };
  pet.recent_keys ||= {};
  pet.recent_keys[`g_${idempotencyKey || newId('k')}`] = { at: now, data: result };
  save();
  return result;
}

const gameTitle = (id) =>
  ({ bone: 'Ловля косточки', treat: 'Найди лакомство', jump: 'Прыжки через препятствия', tug: 'Перетягивание игрушки' }[id] || id);

/* -------------------------------------------------------------- магазин */

export function buyItem({ petId, userId, itemId }) {
  const pet = findPet(petId);
  if (!pet) throw httpError(404, 'Мопс не найден');
  if (!isOwner(petId, userId)) throw httpError(403, 'Нет доступа');

  const clothes = findClothing(itemId);
  const room = ROOMS.find((r) => r.id === itemId && r.price > 0);
  const item = clothes || room;
  if (!item) throw httpError(404, 'Товар не найден');

  const owned = table.inventory().some((i) => i.pet_id === pet.id && i.item_id === itemId);
  if (owned) throw httpError(409, 'Этот предмет уже куплен');
  if (pet.coins < item.price) throw httpError(402, 'Не хватает монет. Заработайте их в мини-играх', { code: 'NO_MONEY' });

  pet.coins -= item.price;
  table.inventory().push({ id: newId('inv'), pet_id: pet.id, item_id: itemId, quantity: 1, acquired_at: Date.now() });
  const user = findUser(userId);
  logAction(pet, userId, 'buy', `${user?.display_name} покупает «${item.name}»`, { itemId });
  unlockAchievement(pet, 'shopper');
  save();
  return { ok: true, message: `«${item.name}» теперь ваш!`, coins: pet.coins };
}

export function equipItem({ petId, userId, itemId }) {
  const pet = findPet(petId);
  if (!pet) throw httpError(404, 'Мопс не найден');
  if (!isOwner(petId, userId)) throw httpError(403, 'Нет доступа');
  if (itemId) {
    const item = findClothing(itemId);
    if (!item) throw httpError(404, 'Предмет не найден');
    const owned = table.inventory().some((i) => i.pet_id === pet.id && i.item_id === itemId);
    if (!owned) throw httpError(403, 'Сначала купите предмет');
    pet.equipped[item.slot] = pet.equipped[item.slot] === itemId ? null : itemId;
    const user = findUser(userId);
    logAction(pet, userId, 'dress', `${user?.display_name} примеряет обновку на ${petNameCase(pet.name)}`, { itemId });
  }
  save();
  return { ok: true, equipped: pet.equipped };
}

export function setRoom({ petId, userId, roomId }) {
  const pet = findPet(petId);
  if (!pet) throw httpError(404, 'Мопс не найден');
  if (!isOwner(petId, userId)) throw httpError(403, 'Нет доступа');
  const room = findRoom(roomId);
  if (room.id !== 'room_cozy' && !table.inventory().some((i) => i.pet_id === pet.id && i.item_id === roomId)) {
    throw httpError(403, 'Сначала купите этот фон');
  }
  pet.room = room.id;
  save();
  return { ok: true, room: pet.room };
}

/* ---------------------------------------------------------- задания/серия */

export function ensureDailyTasks(pet) {
  const today = dayKey();
  const existing = table.dailyTasks().filter((t) => t.pet_id === pet.id && t.date === today);
  if (existing.length) return existing;

  // детерминированный выбор: один и тот же набор для обоих игроков
  const seed = [...`${pet.id}${today}`].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const pool = [...TASK_POOL];
  const picked = [];
  for (let i = 0; i < 3 && pool.length; i += 1) {
    const idx = (seed * (i + 3)) % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  const rows = picked.map((t) => ({
    id: newId('task'),
    pet_id: pet.id,
    date: today,
    code: t.code,
    title: t.title,
    icon: t.icon,
    metric: t.metric,
    target: t.target,
    coins: t.coins,
    xp: t.xp,
    claimed: false,
    is_coop: false,
  }));
  if (ownersOf(pet.id).length > 1) {
    rows.push({
      id: newId('task'),
      pet_id: pet.id,
      date: today,
      code: COOP_TASK.code,
      title: COOP_TASK.title,
      icon: COOP_TASK.icon,
      metric: 'coop',
      target: COOP_TASK.target,
      coins: COOP_TASK.coins,
      xp: COOP_TASK.xp,
      claimed: false,
      is_coop: true,
    });
  }
  table.dailyTasks().push(...rows);
  save();
  return rows;
}

function metricValue(petId, metric, date = dayKey()) {
  const start = new Date(`${date}T00:00:00.000Z`).getTime();
  const end = start + 24 * HOUR;
  const todayActions = table.actions().filter((a) => a.pet_id === petId && a.created_at >= start && a.created_at < end);
  if (metric === 'game') return todayActions.filter((a) => a.type === 'game').length;
  if (metric === 'care') {
    return todayActions.reduce((sum, a) => sum + (ACTIONS[a.type]?.care ?? (a.type === 'game' ? 8 : 0)), 0);
  }
  if (metric === 'coop') return new Set(todayActions.filter((a) => a.type !== 'create').map((a) => a.user_id)).size;
  return todayActions.filter((a) => a.type === metric).length;
}

export function taskProgress(petId, task) {
  const value = metricValue(petId, task.metric, task.date);
  return { value: Math.min(value, task.target), target: task.target, done: value >= task.target };
}

export function claimTask({ petId, userId, taskId }) {
  const pet = findPet(petId);
  if (!pet) throw httpError(404, 'Мопс не найден');
  if (!isOwner(petId, userId)) throw httpError(403, 'Нет доступа');
  const task = table.dailyTasks().find((t) => t.id === taskId && t.pet_id === petId);
  if (!task) throw httpError(404, 'Задание не найдено');
  if (task.claimed) throw httpError(409, 'Награда уже получена');
  const progress = taskProgress(petId, task);
  if (!progress.done) throw httpError(409, 'Задание ещё не выполнено');

  task.claimed = true;
  task.claimed_by = userId;
  task.claimed_at = Date.now();
  const leveledUp = addXp(pet, task.xp);
  pet.coins += task.coins + (leveledUp ? 20 : 0);
  const user = findUser(userId);
  logAction(pet, userId, 'task', `${user?.display_name} выполняет задание «${task.title}»`, { taskId });
  save();
  return {
    ok: true,
    message: `Награда: +${task.coins} монет, +${task.xp} опыта`,
    rewards: { coins: task.coins + (leveledUp ? 20 : 0), xp: task.xp, levelUp: leveledUp ? pet.level : null },
  };
}

function touchStreak(pet) {
  const today = dayKey();
  if (pet.streak_last_day === today) return;
  const isYesterday = pet.streak_last_day === prevDayKey();
  pet.streak = isYesterday ? (pet.streak || 0) + 1 : 1;
  pet.streak_last_day = today;
}

/** Ежедневная награда за вход: начисляется автоматически при первом визите. */
export function touchDailyBonus(pet, userId) {
  const today = dayKey();
  if (pet.last_daily_claim === today) return null;
  touchStreak(pet);
  const reward = DAILY_REWARDS[(Math.max(1, pet.streak) - 1) % DAILY_REWARDS.length];
  pet.last_daily_claim = today;
  pet.coins += reward;
  addXp(pet, 15);
  const user = findUser(userId);
  const notif = addNotification(pet.id, {
    type: 'daily',
    icon: '🎁',
    text: `Ежедневная награда: +${reward} монет. Серия заботы: ${pet.streak} дн.`,
    userId,
    force: true,
  });
  logAction(pet, userId, 'daily', `${user?.display_name} забирает ежедневную награду`, { reward });
  save();
  return { reward, streak: pet.streak, notification: notif };
}

/* ------------------------------------------------------------ достижения */

export function unlockAchievement(pet, code) {
  const def = ACHIEVEMENTS.find((a) => a.code === code);
  if (!def) return null;
  if (table.achievements().some((a) => a.pet_id === pet.id && a.code === code)) return null;
  table.achievements().push({ id: newId('ach'), pet_id: pet.id, code, unlocked_at: Date.now() });
  pet.coins += def.coins;
  addXp(pet, def.xp);
  addNotification(pet.id, {
    type: 'achievement',
    icon: def.icon,
    text: `Новое достижение: «${def.title}» (+${def.coins} монет)`,
    force: true,
  });
  save();
  return def;
}

export function checkAchievements(pet, stats) {
  const acts = table.actions().filter((a) => a.pet_id === pet.id);
  const count = (type) => acts.filter((a) => a.type === type).length;
  if (count('feed') >= 1) unlockAchievement(pet, 'first_feed');
  if (count('walk') >= 1) unlockAchievement(pet, 'first_walk');
  if (count('wash') >= 1) unlockAchievement(pet, 'first_bath');
  if (count('game') >= 1) unlockAchievement(pet, 'first_game');
  if (count('feed') >= 10) unlockAchievement(pet, 'feed_10');
  if (pet.level >= 5) unlockAchievement(pet, 'level_5');
  if (pet.level >= 10) unlockAchievement(pet, 'level_10');
  if ((pet.streak || 0) >= 3) unlockAchievement(pet, 'streak_3');
  if ((pet.streak || 0) >= 7) unlockAchievement(pet, 'streak_7');
  if (stats && ['satiety', 'hydration', 'energy', 'mood', 'health', 'hygiene', 'love'].every((k) => stats[k] >= 80)) {
    unlockAchievement(pet, 'all_happy');
  }
}

/* ----------------------------------------------------------- уведомления */

export function addNotification(petId, { type, icon, text, userId = null, force = false, throttleMs = 0 }) {
  const now = Date.now();
  if (!force && throttleMs) {
    const recent = table
      .notifications()
      .filter((n) => n.pet_id === petId && n.type === type && n.text === text)
      .sort((a, b) => b.created_at - a.created_at)[0];
    if (recent && now - recent.created_at < throttleMs) return null;
  }
  const row = {
    id: newId('ntf'),
    pet_id: petId,
    user_id: userId,
    type,
    icon,
    text,
    read_by: [],
    created_at: now,
  };
  table.notifications().push(row);
  // страховка от слишком длинного списка
  const all = table.notifications();
  const mine = all.filter((n) => n.pet_id === petId);
  if (mine.length > 120) {
    const drop = new Set(mine.slice(0, mine.length - 120).map((n) => n.id));
    getDb().notifications = all.filter((n) => !drop.has(n.id));
  }
  save();
  return row;
}

/** Напоминания о состоянии — не чаще, чем раз в 2 часа на каждый тип. */
export function ensureReminders(pet, stats) {
  const now = Date.now();
  pet.reminder_times ||= {};
  const maybe = (key, condition, icon, text, cooldownHours = 2) => {
    if (!condition) return null;
    const last = pet.reminder_times[key] || 0;
    if (now - last < cooldownHours * HOUR) return null;
    pet.reminder_times[key] = now;
    return addNotification(pet.id, { type: 'reminder', icon, text, force: true });
  };
  const created = [];
  const a = maybe('hungry', stats.satiety < 30, '🍖', `${pet.name} проголодался — пора покормить!`);
  const b = maybe('thirsty', stats.hydration < 30, '💧', `${pet.name} хочет пить`, 2);
  const c = maybe('sick', stats.health < 40, '💊', `${pet.name} плохо себя чувствует. Полечите его!`, 3);
  const d = maybe('sad', stats.mood < 32, '🎾', `${pet.name} грустит без внимания — поиграйте вместе`, 3);
  const e = maybe('dirty', stats.hygiene < 25, '🫧', `${pet.name} испачкался, пора искупать`, 4);
  for (const n of [a, b, c, d, e]) if (n) created.push(n);
  return created;
}

export function markNotificationsRead(petId, userId) {
  let changed = 0;
  for (const n of table.notifications()) {
    if (n.pet_id !== petId) continue;
    n.read_by ||= [];
    if (!n.read_by.includes(userId)) {
      n.read_by.push(userId);
      changed += 1;
    }
  }
  if (changed) save();
  return changed;
}

/* --------------------------------------------------------------- снапшот */

/** Полное состояние питомца для клиента — одинаковое для обоих игроков. */
export function snapshotFor(pet, viewerId, { onlineIds = [], extra = {} } = {}) {
  const stats = getStats(pet.id);
  applyDecay(pet, stats);
  const state = deriveState(pet, stats);
  const owners = ownersOf(pet.id).map((o) => ({
    id: o.user_id,
    name: o.user?.display_name || 'Игрок',
    username: o.user?.username,
    avatar: o.user?.avatar_emoji || '🐶',
    role: o.role,
    isMe: o.user_id === viewerId,
    online: onlineIds.includes(o.user_id),
  }));
  ensureDailyTasks(pet);

  const tasks = table
    .dailyTasks()
    .filter((t) => t.pet_id === pet.id && t.date === dayKey())
    .map((t) => ({ ...t, progress: taskProgress(pet.id, t) }));

  const actions = table
    .actions()
    .filter((a) => a.pet_id === pet.id)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 40)
    .map((a) => ({
      id: a.id,
      type: a.type,
      text: a.text,
      icon:
        ACTIONS[a.type]?.icon ||
        ({ game: '🎮', buy: '🛍️', create: '🎉', join: '👋', sleep: '😴', wake: '☀️', daily: '🎁', task: '🎯', dress: '🎀' }[a.type] ||
          '📝'),
      user_id: a.user_id,
      user_name: findUser(a.user_id)?.display_name || 'Игрок',
      isMe: a.user_id === viewerId,
      created_at: a.created_at,
    }));

  const notifications = table
    .notifications()
    .filter((n) => n.pet_id === pet.id && (!n.user_id || n.user_id === viewerId))
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 30)
    .map((n) => ({
      id: n.id,
      type: n.type,
      icon: n.icon,
      text: n.text,
      read: (n.read_by || []).includes(viewerId),
      created_at: n.created_at,
    }));

  const inventory = table.inventory()
    .filter((i) => i.pet_id === pet.id)
    .map((i) => i.item_id);

  const lastAction = actions[0] || null;
  const achievements = table
    .achievements()
    .filter((a) => a.pet_id === pet.id)
    .map((a) => a.code);

  return {
    pet: {
      id: pet.id,
      name: pet.name,
      color: pet.color,
      level: pet.level,
      xp: pet.xp,
      levelInfo: levelInfo(pet),
      coins: pet.coins,
      care_points: pet.care_points,
      room: pet.room,
      equipped: pet.equipped,
      sleep_until: pet.sleep_until,
      sleeping: state.sleeping,
      invite_code: pet.invite_code,
      streak: pet.streak || 0,
      created_at: pet.created_at,
    },
    state: state.state,
    hint: state.hint,
    stats,
    owners,
    viewer: { id: viewerId, name: findUser(viewerId)?.display_name || 'Игрок', isOwner: isOwner(pet.id, viewerId) },
    tasks,
    actions,
    notifications,
    unread: notifications.filter((n) => !n.read).length,
    inventory,
    achievements,
    lastAction: lastAction
      ? { text: lastAction.text, at: lastAction.created_at, icon: lastAction.icon, by: lastAction.user_name }
      : null,
    cooldowns: Object.fromEntries(
      Object.keys(ACTIONS).map((type) => {
        const cd = checkCooldown(pet, type, Date.now());
        return [type, cd ? Math.max(0, cd.left) : 0];
      }),
    ),
    server_time: Date.now(),
    ...extra,
  };
}

export { CLOTHES, ROOMS, dayKey };
