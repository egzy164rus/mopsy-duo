/**
 * content.js — весь игровой контент и баланс в одном месте.
 * Меняя числа здесь, вы настраиваете экономику и сложность игры.
 */

export const ACTIONS = {
  feed: {
    label: 'кормит',
    title: 'Покормить',
    icon: '🍖',
    animation: 'eat',
    cooldown: 60_000,
    xp: 7,
    coins: 3,
    care: 6,
    effects: { satiety: 26, hydration: 2, mood: 4, love: 3, energy: 2 },
    requiresAwake: true,
    blockedBy: ['feed'],
  },
  water: {
    label: 'поит',
    title: 'Дать воды',
    icon: '💧',
    animation: 'drink',
    cooldown: 45_000,
    xp: 5,
    coins: 2,
    care: 5,
    effects: { hydration: 32, mood: 2, health: 2 },
    requiresAwake: true,
  },
  play: {
    label: 'играет с',
    title: 'Поиграть',
    icon: '🎾',
    case: 'ins',
    animation: 'play',
    cooldown: 90_000,
    xp: 12,
    coins: 6,
    care: 9,
    effects: { mood: 18, love: 7, energy: -12, satiety: -4, hygiene: -5 },
    requiresAwake: true,
    minEnergy: 15,
  },
  walk: {
    label: 'гуляет с',
    title: 'Погулять',
    icon: '🌳',
    case: 'ins',
    animation: 'walk',
    cooldown: 300_000,
    xp: 18,
    coins: 10,
    care: 14,
    effects: { mood: 14, health: 4, love: 8, energy: -14, satiety: -6, hygiene: -12 },
    requiresAwake: true,
    minEnergy: 20,
  },
  pat: {
    label: 'гладит',
    title: 'Погладить',
    icon: '🤍',
    animation: 'happy',
    cooldown: 20_000,
    xp: 4,
    coins: 1,
    care: 4,
    effects: { mood: 9, love: 8 },
  },
  wash: {
    label: 'купает',
    title: 'Искупать',
    icon: '🛁',
    animation: 'bath',
    cooldown: 420_000,
    xp: 10,
    coins: 5,
    care: 8,
    effects: { hygiene: 48, mood: 3, energy: -5, health: 2 },
    requiresAwake: true,
  },
  sleep: {
    label: 'укладывает спать',
    title: 'Уложить спать',
    icon: '😴',
    animation: 'sleep',
    cooldown: 600_000,
    xp: 4,
    coins: 1,
    care: 4,
    effects: {},
  },
  heal: {
    label: 'лечит',
    title: 'Полечить',
    icon: '💊',
    animation: 'heal',
    cooldown: 480_000,
    xp: 9,
    coins: 4,
    care: 8,
    effects: { health: 34, mood: 5, love: 3 },
  },
  praise: {
    label: 'хвалит',
    title: 'Похвалить',
    icon: '⭐',
    animation: 'happy',
    cooldown: 30_000,
    xp: 5,
    coins: 2,
    care: 5,
    effects: { mood: 12, love: 6 },
  },
};

/** Скорость изменения показателей за час реального времени. */
export const DECAY_PER_HOUR = {
  satiety: -4.4,
  hydration: -5.2,
  energy: -3.0,
  mood: -3.4,
  hygiene: -2.2,
  health: -0.5,
  love: -0.9,
};

export const STATS = [
  { key: 'satiety', label: 'Сытость', hint: 'Голод', icon: '🍖', color: '#F2994A', bg: '#FFF0DF' },
  { key: 'hydration', label: 'Питьё', hint: 'Жажда', icon: '💧', color: '#4FB6E8', bg: '#E4F5FF' },
  { key: 'energy', label: 'Энергия', hint: 'Усталость', icon: '⚡', color: '#F2C94C', bg: '#FFF8DC' },
  { key: 'mood', label: 'Настроение', hint: 'Грусть', icon: '😊', color: '#F27AA1', bg: '#FFEAF1' },
  { key: 'health', label: 'Здоровье', hint: 'Болезнь', icon: '❤️', color: '#EB5757', bg: '#FFE9E9' },
  { key: 'hygiene', label: 'Чистота', hint: 'Грязь', icon: '🫧', color: '#8B7BE8', bg: '#F0ECFF' },
  { key: 'love', label: 'Любовь', hint: 'Привязанность', icon: '💖', color: '#E86BA4', bg: '#FFEDF6' },
];

