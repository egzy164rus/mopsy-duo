/** catalog.js — статические данные оформления на клиенте (не зависят от API). */

export const PUG_COLORS = [
  { id: 'fawn', name: 'Пшеничный', body: '#E8C49A', dark: '#C9A175', emoji: '🐕' },
  { id: 'apricot', name: 'Абрикосовый', body: '#EFB98A', dark: '#D19A6C', emoji: '🐩' },
  { id: 'silver', name: 'Серебристый', body: '#D8D3CE', dark: '#B7B0AA', emoji: '🐺' },
  { id: 'black', name: 'Чёрный', body: '#6E6461', dark: '#4E4643', emoji: '🐈‍⬛' },
];

/** Темы комнат: цвета сцены и декор. */
export const ROOM_THEMES = {
  room_cozy: { sky: '#FFE9D2', floor: '#F4CDA7', name: 'Уютная комната' },
  room_garden: { sky: '#DFF6DB', floor: '#B8E0A0', name: 'Летний сад' },
  room_beach: { sky: '#DFF3FF', floor: '#F7E2B0', name: 'Пляж' },
  room_space: { sky: '#312C56', floor: '#4A4470', name: 'Космос' },
  room_winter: { sky: '#E8F4FF', floor: '#FFFFFF', name: 'Зимняя сказка' },
};

export const STATE_LABEL = {
  happy: 'Счастлив',
  normal: 'В порядке',
  hungry: 'Голоден',
  sleepy: 'Сонный',
  sad: 'Грустит',
  sick: 'Болеет',
  dirty: 'Грязный',
};

export const STATE_EMOJI = {
  happy: '🥰',
  normal: '🙂',
  hungry: '🍖',
  sleepy: '😴',
  sad: '😔',
  sick: '🤒',
  dirty: '🫧',
};

/** Эффекты-пропсы, которые появляются на сцене при действиях. */
export const ACTION_PROPS = {
  eat: { emoji: '🍲', className: 'prop-bowl' },
  drink: { emoji: '🥣', className: 'prop-bowl' },
  play: { emoji: '🎾', className: 'prop-ball' },
  walk: { emoji: '🌿', className: 'prop-leaf' },
  bath: { emoji: '🫧', className: 'prop-bubbles' },
  heal: { emoji: '✨', className: 'prop-sparkle' },
  sleep: { emoji: '😴', className: 'prop-sleep' },
  happy: { emoji: '💖', className: 'prop-heart' },
};

export const ONBOARDING = [
  {
    art: '🐶',
    title: 'Познакомьтесь — это ваш мопс',
    text: 'Кормите, поите, гуляйте и играйте с ним. Чем больше заботы, тем счастливее хвостик.',
  },
  {
    art: '👫',
    title: 'Заботьтесь вдвоём',
    text: 'Пригласите друга, пару или ребёнка по коду — у мопса будет два любящих хозяина. Всё синхронизируется мгновенно.',
  },
  {
    art: '🎮',
    title: 'Играйте и наряжайте',
    text: 'Мини-игры приносят монеты, монеты — шапочки, очки и новые комнаты. Каждый день — задания и награды.',
  },
];
