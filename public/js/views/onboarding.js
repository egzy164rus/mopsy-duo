/**
 * views/onboarding.js — первый запуск: короткое обучение → создание мопса →
 * приглашение второго игрока.
 */
import { api } from '../api.js';
import { state, refresh, rerender, sfx, toast, pets, inviteLink } from '../core.js';
import { esc, copyText, shareLink, haptic } from '../ui.js';
import { renderPug } from '../pug.js';
import { ONBOARDING, PUG_COLORS } from '../catalog.js';

let step = 'slides';
let slide = 0;
let name = '';
let color = 'fawn';
let busy = false;
let error = '';
let joinCode = '';
let created = false;

export function startOnboarding() {
  step = 'slides';
  slide = 0;
  created = false;
  error = '';
  joinCode = (state.pendingInvite || '').toUpperCase();
}

export default {
  render() {
    if (step === 'slides') return renderSlides();
    if (step === 'create') return renderCreate();
    return renderInvite();
  },

  bind(root) {
    /* --- слайды --- */
    root.querySelectorAll('[data-next]').forEach((b) =>
      b.addEventListener('click', () => {
        sfx.tap();
        if (slide < ONBOARDING.length - 1) {
          slide += 1;
          rerender();
        } else {
          step = 'create';
          rerender();
          setTimeout(() => root.querySelector('#pet-name')?.focus(), 80);
        }
      }),
    );
    root.querySelector('[data-skip]')?.addEventListener('click', () => {
      sfx.tap();
      step = 'create';
      rerender();
    });

    /* --- создание мопса --- */
    root.querySelectorAll('[data-color]').forEach((b) =>
      b.addEventListener('click', () => {
        color = b.dataset.color;
        sfx.tap();
        rerender();
      }),
    );
    root.querySelector('#pet-name')?.addEventListener('input', (e) => {
      name = e.target.value.slice(0, 20);
    });
    root.querySelector('#create-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const clean = name.trim();
      if (clean.length < 2) {
        error = 'Придумайте имя — минимум 2 буквы';
        sfx.error();
        rerender();
        return;
      }
      busy = true;
      error = '';
      rerender();
      try {
        const res = await api.createPet({ name: clean, color });
        await refresh();
        created = true;
        step = 'invite';
        state.inviteStep = true;
        sfx.success();
        haptic('success');
        toast(`${clean} уже ждёт вас дома! 🏡`, 'success', { icon: '🐶' });
      } catch (err) {
        error = err.message;
        sfx.error();
      } finally {
        busy = false;
        rerender();
      }
    });

    /* --- вход по коду приглашения --- */
    root.querySelector('#join-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const code = joinCode.trim().toUpperCase();
      if (code.length < 4) {
        error = 'Код состоит из 6 символов';
        rerender();
        return;
      }
      busy = true;
      error = '';
      rerender();
      try {
        await api.joinPet({ code });
        state.pendingInvite = null;
        await refresh();
        sfx.success();
        toast('Вы присоединились к заботе о мопсе 👫', 'success');
      } catch (err) {
        error = err.message;
        sfx.error();
      } finally {
        busy = false;
        rerender();
      }
    });
    root.querySelector('#join-code-input')?.addEventListener('input', (e) => {
      joinCode = e.target.value.toUpperCase();
    });

    /* --- приглашение --- */
    root.querySelector('[data-copy-code]')?.addEventListener('click', async (e) => {
      const ok = await copyText(pets()?.invite_code || '');
      sfx.tap();
      toast(ok ? 'Код скопирован' : 'Не удалось скопировать', ok ? 'success' : 'error', { icon: '📋' });
      if (ok) e.currentTarget.classList.add('btn-mint');
    });
    root.querySelector('[data-copy-link]')?.addEventListener('click', async () => {
      const ok = await copyText(inviteLink());
      toast(ok ? 'Ссылка скопирована — отправьте другу' : 'Не удалось скопировать', ok ? 'success' : 'error', {
        icon: '🔗',
      });
    });
    root.querySelector('[data-share]')?.addEventListener('click', async () => {
      const link = inviteLink();
      const text = `Заботимся о мопсе ${pets()?.name || ''} вместе? Присоединяйся: ${link}`;
      const result = await shareLink({ url: link, text });
      if (result === 'copied') toast('Ссылка скопирована', 'success', { icon: '🔗' });
    });
    root.querySelector('[data-start]')?.addEventListener('click', () => {
      state.view = 'home';
      state.inviteStep = false;
      step = 'slides';
      slide = 0;
      sfx.happy();
      rerender();
    });
  },
};

