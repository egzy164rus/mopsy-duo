/** views/tasks.js — ежедневные задания, серия дней, достижения, уровень. */
import { state, pets, claimTask, rerender, sfx } from '../core.js';
import { esc, modal, plural } from '../ui.js';

export default {
  render() {
    const snap = state.snapshot;
    const pet = pets();
    const catalog = state.catalog;
    const ready = snap.tasks.filter((t) => t.progress.done && !t.claimed).length;

    return `
    <div class="screen">
      <div class="row-between">
        <div>
          <h1 class="h1">Задания</h1>
          <p class="muted" style="margin-top:4px">${ready > 0 ? `${ready} награда ждёт вас 🎁` : 'Новые задания каждый день'}</p>
        </div>
        <span class="chip chip-coin">🪙 ${pet.coins}</span>
      </div>

      <div class="card">
        <div class="card-title">
          <h3>🎯 Задания на сегодня</h3>
          <span class="muted" style="font-size:11px">${snap.tasks.filter((t) => t.claimed).length}/${snap.tasks.length}</span>
        </div>
        <ul>
          ${snap.tasks.map((t) => taskRow(t)).join('')}
        </ul>
        ${
          snap.tasks.some((t) => t.is_coop)
            ? `<p class="muted" style="font-size:11.5px;margin-top:6px">👫 Совместное задание — выполнено, если постарались оба хозяина</p>`
            : `<div class="row" style="gap:8px;margin-top:10px;align-items:flex-start">
                 <span>👫</span>
                 <p class="muted" style="font-size:11.5px;line-height:1.4">Пригласите второго хозяина — появятся совместные задания</p>
               </div>`
        }
      </div>

      ${streakCard(pet)}
      ${levelCard(pet, catalog)}

      <div class="card">
        <div class="card-title">
          <h3>🏆 Достижения</h3>
          <span class="muted" style="font-size:11px">${snap.achievements.length}/${catalog.achievements.length}</span>
        </div>
        <div class="ach-grid">
          ${catalog.achievements
            .map((a) => {
              const unlocked = snap.achievements.includes(a.code);
              return `<button class="ach ${unlocked ? 'unlocked' : ''}" data-ach="${a.code}" title="${esc(a.title)}">
                ${a.icon}${unlocked ? '<span class="ach-tick">✅</span>' : ''}
              </button>`;
            })
            .join('')}
        </div>
        <p class="muted" style="font-size:11.5px;margin-top:10px">Нажмите на медаль, чтобы узнать, как её получить</p>
      </div>
    </div>`;
  },

  bind(root) {
    root.querySelectorAll('[data-claim]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        btn.setAttribute('aria-busy', 'true');
        sfx.tap();
        await claimTask(btn.dataset.claim);
      }),
    );

    root.querySelectorAll('[data-ach]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const a = state.catalog.achievements.find((x) => x.code === btn.dataset.ach);
        if (!a) return;
        const unlocked = state.snapshot.achievements.includes(a.code);
        sfx.tap();
        modal({
          title: a.title,
          body: `<p>${esc(a.desc)}</p>
            <div class="row" style="gap:8px;margin-top:12px">
              <span class="chip ${unlocked ? 'chip-mint' : ''}">${unlocked ? '✅ получено' : '🔒 не открыто'}</span>
              <span class="chip chip-coin">🪙 ${a.coins}</span>
              <span class="chip chip-lav">⭐ ${a.xp} опыта</span>
            </div>`,
          actions: [{ label: 'Закрыть', value: true }],
        });
      }),
    );
  },
};

/* ---------------------------------------------------------------- компоненты */

function taskRow(task) {
  const { value, target, done } = task.progress;
  const pct = Math.round((value / target) * 100);
  const canClaim = done && !task.claimed;
  return `
  <li class="task-item ${task.claimed ? 'task-done' : ''}">
    <span class="task-ic">${task.icon}</span>
    <div class="task-body">
      <div class="task-title">${esc(task.title)}${task.is_coop ? ' 👫' : ''}</div>
      <div class="bar" style="--stat-color:${done ? '#6FD3AB' : '#FFB98A'};--stat-bg:#F5EAE1">
        <i style="width:${pct}%"></i>
      </div>
      <div class="task-meta">
        <span>${value}/${target}</span>
        <span>·</span>
        <span>🪙 ${task.coins}</span>
        <span>⭐ ${task.xp}</span>
      </div>
    </div>
    ${
      task.claimed
        ? `<span class="chip chip-mint" style="height:26px">✓</span>`
        : canClaim
          ? `<button class="task-claim" data-claim="${task.id}">Забрать</button>`
          : `<span class="muted" style="font-size:11px;font-weight:900">${target - value} ост.</span>`
    }
  </li>`;
}

function streakCard(pet) {
  const days = Math.min(7, Math.max(pet.streak, 0));
  const rewards = state.catalog.dailyRewards;
  return `
  <div class="streak-card">
    <div class="flame">🔥</div>
    <h3>Серия заботы: ${pet.streak} ${plural(pet.streak, 'день', 'дня', 'дней')}</h3>
    <p style="font-size:12.5px;font-weight:800;opacity:.85;margin-top:4px">
      Заходите каждый день — награда растёт. Не прерывайте серию!
    </p>
    <div class="streak-days">
      ${rewards
        .map(
          (r, i) => `<div class="streak-day ${i < days ? 'done' : ''}" title="${r} монет">
            <span>${i < days ? '✓' : `🪙${r}`}</span>
          </div>`,
        )
        .join('')}
    </div>
  </div>`;
}

function levelCard(pet, catalog) {
  const info = pet.levelInfo;
  return `
  <div class="card">
    <div class="card-title">
      <h3>⭐ Уровень ${info.level}</h3>
      <span class="muted" style="font-size:11px">${info.xp}/${info.need} опыта</span>
    </div>
    <div class="bar" style="--stat-color:#A79BF0;--stat-bg:#EFECFF;height:12px">
      <i style="width:${info.pct}%"></i>
    </div>
    <div class="row" style="gap:8px;margin-top:12px">
      <span class="chip chip-lav">💞 ${pet.care_points} очков заботы</span>
      <span class="chip chip-mint">🏆 ${state.snapshot.achievements.length}/${catalog.achievements.length} достижений</span>
    </div>
  </div>`;
}
