/**
 * core.js — общее состояние клиента и действия над ним.
 * Views импортируют state и хелперы отсюда, app.js связывает всё вместе.
 */
import { api, setToken, getToken } from './api.js';
import { toast, haptic, modal, esc, secLabel, floatText } from './ui.js';
import { sfx } from './sfx.js';

export const state = {
  user: null,
  catalog: null,
  snapshot: null,
  view: 'home',
  loading: true,
  bootError: null,
  isTelegram: false,
  pendingInvite: null,
  inviteStep: false,
  config: null,
  online: [],
  fx: null, // { animation, at } — эффект последнего действия
  cooldowns: {}, // type -> ms на момент syncedAt
  syncedAt: 0,
  busy: false,
  lastLevel: null,
  tournamentBest: {},
};

/** Колбэк перерисовки регистрирует app.js. */
let renderHook = () => {};
export const setRenderHook = (fn) => {
  renderHook = fn;
};

/** Колбэк подключения к realtime-потоку (тоже из app.js). */
let streamHook = () => {};
export const setStreamHook = (fn) => {
  streamHook = fn;
};
export const connectRealtime = () => {
  const pet = pets();
  if (pet) streamHook(pet.id);
};
export const rerender = () => renderHook();

export const pets = () => state.snapshot?.pet || null;
export const owners = () => state.snapshot?.owners || [];
export const partner = () => owners().find((o) => !o.isMe) || null;
export const isDuo = () => owners().length > 1;

