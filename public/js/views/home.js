/**
 * views/home.js — главный экран: комната с мопсом, показатели, действия,
 * партнёр и журнал заботы.
 */
import {
  state,
  pets,
  owners,
  partner,
  isDuo,
  runAction,
  cooldownLeft,
  inviteLink,
  openNotifications,
  setView,
  rerender,
  petNameGen,
  sfx,
  toast,
} from '../core.js';
import { esc, statBar, timeAgo, modal, copyText, secLabel, haptic, shareLink } from '../ui.js';
import { renderPug } from '../pug.js';
import { ROOM_THEMES, STATE_EMOJI, STATE_LABEL, ACTION_PROPS } from '../catalog.js';

export default {
  render() {
    const snap = state.snapshot;
    const pet = pets();
    const catalog = state.catalog;
    const theme = ROOM_THEMES[pet.room] || ROOM_THEMES.room_cozy;
    const me = snap.viewer;
    const partnerUser = partner();
    const fx = state.fx && Date.now() - state.fx.at < 2600 ? state.fx.animation : null;

    return `
    <div class="screen">
      ${renderTopbar(pet, snap, me, partnerUser)}

      <div class="home-grid">
        <div class="stack">
          <div class="stage" style="--room-sky:${theme.sky};--room-floor:${theme.floor}">
            <div class="stage-sky"></div>
            <div class="stage-decor">
              ${roomDecor(pet.room)}
              <span class="decor-bowl">🍲</span>
              <span class="decor-ball">🎾</span>
            </div>
            <div class="stage-badges">
              <div class="status-pill">
                <span class="dot" style="background:${stateColor(snap.state)}"></span>
                ${STATE_EMOJI[snap.state] || '🙂'} ${esc(snap.hint)}
              </div>
              ${
                partnerUser
                  ? `<span class="status-pill" style="padding:6px 10px;font-size:11px">
                       ${partnerUser.online ? '🟢' : '⚪️'} ${esc(partnerUser.name)}
                     </span>`
                  : `<span class="status-pill" style="padding:6px 10px;font-size:11px">🐾 соло</span>`
              }
            </div>

            <div class="stage-pug">
              ${fx && ACTION_PROPS[fx] ? `<span class="prop ${ACTION_PROPS[fx].className}">${ACTION_PROPS[fx].emoji}</span>` : ''}
              <div class="pug-wrap ${fx ? `pug-anim anim-${fx}` : ''}" data-act="pug-tap" role="button" tabindex="0" aria-label="Погладить мопса">
                ${renderPug({
                  color: pet.color,
                  equipped: pet.equipped,
                  state: snap.state,
                  sleeping: pet.sleeping,
                })}
                <div class="zzz">Z z z</div>
              </div>
            </div>

            <div class="stage-nameplate">
              <span class="lvl-ring" style="--pct:${pet.levelInfo.pct}%"><span>${pet.level}</span></span>
              <span>${esc(pet.name)}</span>
              <span style="opacity:.5">·</span>
              <span style="color:var(--coral-dark)">${STATE_LABEL[snap.state] || 'В порядке'}</span>
            </div>
          </div>

          <div class="card">
            <div class="card-title">
              <h3>💗 Состояние</h3>
              <span class="muted" style="font-size:11px">обновляется само</span>
            </div>
            <div class="stats-grid">
              ${catalog.stats.map((s) => statBar(s, snap.stats[s.key] ?? 0)).join('')}
            </div>
            ${
              snap.stats.health < 45 || snap.stats.mood < 35
                ? `<button class="btn btn-sm btn-soft btn-block" style="margin-top:12px" data-act="action" data-type="heal">💊 Полечить ${esc(
                    petNameGen(),
                  )}</button>`
                : ''
            }
          </div>

          <div class="card">
            <div class="card-title">
              <h3>🐾 Забота</h3>
              <button class="link" data-act="goto" data-view="wardrobe">Гардероб →</button>
            </div>
            <div class="actions-grid">
              ${catalog.actions
                .map((a) => {
                  const sleeping = pet.sleeping || snap.state === 'sleepy';
                  const isWake = a.key === 'sleep' && pet.sleeping;
                  const left = isWake ? 0 : cooldownLeft(a.key);
                  const dim = pet.sleeping && a.key !== 'sleep';
                  return `
                  <button class="action-btn ${left > 0 ? 'cooling' : ''} ${dim ? 'dim' : ''} ${
                    ['feed', 'water', 'play'].includes(a.key) && !pet.sleeping ? 'primary' : ''
                  } ${isWake ? 'primary' : ''}"
                    data-act="action" data-type="${a.key}" ${isWake ? 'data-wake="1"' : ''}>
                    <span class="a-ic">${isWake ? '☀️' : a.icon}</span>
                    <span class="a-label">${esc(isWake ? 'Разбудить' : a.title)}</span>
                    ${left > 0 ? `<span class="cool-time">${secLabel(left)}</span>` : ''}
                    <span class="cool" data-cool="${a.key}" style="width:${coolPct(a.key, left)}%"></span>
                  </button>`;
                })
                .join('')}
            </div>
          </div>
        </div>

        <div class="stack">
          ${isDuo() ? renderPartner(partnerUser, snap) : renderInviteCard(pet)}
          ${renderJournal(snap)}
          ${renderDailyTeaser(snap)}
        </div>
      </div>
    </div>`;
  },

  bind(root) {
    root.querySelectorAll('[data-act="action"]').forEach((btn) =>
      btn.addEventListener('click', () => runAction(btn.dataset.type, { anchor: btn })),
    );

    root.querySelector('[data-act="pug-tap"]')?.addEventListener('click', () => {
      haptic('light');
      runAction('pat');
    });

    root.querySelectorAll('[data-act="goto"]').forEach((btn) =>
      btn.addEventListener('click', () => setView(btn.dataset.view)),
    );

    root.querySelector('[data-act="bell"]')?.addEventListener('click', () => openNotifications());

    root.querySelector('[data-act="journal-all"]')?.addEventListener('click', () => {
      const snap = state.snapshot;
      modal({
        title: 'Журнал заботы',
        body: snap.actions.length
          ? `<ul class="journal" style="margin-top:10px">${snap.actions
              .map(
                (a) => `<li class="journal-item">
                  <span class="journal-ic">${a.icon}</span>
                  <span class="journal-text">${esc(a.text)}</span>
                  <span class="journal-time">${timeAgo(a.created_at)}</span>
                </li>`,
              )
              .join('')}</ul>`
          : `<div class="empty"><div class="e-ic">📖</div><h4>Журнал пуст</h4><p>Действия появятся здесь, как только вы позаботитесь о мопсе.</p></div>`,
        actions: [{ label: 'Закрыть', value: true }],
      });
    });

    root.querySelectorAll('[data-copy-invite]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const ok = await copyText(pets()?.invite_code || '');
        toast(ok ? 'Код приглашения скопирован' : 'Не удалось скопировать', ok ? 'success' : 'error', { icon: '📋' });
      }),
    );

    root.querySelectorAll('[data-share-invite]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const link = inviteLink();
        const text = `Заботимся о мопсе ${pets()?.name || ''} вместе? Присоединяйся: ${link}`;
        const result = await shareLink({ url: link, text });
        if (result === 'copied') toast('Ссылка скопирована', 'success', { icon: '🔗' });
      }),
    );
  },
};

