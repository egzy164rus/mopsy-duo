/**
 * app.js — точка входа: загрузка, авторизация, роутер, realtime.
 */
import { api, getToken, setToken } from './api.js';
import {
  state,
  applySnapshot,
  refresh,
  rerender,
  setRenderHook,
  setStreamHook,
  setView,
  cooldownLeft,
  sfx,
  toast,
} from './core.js';
import { skeletonScreen, errorScreen, esc, secLabel, haptic, tg } from './ui.js';
import authView from './views/auth.js';
import onboardingView, { startOnboarding } from './views/onboarding.js';
import homeView from './views/home.js';
import gamesView from './views/games.js';
import wardrobeView from './views/wardrobe.js';
import tasksView from './views/tasks.js';
import profileView from './views/profile.js';

const VIEWS = {
  home: homeView,
  games: gamesView,
  wardrobe: wardrobeView,
  tasks: tasksView,
  profile: profileView,
};

const NAV = [
  { id: 'home', icon: '🏠', label: 'Дом' },
  { id: 'games', icon: '🎮', label: 'Игры' },
  { id: 'wardrobe', icon: '👕', label: 'Гардероб' },
  { id: 'tasks', icon: '🎯', label: 'Задания' },
  { id: 'profile', icon: '👤', label: 'Профиль' },
];

let stream = null;
let streamPetId = null;
let refreshTimer = null;

/* ------------------------------------------------------------------ отрисовка */

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  const scrollY = window.scrollY;

  if (state.loading) {
    app.innerHTML = skeletonScreen();
    return;
  }

  if (state.bootError) {
    app.innerHTML = errorScreen(state.bootError);
    app.querySelector('[data-act="retry"]')?.addEventListener('click', () => boot({ retry: true }));
    return;
  }

  // 1. Не авторизован → экран входа
  if (!state.user) {
    app.innerHTML = authView.render();
    authView.bind(app);
    return;
  }

  // 2. Авторизован, но мопса ещё нет (или сразу после создания) → обучение
  if (!state.snapshot || state.inviteStep) {
    if (!state.onbStarted) {
      startOnboarding();
      state.onbStarted = true;
    }
    app.innerHTML = onboardingView.render();
    onboardingView.bind(app);
    return;
  }

  // 3. Основное приложение
  const view = VIEWS[state.view] || homeView;
  app.innerHTML = `
    ${view.render()}
    ${renderNav()}
  `;
  view.bind(app);
  bindNav(app);
  requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
}

function renderNav() {
  const snap = state.snapshot;
  const readyTasks = snap ? snap.tasks.filter((t) => t.progress.done && !t.claimed).length : 0;
  const badges = { tasks: readyTasks };
  return `
  <nav class="bottom-nav">
    <div class="bottom-nav-inner">
      ${NAV.map(
        (n) => `
        <button class="nav-btn ${state.view === n.id ? 'active' : ''}" data-nav="${n.id}" aria-label="${n.label}">
          <span class="n-ic">${n.icon}</span>
          <span class="n-label">${n.label}</span>
          ${badges[n.id] ? `<span class="n-badge">${badges[n.id]}</span>` : ''}
        </button>`,
      ).join('')}
    </div>
  </nav>`;
}

function bindNav(root) {
  root.querySelectorAll('[data-nav]').forEach((btn) =>
    btn.addEventListener('click', () => setView(btn.dataset.nav)),
  );
}

setRenderHook(render);
setStreamHook(connectStream);

/* -------------------------------------------------------------------- загрузка */

async function boot({ retry = false } = {}) {
  state.loading = true;
  state.bootError = null;
  state.isTelegram = Boolean(tg());
  prepareTelegram();

  // приглашение приходит двумя путями:
  //  • обычная ссылка на сайт:  ?invite=ABC123
  //  • Telegram deep link:      ?startapp=invite_ABC123 (t.me/<bot>/<app>?startapp=…)
  const params = new URLSearchParams(window.location.search);
  const startParam = tg()?.initDataUnsafe?.start_param || params.get('startapp') || '';
  const invite = params.get('invite') || (startParam.startsWith('invite_') ? startParam.slice(7) : '');
  if (invite) state.pendingInvite = String(invite).toUpperCase().slice(0, 12);

  render();

  try {
    const token = getToken();
    // Telegram: тихая авторизация по initData, если токена ещё нет
    if (!token && tg()?.initData) {
      try {
        const data = await api.telegram(tg().initData);
        setToken(data.token);
      } catch (err) {
        console.warn('[tg auth]', err.message);
      }
    }

    if (getToken()) {
      const data = await refresh({ silent: true });
      state.user = data.user;
      if (data.dailyBonus) {
        setTimeout(
          () =>
            toast(`Ежедневная награда: +${data.dailyBonus.reward} монет · серия ${data.dailyBonus.streak}`, 'success', {
              icon: '🎁',
              duration: 4200,
            }),
          800,
        );
      }
      if (data.snapshot) {
        connectStream(data.snapshot.pet.id);
        if (state.pendingInvite) {
          // приглашение для того, у кого уже есть питомец: экран переключения мопсов
          setTimeout(
            () =>
              toast('Вы уже заботитесь о мопсе. Принять приглашение можно с нового аккаунта.', 'info', {
                icon: '👫',
                duration: 5000,
              }),
            1200,
          );
          state.pendingInvite = null;
        }
      } else {
        state.onbStarted = false; // инициализируется при отрисовке
      }
    }
  } catch (err) {
    // токен протух — показываем вход, а не ошибку
    if (err.status === 401) {
      setToken(null);
      state.user = null;
    } else {
      state.bootError = retry ? err.message : null;
      if (!retry) console.warn('[boot]', err.message);
    }
  } finally {
    state.loading = false;
    render();
    startTimers();
  }
}