export function setView(view) {
  if (state.view === view) return;
  state.view = view;
  sfx.tap();
  haptic('light');
  rerender();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* -------------------------------------------------------------- снапшоты */

export function applySnapshot(snapshot, { silent = true } = {}) {
  if (!snapshot) return;
  const prev = state.snapshot;
  state.snapshot = snapshot;
  state.online = snapshot.owners?.filter((o) => o.online).map((o) => o.id) || [];
  state.cooldowns = { ...snapshot.cooldowns };
  state.syncedAt = Date.now();

  const level = snapshot.pet?.level;
  if (prev && level && state.lastLevel !== null && level > state.lastLevel) {
    sfx.levelUp();
    toast(`${snapshot.pet.name} вырос до ${level} уровня!`, 'success', { icon: '🏅', duration: 3600 });
  }
  if (level) state.lastLevel = level;
  if (!silent) rerender();
}

export async function refresh({ silent = true } = {}) {
  const data = await api.bootstrap(state.pendingInvite || undefined);
  state.user = data.user;
  state.catalog = data.catalog;
  state.config = data.config || state.config;
  if (data.snapshot) applySnapshot(data.snapshot, { silent: true });
  else state.snapshot = null;
  if (!silent) rerender();
  // после любого входа/создания мопса поднимаем realtime-поток
  if (data.snapshot) connectRealtime();
  return data;
}

/* ---------------------------------------------------------------- действия */

const ACTION_SOUND = {
  feed: 'eat',
  water: 'water',
  play: 'happy',
  walk: 'happy',
  pat: 'happy',
  wash: 'water',
  sleep: 'happy',
  heal: 'success',
  praise: 'bark',
};

/** Основное действие с мопсом (кормление, прогулка и т.д.). */
export async function runAction(type, { anchor } = {}) {
  const pet = pets();
  if (!pet) return;

  // пока мопс спит, доступно только «разбудить»
  if (pet.sleeping && type !== 'sleep') {
    toast(`${pet.name} спит. Разбудите его, чтобы продолжить`, 'info', { icon: '😴' });
    sfx.tap();
    return;
  }

  // «разбудить» не должно блокироваться кулдауном «уложить спать»
  const remaining = type === 'sleep' && pet.sleeping ? 0 : cooldownLeft(type);
  if (remaining > 0) {
    toast(`Ещё ${secLabel(remaining)} до следующего раза`, 'info', { icon: '⏳' });
    sfx.tap();
    return;
  }
  sfx.tap();
  haptic('light');
  setBusy(type);

  try {
    const res = await api.action(pet.id, type);
    state.fx = { animation: res.animation || 'happy', at: Date.now() };
    applySnapshot(res.snapshot, { silent: true });
    state.cooldowns[type] = state.catalog.actions.find((a) => a.key === type)?.cooldown ?? 0;
    state.syncedAt = Date.now();
    rerender();

    const s = ACTION_SOUND[type];
    if (s) sfx[s]?.();
    if (res.rewards?.coins) {
      sfx.coin();
      const el = document.querySelector('[data-coins]');
      if (el) el.classList.add('coin-bump');
      setTimeout(() => el?.classList.remove('coin-bump'), 700);
    }
    toast(res.message || 'Готово!', 'success', { icon: '💚' });
    if (res.rewards?.levelUp) {
      sfx.levelUp();
      toast(`Новый уровень: ${res.rewards.levelUp}! +20 монет`, 'success', { icon: '🏅', duration: 3600 });
    }
  } catch (err) {
    sfx.error();
    haptic('error');
    if (err.status === 429 && err.retryIn) {
      state.cooldowns[type] = err.retryIn;
      state.syncedAt = Date.now();
      rerender();
    }
    toast(err.message || 'Не получилось', 'error');
  } finally {
    setBusy(null);
  }
}

export async function runGame(game, score) {
  const pet = pets();
  if (!pet) return null;
  try {
    const res = await api.game(pet.id, game, Math.round(score));
    applySnapshot(res.snapshot, { silent: true });
    state.fx = { animation: 'play', at: Date.now() };
    rerender();
    sfx.coin();
    return res;
  } catch (err) {
    toast(err.message || 'Игра не засчитана', 'error');
    return null;
  }
}

export async function buyItem(itemId) {
  const pet = pets();
  if (!pet) return false;
  try {
    const res = await api.buy(pet.id, itemId);
    applySnapshot(res.snapshot, { silent: true });
    rerender();
    sfx.coin();
    toast(res.message || 'Покупка готова!', 'success', { icon: '🛍️' });
    return true;
  } catch (err) {
    sfx.error();
    toast(err.message || 'Не удалось купить', 'error');
    return false;
  }
}

export async function equipItem(itemId) {
  const pet = pets();
  if (!pet) return;
  try {
    const res = await api.equip(pet.id, itemId);
    applySnapshot(res.snapshot, { silent: true });
    rerender();
    sfx.tap();
    return res;
  } catch (err) {
    toast(err.message || 'Не удалось надеть', 'error');
  }
}

export async function setRoom(roomId) {
  const pet = pets();
  if (!pet) return;
  try {
    const res = await api.room(pet.id, roomId);
    applySnapshot(res.snapshot, { silent: true });
    rerender();
    sfx.success();
    toast('Комната обновлена 🏡', 'success');
  } catch (err) {
    toast(err.message || 'Не удалось сменить комнату', 'error');
  }
}

export async function claimTask(taskId) {
  const pet = pets();
  if (!pet) return;
  try {
    const res = await api.claimTask(pet.id, taskId);
    applySnapshot(res.snapshot, { silent: true });
    rerender();
    sfx.success();
    toast(res.message || 'Награда получена!', 'success', { icon: '🎁' });
  } catch (err) {
    sfx.error();
    toast(err.message || 'Пока нельзя забрать награду', 'error');
  }
}

/* --------------------------------------------------------------- утилиты */

function setBusy(type) {
  state.busy = Boolean(type);
  if (type) {
    document.querySelectorAll(`[data-act="action"][data-type="${type}"]`).forEach((b) => b.setAttribute('aria-busy', 'true'));
  } else {
    document.querySelectorAll('[aria-busy="true"]').forEach((b) => b.removeAttribute('aria-busy'));
    document.querySelectorAll('.loading-spin').forEach((b) => b.classList.remove('loading-spin'));
  }
}

export function cooldownLeft(type) {
  const base = state.cooldowns?.[type] || 0;
  const elapsed = Date.now() - (state.syncedAt || 0);
  return Math.max(0, base - elapsed);
}

/** Простая форма родительного падежа для имени мопса: Бублик → Бублика. */
export function petNameGen() {
  const name = pets()?.name || 'мопса';
  if (/[ая]$/i.test(name)) return name.slice(0, -1) + 'и';
  if (/[йь]$/i.test(name)) return name.slice(0, -1) + 'я';
  if (/[оеё]$/i.test(name)) return name;
  return `${name}а`;
}

/**
 * Ссылка-приглашение.
 * Внутри Telegram (если бот настроен) — прямой deep link вида
 *   https://t.me/<bot>/<app>?startapp=invite_ABC123
 * В браузере — обычная ссылка на сайт: <origin>/?invite=ABC123
 */
export function inviteLink() {
  const pet = pets();
  if (!pet) return '';
  const tgCfg = state.config?.telegram;
  if (tgCfg?.bot_username) {
    const app = tgCfg.app_short_name ? `/${encodeURIComponent(tgCfg.app_short_name)}` : '';
    return `https://t.me/${tgCfg.bot_username}${app}?startapp=invite_${pet.invite_code}`;
  }
  const base = window.location.href.split('?')[0].split('#')[0];
  return `${base}?invite=${pet.invite_code}`;
}

/** Модалка уведомлений. */
export async function openNotifications() {
  const snap = state.snapshot;
  if (!snap) return;
  const items = snap.notifications || [];
  const body = items.length
    ? `<ul class="stack" style="margin-top:12px">${items
        .map(
          (n) => `
      <li class="row" style="align-items:flex-start;gap:10px;${n.read ? 'opacity:.6' : ''}">
        <span class="journal-ic">${n.icon || '🔔'}</span>
        <div class="grow">
          <div class="journal-text">${esc(n.text)}</div>
          <div class="muted" style="font-size:11px;margin-top:2px">${new Date(n.created_at).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}</div>
        </div>
      </li>`,
        )
        .join('')}</ul>`
    : `<div class="empty"><div class="e-ic">🔔</div><h4>Пока тихо</h4><p>Здесь появятся напоминания и новости о действиях второго игрока.</p></div>`;

  await modal({
    title: 'Уведомления',
    body,
    actions: [{ label: 'Закрыть', value: true }],
  });

  // отмечаем прочитанными (мягко, без блокировки UI)
  api.readNotifications(snap.pet.id).then(() => {
    state.snapshot.notifications = snap.notifications.map((n) => ({ ...n, read: true }));
    state.snapshot.unread = 0;
    rerender();
  });
}

export { sfx, toast, haptic, modal, floatText };
export { getToken, setToken };