/* -------------------------------------------------------------- подкомпоненты */

function renderTopbar(pet, snap, me, partnerUser) {
  const unread = snap.unread || 0;
  return `
  <div class="topbar">
    <div class="topbar-left">
      <div class="avatar-pill">
        ${esc(state.user?.avatar || '🐶')}
        ${partnerUser?.online ? '<span class="online-dot"></span>' : ''}
      </div>
      <div class="grow">
        <div class="pet-name-line">
          <span class="pet-name">${esc(pet.name)}</span>
          <span class="chip chip-lav">ур. ${pet.level}</span>
        </div>
        <div class="row" style="gap:6px;margin-top:3px">
          <span class="chip chip-coin" data-coins>🪙 ${pet.coins}</span>
          <span class="chip chip-mint">🔥 ${pet.streak} ${pet.streak === 1 ? 'день' : 'дн.'}</span>
        </div>
      </div>
    </div>
    <div class="topbar-right">
      <button class="btn-icon bell" data-act="bell" aria-label="Уведомления">
        🔔
        ${unread > 0 ? `<span class="badge">${unread > 9 ? '9+' : unread}</span>` : ''}
      </button>
    </div>
  </div>`;
}

function roomDecor(roomId) {
  if (roomId === 'room_space') {
    return `
      <div class="decor-window" style="background:linear-gradient(180deg,#161334,#3a3268);border-color:#6a5f9c"></div>
      <div class="decor-sun" style="background:radial-gradient(circle at 35% 35%,#fff4c4,#ffd166);box-shadow:0 0 30px rgba(255,209,102,.8)"></div>
      <div class="decor-plant">🪐</div>
      <div class="decor-frame">🚀</div>`;
  }
  if (roomId === 'room_beach') {
    return `
      <div class="decor-window" style="background:linear-gradient(180deg,#9fd8ff,#dff3ff)"></div>
      <div class="decor-sun" style="background:radial-gradient(circle at 35% 35%,#fff3b0,#ffd166)"></div>
      <div class="decor-plant">🌴</div>
      <div class="decor-frame">🐚</div>`;
  }
  if (roomId === 'room_garden') {
    return `
      <div class="decor-window" style="background:linear-gradient(180deg,#bfe9ff,#e9fbe0)"></div>
      <div class="decor-sun"></div>
      <div class="decor-plant">🌻</div>
      <div class="decor-frame">🦋</div>`;
  }
  if (roomId === 'room_winter') {
    return `
      <div class="decor-window" style="background:linear-gradient(180deg,#cfeaff,#ffffff)"></div>
      <div class="decor-sun" style="background:radial-gradient(circle at 35% 35%,#fff,#e6f3ff);box-shadow:0 0 22px rgba(200,230,255,.9)"></div>
      <div class="decor-plant">🎄</div>
      <div class="decor-frame">❄️</div>`;
  }
  return `
    <div class="decor-window"></div>
    <div class="decor-sun"></div>
    <div class="decor-plant">🪴</div>
    <div class="decor-frame">🖼️</div>`;
}

