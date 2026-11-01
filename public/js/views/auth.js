/** views/auth.js — экран входа: Telegram, браузерная регистрация, демо-профили. */
import { api, setToken } from '../api.js';
import { state, refresh, rerender, sfx, toast } from '../core.js';

/** новый вход — обучение проходим заново (и подхватываем приглашение из deep link) */
const resetOnboarding = () => {
  state.onbStarted = false;
};
import { esc, haptic, tg } from '../ui.js';
import { renderPug } from '../pug.js';

let mode = 'login';
let busy = false;
let error = '';

const isTelegram = () => Boolean(tg()?.initData);

export default {
  render() {
    const tgApp = tg();
    return `
    <div class="screen auth">
      <div class="auth-hero">
        <div class="auth-pug">${renderPug({ color: 'fawn', state: 'happy', equipped: { hat: 'hat_party' } })}</div>
        <h1 class="auth-title">Мопсик <span>вдвоём</span></h1>
        <p class="auth-sub">Добрый тамагочи для двоих: заботьтесь об одном мопсе вместе — и он ответит любовью.</p>
      </div>

      <div class="auth-features">
        <div class="auth-feature"><span>🍖</span>Корми и гуляй</div>
        <div class="auth-feature"><span>👫</span>Синхронно вдвоём</div>
        <div class="auth-feature"><span>🎮</span>Игры и наряды</div>
      </div>

      ${
        isTelegram()
          ? `<button class="btn btn-block btn-sky" data-act="tg">Войти через Telegram</button>
             <div class="divider">или по логину</div>`
          : ''
      }

      <div class="card">
        <div class="tabs" style="margin-bottom:14px">
          <button data-tab="login" class="${mode === 'login' ? 'active' : ''}">Вход</button>
          <button data-tab="register" class="${mode === 'register' ? 'active' : ''}">Регистрация</button>
        </div>

        <form id="auth-form" class="stack" novalidate>
          <div class="field">
            <label for="f-username">Логин</label>
            <input class="input ${error ? 'input-error' : ''}" id="f-username" name="username" autocomplete="username"
              placeholder="naprimer: anya" value="${esc(state.lastUsername || '')}" />
          </div>
          ${
            mode === 'register'
              ? `<div class="field">
                   <label for="f-name">Как вас зовут</label>
                   <input class="input" id="f-name" name="displayName" placeholder="Аня" maxlength="24" />
                 </div>`
              : ''
          }
          <div class="field">
            <label for="f-password">Пароль</label>
            <input class="input ${error ? 'input-error' : ''}" id="f-password" name="password" type="password"
              autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" placeholder="••••••" />
          </div>
          ${error ? `<div class="error-text">${esc(error)}</div>` : ''}
          <button class="btn btn-block" type="submit" ${busy ? 'aria-busy="true"' : ''}>
            ${busy ? '<span class="spin">⏳</span> Секунду…' : mode === 'login' ? 'Войти в игру' : 'Создать аккаунт'}
          </button>
        </form>

        ${state.config?.demo === false ? '' : `<div class="divider" style="margin:16px 0 12px">демо-доступ</div>
        <div class="demo-row">
          <button class="demo-btn" data-demo="anya">
            <span class="ava">👩</span>
            <span><b>Аня</b><small>демо-игрок</small></span>
          </button>
          <button class="demo-btn" data-demo="ilya">
            <span class="ava">🧑</span>
            <span><b>Илья</b><small>второй игрок</small></span>
          </button>
        </div>
        <p class="muted center" style="margin-top:10px;font-size:11.5px">
          Демо-пара уже заботится о мопсе Бублике — зайдите за любого и посмотрите синхронизацию.
        </p>`}
      </div>

      <p class="muted center" style="font-size:11px;line-height:1.5">
        Продолжая, вы соглашаетесь заботиться о мопсике 🐾
      </p>
    </div>`;
  },

  bind(root) {
    root.querySelectorAll('[data-tab]').forEach((btn) =>
      btn.addEventListener('click', () => {
        mode = btn.dataset.tab;
        error = '';
        sfx.tap();
        rerender();
        setTimeout(() => root.querySelector('#f-username')?.focus(), 60);
      }),
    );

    root.querySelectorAll('[data-demo]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        rerender();
        try {
          const data = await api.demo(btn.dataset.demo);
          setToken(data.token);
          resetOnboarding();
          await refresh();
          sfx.success();
          toast(`С возвращением, ${data.user.name}!`, 'success', { icon: '👋' });
        } catch (err) {
          error = err.message;
          sfx.error();
          toast(err.message, 'error');
        } finally {
          busy = false;
          rerender();
        }
      }),
    );

    root.querySelector('[data-act="tg"]')?.addEventListener('click', async () => {
      const initData = tg()?.initData;
      if (!initData) {
        toast('Откройте игру внутри Telegram', 'info');
        return;
      }
      try {
        const data = await api.telegram(initData);
        setToken(data.token);
        resetOnboarding();
        await refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    const form = root.querySelector('#auth-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const fd = new FormData(form);
      const username = String(fd.get('username') || '').trim();
      const password = String(fd.get('password') || '');
      const displayName = String(fd.get('displayName') || '').trim();
      state.lastUsername = username;

      if (username.length < 3) {
        error = 'Логин — минимум 3 символа';
        sfx.error();
        rerender();
        return;
      }
      if (password.length < 4) {
        error = 'Пароль — минимум 4 символа';
        sfx.error();
        rerender();
        return;
      }

      busy = true;
      error = '';
      rerender();
      try {
        const data =
          mode === 'login'
            ? await api.login({ username, password })
            : await api.register({ username, password, displayName: displayName || username });
        setToken(data.token);
        resetOnboarding();
        await refresh();
        sfx.success();
        haptic('success');
        toast(mode === 'login' ? 'С возвращением!' : 'Аккаунт создан!', 'success', { icon: '🎉' });
      } catch (err) {
        error = err.message;
        sfx.error();
      } finally {
        busy = false;
        rerender();
      }
    });
  },
};