function prepareTelegram() {
  const app = tg();
  if (!app) return;
  try {
    app.ready();
    app.expand();
    app.setHeaderColor?.('#FFF9F2');
    app.setBackgroundColor?.('#FFF9F2');
    app.disableVerticalSwipes?.();
  } catch {
    /* старые версии клиента */
  }
}

/* ------------------------------------------------------------------ realtime */

function connectStream(petId) {
  if (stream && streamPetId === petId) return;
  disconnectStream();
  streamPetId = petId;
  const token = getToken();
  if (!token) return;

  try {
    stream = new EventSource(`/api/pets/${petId}/stream?token=${encodeURIComponent(token)}`);
  } catch {
    return;
  }

  stream.addEventListener('state', (e) => {
    try {
      const data = JSON.parse(e.data);
      applySnapshot(data.snapshot, { silent: false });
    } catch (err) {
      console.warn('[sse state]', err.message);
    }
  });

  stream.addEventListener('pulse', (e) => {
    try {
      const data = JSON.parse(e.data);
      toast(data.text, 'info', { icon: data.icon || '🐾' });
      haptic('light');
      sfx.tap();
      state.fx = { animation: data.animation || 'happy', at: Date.now() };
      render();
    } catch {
      /* ignore */
    }
  });

  stream.addEventListener('presence', (e) => {
    try {
      state.online = JSON.parse(e.data).online || [];
      render();
    } catch {
      /* ignore */
    }
  });

  stream.onerror = () => {
    // EventSource сам переподключается; при долгом обрыве подстрахуемся опросом
    if (refreshTimer) return;
    refreshTimer = setInterval(async () => {
      try {
        await refresh({ silent: false });
      } catch {
        /* ignore */
      }
    }, 20_000);
  };
}

function disconnectStream() {
  if (stream) {
    stream.close();
    stream = null;
  }
  streamPetId = null;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/* ------------------------------------------------------ тикер и обновления */

function startTimers() {
  if (startTimers.started) return;
  startTimers.started = true;

  // обновление таймеров кулдаунов каждую секунду — без перерисовки всего экрана
  setInterval(() => {
    if (state.view !== 'home' || !state.snapshot) return;
    const pet = state.snapshot.pet;
    if (!pet) return;
    state.catalog.actions.forEach((a) => {
      const btn = document.querySelector(`[data-act="action"][data-type="${a.key}"]`);
      if (!btn || btn.dataset.wake === '1') return; // «Разбудить» не показывает кулдаун
      const left = cooldownLeft(a.key);
      const cool = btn.querySelector(`[data-cool="${a.key}"]`);
      const time = btn.querySelector('.cool-time');
      if (left > 0) {
        btn.classList.add('cooling');
        if (cool) cool.style.width = `${Math.min(100, (left / a.cooldown) * 100)}%`;
        if (!time) {
          const span = document.createElement('span');
          span.className = 'cool-time';
          span.textContent = secLabel(left);
          btn.appendChild(span);
        } else {
          time.textContent = secLabel(left);
        }
      } else if (btn.classList.contains('cooling')) {
        btn.classList.remove('cooling');
        if (cool) cool.style.width = '0%';
        time?.remove();
      }
    });
  }, 1000);

  // фоновое обновление раз в 45 секунд на случай устаревших данных
  setInterval(async () => {
    if (document.hidden || !state.snapshot || !getToken()) return;
    try {
      await refresh({ silent: true });
      if (state.view === 'home') render();
    } catch {
      /* тихо */
    }
  }, 45_000);

  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && state.snapshot) {
      try {
        await refresh({ silent: true });
        render();
      } catch {
        /* тихо */
      }
    }
  });
}

/* -------------------------------------------------------------------- запуск */

window.addEventListener('beforeunload', disconnectStream);
boot();

// Экспорт для отладки в консоли браузера
window.__mopsy = { state, refresh, render };