/* ------------------------------------------------------------------ разметка */

/** Небольшой «снимок» интерфейса, чтобы экран обучения не пустовал. */
function slidePreview(index) {
  if (index === 0) {
    return `
    <div class="card" style="width:100%;text-align:left;box-shadow:var(--shadow-md)">
      <div class="card-title"><h3>💗 Состояние мопса</h3><span class="muted" style="font-size:11px">пример</span></div>
      <div class="stats-grid">
        ${[
          ['🍖', 'Сытость', 86, '#F2994A'],
          ['💧', 'Питьё', 72, '#4FB6E8'],
          ['😊', 'Настроение', 94, '#F27AA1'],
          ['⚡', 'Энергия', 61, '#F2C94C'],
        ]
          .map(
            ([ic, label, v, color]) => `
          <div class="stat" style="--stat-color:${color};--stat-bg:#F5EAE1">
            <div class="stat-head"><span class="ic">${ic}</span><span>${label}</span><span class="val">${v}</span></div>
            <div class="bar"><i style="width:${v}%"></i></div>
          </div>`,
          )
          .join('')}
      </div>
    </div>`;
  }
  if (index === 1) {
    return `
    <div class="card" style="width:100%;text-align:left;box-shadow:var(--shadow-md)">
      <div class="row" style="gap:10px">
        <div class="avatar-pill">👩</div>
        <div class="avatar-pill" style="margin-left:-14px">🧑<span class="online-dot"></span></div>
        <div class="grow">
          <b style="font-size:13.5px">Аня и Илья</b>
          <div class="muted" style="font-size:11.5px">🟢 синхронизировано только что</div>
        </div>
        <span class="chip chip-mint">2/2</span>
      </div>
      <div class="row" style="gap:6px;margin-top:12px;flex-wrap:wrap">
        <span class="chip">🍖 Аня покормила</span>
        <span class="chip chip-lav">🎾 Илья поиграл</span>
        <span class="chip chip-mint">🎁 +40 монет</span>
      </div>
    </div>`;
  }
  return `
    <div class="card" style="width:100%;text-align:left;box-shadow:var(--shadow-md)">
      <div class="card-title"><h3>🎮 Мини-игры</h3><span class="muted" style="font-size:11px">10–25 секунд</span></div>
      <div class="row" style="gap:8px">
        ${[
          ['🦴', 'Косточка'],
          ['🍪', 'Лакомство'],
          ['🐾', 'Прыжки'],
          ['🪢', 'Канат'],
        ]
          .map(
            ([ic, t]) => `<div style="flex:1;text-align:center">
              <div style="font-size:26px">${ic}</div>
              <div class="muted" style="font-size:10.5px;margin-top:2px">${t}</div>
            </div>`,
          )
          .join('')}
      </div>
    </div>`;
}

function renderSlides() {
  const s = ONBOARDING[slide];
  return `
  <div class="screen">
    <div class="onb">
      ${
        slide === 0
          ? `<div class="onb-pug">${renderPug({ color: 'fawn', state: 'happy' })}</div>`
          : `<div class="onb-art">${s.art}</div>`
      }
      <div>
        <h1>${esc(s.title)}</h1>
        <p style="margin-top:8px">${esc(s.text)}</p>
      </div>
      ${slidePreview(slide)}
      <div class="onb-grow"></div>
      <div class="onb-dots">
        ${ONBOARDING.map((_, i) => `<span class="${i === slide ? 'active' : ''}"></span>`).join('')}
      </div>
      <div class="onb-actions">
        <button class="btn btn-block" data-next>${slide === ONBOARDING.length - 1 ? 'Завести мопса' : 'Дальше'}</button>
        ${slide < ONBOARDING.length - 1 ? '<button class="skip-link" data-skip>Пропустить обучение</button>' : ''}
      </div>
    </div>
  </div>`;
}