/** Каталог одежды и аксессуаров. */
export const CLOTHES = [
  { id: 'hat_party', name: 'Праздничный колпак', slot: 'hat', price: 120, rarity: 'common', emoji: '🎉', color: '#F27AA1' },
  { id: 'hat_beanie', name: 'Вязаная шапка', slot: 'hat', price: 90, rarity: 'common', emoji: '🧶', color: '#7FB77E' },
  { id: 'hat_crown', name: 'Корона мопса', slot: 'hat', price: 380, rarity: 'epic', emoji: '👑', color: '#F2C94C' },
  { id: 'hat_cap', name: 'Кепка-путешественника', slot: 'hat', price: 140, rarity: 'common', emoji: '🧢', color: '#4FB6E8' },
  { id: 'glasses_round', name: 'Круглые очки', slot: 'glasses', price: 130, rarity: 'common', emoji: '🤓', color: '#6B5B4B' },
  { id: 'glasses_sun', name: 'Солнечные очки', slot: 'glasses', price: 170, rarity: 'rare', emoji: '🕶️', color: '#2F2B3A' },
  { id: 'glasses_heart', name: 'Очки-сердечки', slot: 'glasses', price: 260, rarity: 'rare', emoji: '💕', color: '#E86BA4' },
  { id: 'bandana_red', name: 'Красная бандана', slot: 'bandana', price: 110, rarity: 'common', emoji: '🧣', color: '#EB5757' },
  { id: 'bandana_scarf', name: 'Тёплый шарф', slot: 'bandana', price: 150, rarity: 'common', emoji: '🧣', color: '#8B7BE8' },
  { id: 'bow_tie', name: 'Бабочка-джентльмен', slot: 'bandana', price: 220, rarity: 'rare', emoji: '🎀', color: '#6B5B4B' },
  { id: 'outfit_sweater', name: 'Уютный свитер', slot: 'outfit', price: 240, rarity: 'rare', emoji: '🧥', color: '#D98C5F' },
  { id: 'outfit_hero', name: 'Костюм супермопса', slot: 'outfit', price: 420, rarity: 'epic', emoji: '🦸', color: '#4FB6E8' },
  { id: 'outfit_pajama', name: 'Пижама в звёздочку', slot: 'outfit', price: 200, rarity: 'common', emoji: '🌙', color: '#8B7BE8' },
  { id: 'outfit_santa', name: 'Костюм Деда Мороза', slot: 'outfit', price: 360, rarity: 'epic', emoji: '🎅', color: '#EB5757' },
];

export const SLOTS = [
  { key: 'hat', label: 'Головное', icon: '🎩' },
  { key: 'glasses', label: 'Очки', icon: '🕶️' },
  { key: 'bandana', label: 'Шея', icon: '🧣' },
  { key: 'outfit', label: 'Костюм', icon: '🧥' },
];

/** Фоны комнаты. */
export const ROOMS = [
  { id: 'room_cozy', name: 'Уютная комната', price: 0, emoji: '🛋️', sky: '#FFEBD6', floor: '#F4CDA7', accent: '#F2A45C' },
  { id: 'room_garden', name: 'Летний сад', price: 150, emoji: '🌻', sky: '#DFF6DB', floor: '#B8E0A0', accent: '#7FB77E' },
  { id: 'room_beach', name: 'Пляж', price: 220, emoji: '🏖️', sky: '#DFF3FF', floor: '#F7E2B0', accent: '#4FB6E8' },
  { id: 'room_space', name: 'Космос', price: 400, emoji: '🚀', sky: '#2E2A4A', floor: '#4A4470', accent: '#8B7BE8' },
  { id: 'room_winter', name: 'Зимняя сказка', price: 320, emoji: '❄️', sky: '#E8F4FF', floor: '#FFFFFF', accent: '#7FB7D9' },
];

export const BOWLS = {
  food: { name: 'Миска с кормом', emoji: '🍲' },
  water: { name: 'Миска с водой', emoji: '🥣' },
};

