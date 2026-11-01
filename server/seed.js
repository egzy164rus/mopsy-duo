/**
 * seed.js — демонстрационные данные для первого запуска.
 * Запуск вручную: `npm run seed` (перезапись) / `npm run reset`.
 * При старте сервера вызывается ensureDemoData(): если база пустая —
 * создаёт двух игроков (Аня и Илья) и общего мопса Бублика.
 */
import { load, getDb, newId, save, table, resetDb } from './store.js';
import { createUser, hashPassword } from './auth.js';
import { createPet, ensureDailyTasks, addNotification, unlockAchievement, getStats } from './engine.js';

const MIN = 60_000;

export function ensureDemoData({ force = false } = {}) {
  const db = getDb();
  const hasDemo = db.users.some((u) => u.username === 'anya');
  if (hasDemo && !force) return false;
  if (db.users.length && !force) return false;
  seedDemo();
  return true;
}

export function seedDemo() {
  if (!getDb().meta.created_at) load();

  const anya = createUser({ username: 'anya', displayName: 'Аня', password: 'demo1234', avatar: '👩' });
  const ilya = createUser({ username: 'ilya', displayName: 'Илья', password: 'demo1234', avatar: '🧑' });

  const pet = createPet({ userId: anya.id, name: 'Бублик', colorId: 'fawn' });

  // второй владелец
  table.petOwners().push({
    id: newId('po'),
    pet_id: pet.id,
    user_id: ilya.id,
    role: 'co-owner',
    joined_at: Date.now() - 3 * 24 * 60 * MIN,
  });

  pet.level = 4;
  pet.xp = 120;
  pet.coins = 285;
  pet.care_points = 148;
  pet.streak = 4;
  pet.streak_last_day = new Date().toISOString().slice(0, 10);
  pet.last_daily_claim = new Date().toISOString().slice(0, 10);
  pet.created_at = Date.now() - 12 * 24 * 60 * MIN;
  pet.invite_code = 'BUBLIK';

  const stats = getStats(pet.id);
  Object.assign(stats, {
    satiety: 64,
    hydration: 58,
    energy: 71,
    mood: 82,
    health: 88,
    hygiene: 46,
    love: 66,
    updated_at: Date.now(),
  });

  // инвентарь и надетые вещи
  for (const itemId of ['hat_party', 'glasses_round', 'bandana_red', 'outfit_sweater']) {
    table.inventory().push({ id: newId('inv'), pet_id: pet.id, item_id: itemId, quantity: 1, acquired_at: Date.now() - 5 * 24 * 60 * MIN });
  }
  pet.equipped = { hat: 'hat_party', glasses: null, bandana: 'bandana_red', outfit: null };

  // журнал действий: сегодня и вчера
  const demoActions = [
    { user: ilya, type: 'feed', text: 'Илья кормит Бублика', ago: 26 },
    { user: anya, type: 'play', text: 'Аня играет с Бубликом', ago: 52 },
    { user: ilya, type: 'walk', text: 'Илья гуляет с Бубликом', ago: 96 },
    { user: anya, type: 'water', text: 'Аня поит Бублика', ago: 130 },
    { user: anya, type: 'praise', text: 'Аня хвалит Бублика', ago: 165 },
    { user: ilya, type: 'game', text: 'Илья играет в «Ловля косточки» — 78 очков', ago: 190, meta: { game: 'bone', score: 78 } },
    { user: anya, type: 'pat', text: 'Аня гладит Бублика', ago: 220 },
    { user: ilya, type: 'wash', text: 'Илья купает Бублика', ago: 26 * 60 },
    { user: anya, type: 'feed', text: 'Аня кормит Бублика', ago: 27 * 60 },
    { user: anya, type: 'game', text: 'Аня играет в «Прыжки через препятствия» — 64 очка', ago: 28 * 60, meta: { game: 'jump', score: 64 } },
  ];
  for (const a of demoActions) {
    table.actions().push({
      id: newId('act'),
      pet_id: pet.id,
      user_id: a.user.id,
      type: a.type,
      text: a.text,
      meta: a.meta || {},
      created_at: Date.now() - a.ago * MIN,
    });
  }

  // первая запись журнала — по дате создания питомца
  const createLog = table.actions().find((a) => a.pet_id === pet.id && a.type === 'create');
  if (createLog) {
    createLog.created_at = pet.created_at;
    createLog.text = 'Мопс Бублик появился дома — теперь о нём заботятся Аня и Илья';
  }

  // достижения
  for (const code of ['first_feed', 'first_walk', 'first_bath', 'first_game', 'duo_online', 'shopper']) {
    table.achievements().push({ id: newId('ach'), pet_id: pet.id, code, unlocked_at: Date.now() - 8 * 24 * 60 * MIN });
  }

  ensureDailyTasks(pet);

  addNotification(pet.id, {
    type: 'partner_action',
    icon: '🍖',
    text: 'Илья кормит Бублика',
    userId: anya.id,
    force: true,
  });
  addNotification(pet.id, {
    type: 'reminder',
    icon: '🫧',
    text: 'Бублик немного испачкался, пора искупать',
    force: true,
  });

  save();
  console.log('  🐕  Демо-данные готовы: Аня и Илья заботятся о мопсе Бублике');
  return pet;
}