const stateColor = (s) =>
  ({ happy: '#6FD3AB', normal: '#6FD3AB', hungry: '#FFB44D', sleepy: '#A79BF0', sad: '#FF8FB1', sick: '#EB5757', dirty: '#8B7BE8' }[s] ||
  '#6FD3AB');

function coolPct(type, left) {
  const total = state.catalog.actions.find((a) => a.key === type)?.cooldown || 1;
  return Math.max(0, Math.min(100, (left / total) * 100));
}

function renderPartner(p, snap) {
  // показываем последнее действие именно партнёра
  const last = (snap.actions || []).find((a) => a.user_id !== snap.viewer.id) || snap.lastAction;
  return `
  <div class="card">
    <div class="card-title"><h3>👫 Ваша пара</h3>
      <span class="chip ${p?.online ? 'chip-mint' : ''}">${p?.online ? 'онлайн' : 'офлайн'}</span>
    </div>
    <div class="partner-card">
      <div class="ava">${esc(p?.avatar || '🧑')}</div>
      <div class="grow">
        <b>${esc(p?.name || 'Партнёр')}</b>
        <small>${last ? esc(last.text) : 'Пока без активности'} · ${last ? timeAgo(last.at) : ''}</small>
      </div>
    </div>
    <div class="row" style="margin-top:12px;gap:8px">
      <button class="btn btn-sm btn-soft grow" data-copy-invite>Пригласить ещё</button>
      <button class="btn btn-sm btn-ghost grow" data-share-invite>Поделиться</button>
    </div>
  </div>`;
}

function renderInviteCard(pet) {
  return `
  <div class="card">
    <div class="card-title"><h3>💌 Пригласите второго хозяина</h3></div>
    <p class="muted" style="font-size:12.5px;line-height:1.45">
      Мопсику веселее вдвоём! Отправьте код — и забота станет общей.
    </p>
    <div class="invite-code" style="margin-top:12px;font-size:22px;letter-spacing:4px">${esc(pet.invite_code)}</div>
    <div class="row" style="margin-top:10px;gap:8px">
      <button class="btn btn-sm btn-soft grow" data-copy-invite>📋 Код</button>
      <button class="btn btn-sm btn-mint grow" data-share-invite>Отправить</button>
    </div>
  </div>`;
}

function renderJournal(snap) {
  const items = (snap.actions || []).slice(0, 6);
  return `
  <div class="card">
    <div class="card-title">
      <h3>📖 Журнал заботы</h3>
      ${snap.actions.length > 6 ? '<button class="link" data-act="journal-all">Все</button>' : ''}
    </div>
    ${
      items.length
        ? `<ul class="journal">
            ${items
              .map(
                (a) => `<li class="journal-item">
                  <span class="journal-ic">${a.icon}</span>
                  <span class="journal-text">${esc(a.text)}</span>
                  <span class="journal-time">${timeAgo(a.created_at)}</span>
                </li>`,
              )
              .join('')}
          </ul>`
        : `<div class="empty" style="padding:12px 0"><div class="e-ic">🐾</div><h4>Пока тихо</h4><p>Покормите или погладьте мопса — и здесь появится первая запись.</p></div>`
    }
  </div>`;
}

function renderDailyTeaser(snap) {
  const done = snap.tasks.filter((t) => t.progress.done).length;
  const claimed = snap.tasks.filter((t) => t.claimed).length;
  const ready = snap.tasks.filter((t) => t.progress.done && !t.claimed).length;
  return `
  <div class="card" style="background:linear-gradient(155deg,#fff,#fff3e6)">
    <div class="card-title">
      <h3>🎯 Задания дня</h3>
      <button class="link" data-act="goto" data-view="tasks">Открыть</button>
    </div>
    <div class="row" style="gap:10px">
      <div class="grow">
        <div class="h3">${done} из ${snap.tasks.length} выполнено</div>
        <div class="muted" style="margin-top:2px">
          ${ready > 0 ? `${ready} награда ждёт 🎁` : claimed === snap.tasks.length ? 'Все награды собраны!' : 'Продолжайте заботу'}
        </div>
      </div>
      <div style="font-size:26px">${ready > 0 ? '🎁' : '📅'}</div>
    </div>
  </div>`;
}