function renderCreate() {
  return `
  <div class="screen">
    <div class="onb" style="justify-content:flex-start;padding-top:8px">
      <div style="width:180px;height:190px;margin:0 auto">
        ${renderPug({ color, state: 'happy' })}
      </div>
      <div>
        <h1>Как назовём мопса?</h1>
        <p style="margin-top:6px">Имя можно придумать вместе со вторым хозяином.</p>
      </div>

      <form id="create-form" class="stack" style="text-align:left;width:100%">
        <div class="field">
          <label for="pet-name">Имя мопса</label>
          <input class="input ${error ? 'input-error' : ''}" id="pet-name" placeholder="Бублик" maxlength="20" value="${esc(
            name,
          )}" />
          ${error ? `<div class="error-text">${esc(error)}</div>` : ''}
        </div>

        <div class="field">
          <label>Окрас</label>
          <div class="row" style="gap:8px">
            ${PUG_COLORS.map(
              (c) => `
              <button type="button" data-color="${c.id}" class="chip" style="height:40px;padding:0 12px;gap:7px;
                ${color === c.id ? 'box-shadow:0 0 0 2.5px #FF7A59 inset;background:#fff3ea' : 'background:#fff'}">
                <span style="width:16px;height:16px;border-radius:99px;background:${c.body};display:inline-block;border:1.5px solid rgba(0,0,0,.08)"></span>
                ${esc(c.name)}
              </button>`,
            ).join('')}
          </div>
        </div>

        <button class="btn btn-block" type="submit" ${busy ? 'aria-busy="true"' : ''}>
          ${busy ? 'Создаём…' : 'Завести мопса 🐾'}
        </button>
      </form>

      <div class="divider" style="width:100%">уже есть приглашение?</div>
      <form id="join-form" class="stack" style="width:100%">
        <div class="field" style="text-align:left">
          <label for="join-code-input">Код приглашения</label>
          <input class="input" id="join-code-input" placeholder="BUBLIK" maxlength="8" style="letter-spacing:3px;text-transform:uppercase"
            value="${esc(joinCode)}" />
        </div>
        <button class="btn btn-block btn-ghost" type="submit" ${busy ? 'aria-busy="true"' : ''}>Присоединиться к мопсу</button>
      </form>
    </div>
  </div>`;
}

function renderInvite() {
  const pet = pets();
  const link = inviteLink();
  return `
  <div class="screen">
    <div class="onb" style="justify-content:flex-start;padding-top:4px">
      <div class="onb-art" style="font-size:64px">💌</div>
      <div>
        <h1>Пригласите второго хозяина</h1>
        <p style="margin-top:6px">Мопсу гораздо веселее, когда о нём заботятся вдвоём. Отправьте код другу, партнёру или ребёнку.</p>
      </div>

      <div class="card" style="width:100%;text-align:left">
        <div class="card-title"><h3>🎫 Код приглашения</h3></div>
        <div class="invite-code">${esc(pet?.invite_code || '—')}</div>
        <div class="row" style="margin-top:10px;gap:8px">
          <button class="btn btn-sm btn-soft grow" data-copy-code>Скопировать код</button>
          <button class="btn btn-sm btn-soft grow" data-share>Отправить</button>
        </div>
        <div class="invite-link" style="margin-top:10px">
          <span>${esc(link)}</span>
          <button class="btn btn-sm btn-soft" data-copy-link style="flex:none">Ссылка</button>
        </div>
        <p class="muted" style="margin-top:10px;font-size:12px">
          Ссылка откроет игру и сразу предложит присоединиться к заботе о мопсе.
        </p>
      </div>

      <div class="card-tight" style="width:100%">
        <div class="row" style="gap:8px;align-items:flex-start">
          <span style="font-size:18px">💡</span>
          <p class="muted" style="font-size:12.5px;line-height:1.45">
            Пока партнёр не подключился, играйте один — прогресс сохранится, а второй игрок присоединится в любой момент.
          </p>
        </div>
      </div>

      <div class="onb-grow"></div>
      <div class="onb-actions" style="width:100%">
        <button class="btn btn-block btn-mint" data-start>Начать играть</button>
      </div>
    </div>
  </div>`;
}