/* CLI */
const isMain = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isMain) {
  load();
  if (process.argv.includes('--reset')) {
    resetDb();
    load();
    console.log('  ♻️  База очищена');
  }
  seedDemo();
  save();
  process.exit(0);
}

/**
 * purgeDemo() — удаляет демо-аккаунты anya/ilya и всё, что им принадлежит.
 * Нужно перед публикацией: у этих аккаунтов общеизвестный пароль demo1234.
 * Питомцы, где у демо-игроков есть настоящий совладелец, сохраняются.
 *
 * Запуск: node -e "import('./server/seed.js').then(m=>m.purgeDemo())"
 */
export function purgeDemo() {
  load(); // обязательно: работаем с файлом базы, а не с пустым состоянием в памяти
  const db = getDb();
  const demoUsernames = new Set(['anya', 'ilya']);
  const userIds = new Set(db.users.filter((u) => demoUsernames.has(u.username)).map((u) => u.id));
  if (!userIds.size) {
    console.log('Демо-аккаунтов в базе нет — всё чисто.');
    return 0;
  }

  // питомцы, у которых демо-игроки — единственные владельцы
  const ownersOf = (petId) => db.pet_owners.filter((o) => o.pet_id === petId);
  const ownedOnlyByDemo = new Set(
    db.pet_owners
      .filter((o) => userIds.has(o.user_id))
      .map((o) => o.pet_id)
      .filter((petId) => ownersOf(petId).every((o) => userIds.has(o.user_id))),
  );

  const gonePets = new Set([...ownedOnlyByDemo]);

  db.users = db.users.filter((u) => !userIds.has(u.id));
  db.sessions = db.sessions.filter((s) => !userIds.has(s.user_id));
  db.pet_owners = db.pet_owners.filter((o) => !userIds.has(o.user_id));
  db.notifications = db.notifications.filter(
    (n) => !userIds.has(n.user_id) && !gonePets.has(n.pet_id),
  );
  db.pets = db.pets.filter((p) => !gonePets.has(p.id));
  db.pet_stats = db.pet_stats.filter((s) => !gonePets.has(s.pet_id));
  db.actions = db.actions.filter((a) => !gonePets.has(a.pet_id));
  db.inventory = db.inventory.filter((i) => !gonePets.has(i.pet_id));
  db.achievements = db.achievements.filter(
    (a) => !gonePets.has(a.pet_id) && !userIds.has(a.user_id),
  );
  db.daily_tasks = db.daily_tasks.filter(
    (t) => !gonePets.has(t.pet_id) && !userIds.has(t.user_id),
  );

  save();
  console.log(
    `Удалено демо-аккаунтов: ${userIds.size}, питомцев без других владельцев: ${gonePets.size}.`,
  );
  return userIds.size;
}