/** Ежедневные задания: сервер выбирает 3 из пула детерминированно. */
export const TASK_POOL = [
  { code: 'feed_3', title: 'Покорми мопса 3 раза', icon: '🍖', metric: 'feed', target: 3, coins: 25, xp: 40 },
  { code: 'water_3', title: 'Дай воды 3 раза', icon: '💧', metric: 'water', target: 3, coins: 20, xp: 30 },
  { code: 'play_2', title: 'Поиграй с мопсом 2 раза', icon: '🎾', metric: 'play', target: 2, coins: 25, xp: 35 },
  { code: 'walk_1', title: 'Выгуляй питомца', icon: '🌳', metric: 'walk', target: 1, coins: 30, xp: 40 },
  { code: 'pat_5', title: 'Погладь мопса 5 раз', icon: '🤍', metric: 'pat', target: 5, coins: 15, xp: 25 },
  { code: 'wash_1', title: 'Искупай мопса', icon: '🛁', metric: 'wash', target: 1, coins: 20, xp: 30 },
  { code: 'game_2', title: 'Сыграй 2 мини-игры', icon: '🎮', metric: 'game', target: 2, coins: 30, xp: 45 },
  { code: 'care_60', title: 'Набери 60 очков заботы', icon: '💞', metric: 'care', target: 60, coins: 35, xp: 50 },
  { code: 'praise_3', title: 'Похвали мопса 3 раза', icon: '⭐', metric: 'praise', target: 3, coins: 15, xp: 20 },
];

export const COOP_TASK = {
  code: 'coop_together',
  title: 'Забота вдвоём: оба игрока сделали по действию',
  icon: '👫',
  target: 2,
  coins: 40,
  xp: 60,
};

export const ACHIEVEMENTS = [
  { code: 'first_feed', title: 'Первая ложка', desc: 'Покормите мопса первый раз', icon: '🍖', coins: 10, xp: 20 },
  { code: 'first_walk', title: 'Первая прогулка', desc: 'Выгуляйте мопса', icon: '🌳', coins: 15, xp: 25 },
  { code: 'first_bath', title: 'Чистюля', desc: 'Искупайте мопса', icon: '🛁', coins: 15, xp: 25 },
  { code: 'first_game', title: 'Игрок', desc: 'Пройдите мини-игру', icon: '🎮', coins: 15, xp: 25 },
  { code: 'feed_10', title: 'Заботливый', desc: 'Покормите мопса 10 раз', icon: '🥣', coins: 30, xp: 50 },
  { code: 'level_5', title: 'Пятый уровень', desc: 'Достигните 5 уровня мопса', icon: '🏅', coins: 50, xp: 60 },
  { code: 'level_10', title: 'Мопс-легенда', desc: 'Достигните 10 уровня', icon: '🏆', coins: 100, xp: 120 },
  { code: 'streak_3', title: 'Три дня подряд', desc: 'Серия заботы 3 дня', icon: '🔥', coins: 40, xp: 60 },
  { code: 'streak_7', title: 'Неделя вместе', desc: 'Серия заботы 7 дней', icon: '🔥', coins: 80, xp: 100 },
  { code: 'duo_online', title: 'Вдвоём веселее', desc: 'Второй игрок присоединился', icon: '👫', coins: 40, xp: 50 },
  { code: 'all_happy', title: 'Полный порядок', desc: 'Все показатели выше 80', icon: '✨', coins: 35, xp: 45 },
  { code: 'shopper', title: 'Модник', desc: 'Купите первый аксессуар', icon: '🛍️', coins: 20, xp: 30 },
];

export const XP_PER_LEVEL = (level) => 90 + (level - 1) * 70;

/** Награды за ежедневный вход: 7-дневный цикл. */
export const DAILY_REWARDS = [15, 20, 25, 30, 40, 50, 80];

export const GAMES = [
  { id: 'bone', title: 'Ловля косточки', icon: '🦴', duration: 20, desc: 'Лови косточки в миску — двигай мопса пальцем' },
  { id: 'treat', title: 'Найди лакомство', icon: '🍪', duration: 15, desc: 'Запомни, под какой чашкой лакомство' },
  { id: 'jump', title: 'Прыжки через препятствия', icon: '🐾', duration: 25, desc: 'Тапай, чтобы перепрыгнуть барьер' },
  { id: 'tug', title: 'Перетягивание игрушки', icon: '🪢', duration: 10, desc: 'Тапай как можно быстрее — тяни канат' },
];

export const PUG_COLORS = [
  { id: 'fawn', name: 'Пшеничный', body: '#E8C49A', dark: '#C9A175' },
  { id: 'apricot', name: 'Абрикосовый', body: '#EFB98A', dark: '#D19A6C' },
  { id: 'silver', name: 'Серебристый', body: '#D8D3CE', dark: '#B7B0AA' },
  { id: 'black', name: 'Чёрный', body: '#6E6461', dark: '#4E4643' },
];

export const CATALOG_VERSION = 3;

export const findClothing = (id) => CLOTHES.find((c) => c.id === id) || null;
export const findRoom = (id) => ROOMS.find((r) => r.id === id) || ROOMS[0];
