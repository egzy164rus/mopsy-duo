/** views/profile.js — профиль игрока, пара, настройки, выход. */
import { api } from '../api.js';
import { state, pets, owners, partner, inviteLink, rerender, sfx, toast } from '../core.js';
import { esc, modal, copyText, tg, confirmModal, plural, shareLink } from '../ui.js';
import { sfx as sounds } from '../sfx.js';
import { ONBOARDING } from '../catalog.js';

export default {
  render() {
    const snap = state.snapshot;
    const pet = pets();
    const me = snap.viewer;
    const partnerUser = partner();
    const daysTogether = Math.max(1, Math.round((Date.now() - pet.created_at) / 86_400_000));

    return `
    <div class="screen">
      <div class="profile-hero">
        <div class="row" style="gap:12px">
          <div class="ava">${esc(me.avatar || '🐶')}</div>
          <div class="grow">
            <h2>${esc(me.name)}</h2>
            <small>@${esc(state.user?.username || 'player')} · ${me.isOwner ? 'хозяин мопса' : 'гость'}</small>
          </div>
        </div>
        <div class="metrics">
          <div class="metric"><b>${pet.level}</b><small>уровень</small></div>
          <div class="metric"><b>${pet.care_points}</b><small>заботы</small></div>
          <div class="metric"><b>${pet.streak}</b><small>${plural(pet.streak, 'день', 'дня', 'дней')}</small></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <h3>🐶 ${esc(pet.name)}</h3>
          <span class="chip chip-coin">🪙 ${pet.coins}</span>
        </div>
        <div class="stack" style="gap:6px">
          <div class="row-between">
            <span class="muted">Опыт</span>
            <span style="font-size:12.5px;font-weight:900">${pet.levelInfo.xp}/${pet.levelInfo.need}</span>
          </div>
          <div class="bar" style="--stat-color:#A79BF0;--stat-bg:#EFECFF"><i style="width:${pet.levelInfo.pct}%"></i></div>
          <div class="row-between" style="margin-top:4px">
            <span class="muted">Вместе уже</span>
            <span style="font-size:12.5px;font-weight:900">${daysTogether} ${plural(daysTogether, 'день', 'дня', 'дней')}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><h3>👫 Хозяева</h3><span class="muted" style="font-size:11px">${owners().length}/2</span></div>
        ${owners()
          .map(
            (o) => `
          <div class="partner-card" style="margin-bottom:10px">
            <div class="ava">${esc(o.avatar)}</div>
            <div class="grow">
              <b>${esc(o.name)} ${o.isMe ? '<span class="chip" style="height:20px;font-size:10px">вы</span>' : ''}</b>
              <small>${o.isMe ? '🟢 это вы — в игре' : o.online ? '🟢 в игре сейчас' : '⚪️ не в сети'}</small>
            </div>
          </div>`,
          )
          .join('')}
        ${
          !partnerUser
            ? `<div class="invite-code" style="font-size:20px;letter-spacing:4px">${esc(pet.invite_code)}</div>
               <div class="row" style="gap:8px;margin-top:10px">
                 <button class="btn btn-sm btn-soft grow" data-copy-code>📋 Скопировать код</button>
                 <button class="btn btn-sm btn-mint grow" data-share-link>Отправить ссылку</button>
               </div>`
            : `<button class="btn btn-sm btn-ghost btn-block" data-copy-link>🔗 Скопировать ссылку для друга</button>`
        }
      </div>

      <div class="card">
        <div class="card-title"><h3>⚙️ Настройки</h3></div>
        <button class="list-row" data-toggle-sound>
          <span class="lr-ic">${sounds.muted ? '🔇' : '🔊'}</span>
          <span class="lr-body"><b>Звуки игры</b><small>Приятные акценты и реакции мопса</small></span>
          <span class="switch ${sounds.muted ? '' : 'on'}"></span>
        </button>
        <button class="list-row" data-haptic-test>
          <span class="lr-ic">📳</span>
          <span class="lr-body"><b>Тактильный отклик</b><small>${tg()?.initData ? 'Работает в Telegram' : 'Доступен в приложении Telegram'}</small></span>
          <span class="lr-right">${tg()?.initData ? 'вкл' : '—'}</span>
        </button>
        <button class="list-row" data-tutorial>
          <span class="lr-ic">🎓</span>
          <span class="lr-body"><b>Как играть</b><small>Короткое обучение за 20 секунд</small></span>
          <span class="lr-right">→</span>
        </button>
        <button class="list-row" data-logout>
          <span class="lr-ic">🚪</span>
          <span class="lr-body"><b>Выйти из аккаунта</b><small>Прогресс сохранится на сервере</small></span>
          <span class="lr-right">→</span>
        </button>
      </div>

      <div class="card" style="background:linear-gradient(150deg,#fff,#f7f1ff)">
        <div class="card-title"><h3>💜 О игре</h3><span class="chip chip-lav">v1.0</span></div>
        <p class="muted" style="font-size:12.5px;line-height:1.5">
          «Мопсик вдвоём» — добрый тамагочи для двоих. Никаких агрессивных покупок и pay-to-win:
          только забота, мини-игры и милые наряды. Состояние мопса хранится на сервере и синхронизируется между игроками.
        </p>
      </div>
    </div>`;
  },

  bind(root, ctx = {}) {
    root.querySelector('[data-toggle-sound]')?.addEventListener('click', () => {
      const muted = sounds.toggleMute();
      toast(muted ? 'Звук выключен' : 'Звук включён', 'info', { icon: muted ? '🔇' : '🔊' });
      rerender();
    });

    root.querySelector('[data-haptic-test]')?.addEventListener('click', () => {
      const app = tg();
      if (app?.HapticFeedback) {
        app.HapticFeedback.impactOccurred('medium');
        toast('Вибрация сработала 📳', 'success');
      } else {
        toast('Откройте игру в Telegram, чтобы почувствовать отклик', 'info');
      }
    });

    root.querySelector('[data-tutorial]')?.addEventListener('click', () => {
      modal({
        title: 'Как играть',
        body: `<ul class="stack" style="margin-top:8px;gap:12px">
          ${ONBOARDING.map(
            (s) => `<li class="row" style="gap:10px;align-items:flex-start">
              <span style="font-size:22px">${s.art}</span>
              <div><b style="font-size:13.5px">${esc(s.title)}</b>
              <p class="muted" style="font-size:12.5px;line-height:1.4;margin-top:2px">${esc(s.text)}</p></div>
            </li>`,
          ).join('')}
          <li class="row" style="gap:10px;align-items:flex-start">
            <span style="font-size:22px">⏳</span>
            <div><b style="font-size:13.5px">Показатели меняются со временем</b>
            <p class="muted" style="font-size:12.5px;line-height:1.4;margin-top:2px">Даже когда вы не в игре, мопс скучает, хочет пить и спать. Заходите почаще — или вдвоём по очереди.</p></div>
          </li>
        </ul>`,
        actions: [{ label: 'Понятно', value: true }],
      });
    });

    root.querySelector('[data-copy-code]')?.addEventListener('click', async () => {
      const ok = await copyText(pets().invite_code);
      toast(ok ? 'Код скопирован' : 'Не удалось скопировать', ok ? 'success' : 'error', { icon: '📋' });
    });

    const shareOrCopy = async () => {
      const link = inviteLink();
      const text = `Заботимся о мопсе ${pets().name} вместе? Присоединяйся: ${link}`;
      const result = await shareLink({ url: link, text });
      if (result === 'copied') toast('Ссылка скопирована', 'success', { icon: '🔗' });
    };
    root.querySelector('[data-share-link]')?.addEventListener('click', shareOrCopy);
    root.querySelector('[data-copy-link]')?.addEventListener('click', shareOrCopy);

    root.querySelector('[data-logout]')?.addEventListener('click', async () => {
      const ok = await confirmModal('Выйти из игры?', 'Мопс останется на сервере и будет ждать вашего возвращения.', 'Выйти');
      if (!ok) return;
      try {
        await api.logout();
      } catch {
        /* даже если запрос не прошёл — выходим локально */
      }
      import('../api.js').then(({ setToken }) => {
        setToken(null);
        state.user = null;
        state.snapshot = null;
        state.view = 'home';
        sfx.tap();
        rerender();
      });
    });
  },
};
