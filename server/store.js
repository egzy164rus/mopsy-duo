/**
 * store.js — минималистичное хранилище состояния.
 *
 * MVP работает на файле JSON (data/db.json), чтобы проект запускался без
 * внешних зависимостей и PostgreSQL. Интерфейс намеренно повторяет
 * репозиторий из sql/schema.sql: при переезде на Postgres достаточно
 * заменить реализацию методов ниже (см. docs/BACKEND.md).
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(DATA_DIR, 'db.json');

const EMPTY = {
  meta: { version: 1, created_at: null, updated_at: null },
  users: [],
  pets: [],
  pet_owners: [],
  pet_stats: [],
  actions: [],
  inventory: [],
  achievements: [],
  daily_tasks: [],
  notifications: [],
  sessions: [],
  counters: {},
};

let db = structuredClone(EMPTY);
let dirty = false;
let flushTimer = null;

function ensureDir() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

export function load() {
  ensureDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = { ...structuredClone(EMPTY), ...JSON.parse(raw) };
    } catch (err) {
      console.error('[store] не удалось прочитать базу, создаю новую:', err.message);
      db = structuredClone(EMPTY);
    }
  }
  db.meta.created_at ||= Date.now();
  return db;
}

/** Атомарная запись: tmp-файл + rename, чтобы не потерять данные при сбое. */
export function flush() {
  if (!dirty) return;
  ensureDir();
  db.meta.updated_at = Date.now();
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  dirty = false;
}

/** Отложенная запись — не бьём диск на каждый чих. */
export function save() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      flush();
    } catch (err) {
      console.error('[store] ошибка записи:', err.message);
    }
  }, 400);
  flushTimer.unref?.();
}

export const getDb = () => db;

export function resetDb() {
  db = structuredClone(EMPTY);
  db.meta.created_at = Date.now();
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  dirty = false;
}

/** Генератор идентификаторов вида u_1a2b3c4d. */
export function newId(prefix) {
  db.counters[prefix] = (db.counters[prefix] || 0) + 1;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${db.counters[prefix].toString(36)}${rnd}`;
}

// --- простые «таблицы» ------------------------------------------------------
export const table = {
  users: () => db.users,
  pets: () => db.pets,
  petOwners: () => db.pet_owners,
  petStats: () => db.pet_stats,
  actions: () => db.actions,
  inventory: () => db.inventory,
  achievements: () => db.achievements,
  dailyTasks: () => db.daily_tasks,
  notifications: () => db.notifications,
  sessions: () => db.sessions,
};

export const DB_FILE_PATH = DB_FILE;

process.on('exit', () => {
  try {
    flush();
  } catch {
    /* ignore */
  }
});
process.on('SIGINT', () => {
  flush();
  process.exit(0);
});
process.on('SIGTERM', () => {
  flush();
  process.exit(0);
});
