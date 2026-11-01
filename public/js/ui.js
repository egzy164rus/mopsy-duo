/** ui.js — маленькие UI-утилиты: тосты, модалки, бары, форматирование времени. */

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/** Telegram WebApp, если он есть. В браузере — заглушка. */
export const tg = () => window.Telegram?.WebApp || null;

export function haptic(type = 'light') {
  const w = tg();
  try {
    if (!w?.HapticFeedback) return;
    if (type === 'success' || type === 'error' || type === 'warning') w.HapticFeedback.notificationOccurred(type);
    else w.HapticFeedback.impactOccurred(type);
  } catch {
    /* ignore */
  }
}

export function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'вчера';
  return `${d} дн назад`;
}

export const plural = (n, one, few, many) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

export const secLabel = (ms) => {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

/* -------------------------------------------------------------------- тосты */

let toastId = 0;
export function toast(text, type = 'info', { icon, duration = 2600 } = {}) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.dataset.id = String(++toastId);
  el.innerHTML = `<span class="toast-icon">${icon || (type === 'success' ? '✅' : type === 'error' ? '😿' : '💬')}</span><span>${esc(text)}</span>`;
  root.appendChild(el);
  const remove = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 240);
  };
  setTimeout(remove, Math.min(5200, Math.max(1600, duration)));
  el.addEventListener('click', remove);
  return el;
}

/* ------------------------------------------------------------------ модалки */

let openModal = null;

/**
 * Нижняя шторка.
 * @returns {Promise<any>} — resolve(value) при нажатии кнопки, reject при закрытии.
 */
export function modal({ title, body = '', actions = [{ label: 'Понятно', value: true, variant: 'primary' }], dismissible = true }) {
  closeModal();
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-grab"></div>
        ${title ? `<h2>${esc(title)}</h2>` : ''}
        ${body}
        <div class="modal-actions">
          ${actions
            .map(
              (a, i) =>
                `<button class="btn ${a.variant === 'ghost' ? 'btn-ghost' : a.variant === 'soft' ? 'btn-soft' : ''}" data-modal-action="${i}" ${
                  a.disabled ? 'disabled' : ''
                }>${esc(a.label)}</button>`,
            )
            .join('')}
        </div>
      </div>`;
    root.appendChild(wrap);
    openModal = { wrap, cleanup: () => resolve(null) };

    wrap.querySelectorAll('[data-modal-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = actions[Number(btn.dataset.modalAction)];
        closeModal();
        resolve(action?.value ?? true);
      });
    });
    if (dismissible) {
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) {
          closeModal();
          resolve(null);
        }
      });
    }
  });
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  openModal = null;
}

export const confirmModal = (title, text, confirmLabel = 'Да') =>
  modal({
    title,
    body: `<p>${esc(text)}</p>`,
    actions: [
      { label: 'Отмена', value: false, variant: 'ghost' },
      { label: confirmLabel, value: true },
    ],
  });

/* ---------------------------------------------------------------- элементы */

export function statBar(stat, value, { compact = false } = {}) {
  const v = Math.round(value);
  const cls = v < 20 ? 'crit' : v < 40 ? 'warn' : '';
  return `
    <div class="stat" style="--stat-color:${stat.color};--stat-bg:${stat.bg}">
      <div class="stat-head">
        <span class="ic">${stat.icon}</span>
        <span>${esc(stat.label)}</span>
        <span class="val">${v}</span>
      </div>
      <div class="bar ${cls}"><i style="width:${clamp(v)}%"></i></div>
    </div>`;
}

export function skeletonScreen() {
  return `
  <div class="screen">
    <div class="sk sk-line" style="width:55%;height:22px"></div>
    <div class="sk" style="height:300px;border-radius:28px"></div>
    <div class="sk sk-line" style="width:75%"></div>
    <div class="sk sk-card"></div>
    <div class="sk sk-card"></div>
  </div>`;
}

export function errorScreen(message, onRetryId = 'retry') {
  return `
  <div class="screen">
    <div class="card empty" style="margin-top:16vh">
      <div class="e-ic">🐾</div>
      <h4>Не получилось загрузить</h4>
      <p>${esc(message || 'Проверьте соединение и попробуйте ещё раз')}</p>
      <button class="btn" style="margin-top:14px" data-act="${onRetryId}">Повторить</button>
    </div>
  </div>`;
}

export function emptyState(icon, title, text, actionHtml = '') {
  return `
  <div class="empty">
    <div class="e-ic">${icon}</div>
    <h4>${esc(title)}</h4>
    <p>${esc(text)}</p>
    ${actionHtml}
  </div>`;
}

/** Копирование ссылки/кода с фолбэком. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Поделиться ссылкой: сначала нативный лист Telegram, затем Web Share,
 * затем копирование в буфер. Возвращает 'shared' | 'copied' | 'cancelled'.
 */
export async function shareLink({ url, text, title = 'Мопсик вдвоём' }) {
  const app = tg();
  if (app?.shareUrl) {
    try {
      app.shareUrl(url, text);
      return 'shared';
    } catch {
      /* пробуем дальше */
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  const ok = await copyText(url);
  return ok ? 'copied' : 'cancelled';
}

/** Всплывающий «+26» рядом с элементом. */
export function floatText(anchorEl, text, color = '#3fbb8c') {
  if (!anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'stat-float';
  el.textContent = text;
  el.style.color = color;
  el.style.left = `${rect.left + rect.width / 2 - 10}px`;
  el.style.top = `${rect.top - 4}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
