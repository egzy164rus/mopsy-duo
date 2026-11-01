/** views/wardrobe.js — гардероб и комнаты: превью, покупка, надевание. */
import { state, pets, buyItem, equipItem, setRoom, rerender, sfx, toast } from '../core.js';
import { esc, modal, haptic } from '../ui.js';
import { renderPug, renderPugThumb } from '../pug.js';

let tab = 'clothes';
let slotFilter = 'all';

export default {
  render() {
    const pet = pets();
    const catalog = state.catalog;
    const owned = new Set(state.snapshot.inventory);
    const equipped = pet.equipped || {};

    return `
    <div class="screen">
      <div class="row-between">
        <div>
          <h1 class="h1">Гардероб</h1>
          <p class="muted" style="margin-top:4px">Наряжайте ${esc(pet.name)} и меняйте комнату</p>
        </div>
        <span class="chip chip-coin">🪙 ${pet.coins}</span>
      </div>

      <div class="segmented">
        <button data-tab="clothes" class="${tab === 'clothes' ? 'active' : ''}">👕 Одежда</button>
        <button data-tab="rooms" class="${tab === 'rooms' ? 'active' : ''}">🏡 Комнаты</button>
      </div>

      ${
        tab === 'clothes'
          ? `
        <div class="row" style="gap:6px;overflow-x:auto;padding-bottom:2px">
          <button class="chip ${slotFilter === 'all' ? 'chip-lav' : ''}" data-slot="all" style="height:32px;padding:0 12px">Все</button>
          ${catalog.slots
            .map(
              (s) =>
                `<button class="chip ${slotFilter === s.key ? 'chip-lav' : ''}" data-slot="${s.key}" style="height:32px;padding:0 12px">${s.icon} ${esc(
                  s.label,
                )}</button>`,
            )
            .join('')}
        </div>
        <div class="items-grid">
          ${catalog.clothes
            .filter((c) => slotFilter === 'all' || c.slot === slotFilter)
            .map((c) => itemCard(c, owned.has(c.id), equipped[c.slot] === c.id))
            .join('')}
        </div>
        <div class="card">
          <div class="row" style="gap:10px;align-items:flex-start">
            <span style="font-size:20px">💡</span>
            <p class="muted" style="font-size:12.5px;line-height:1.45">
              Монеты копятся за заботу и мини-игры. Купленные вещи остаются навсегда и доступны обоим хозяевам.
            </p>
          </div>
        </div>`
          : `
        <div class="items-grid">
          ${catalog.rooms
            .map((r) => roomCard(r, owned.has(r.id), pet.room === r.id))
            .join('')}
        </div>`
      }

      <div class="card">
        <div class="card-title"><h3>✨ Образ ${esc(pet.name)}</h3>
          <button class="link" data-act="preview-pet">Примерить</button>
        </div>
        <div class="row" style="gap:12px">
          <div style="width:96px;height:100px">${renderPug({ color: pet.color, equipped, state: 'happy' })}</div>
          <div class="grow">
            ${['hat', 'glasses', 'bandana', 'outfit']
              .map((slot) => {
                const item = catalog.clothes.find((c) => c.id === equipped[slot]);
                return `<div class="row" style="gap:6px;margin-bottom:4px">
                  <span class="muted" style="font-size:11.5px;min-width:64px">${
                    catalog.slots.find((s) => s.key === slot)?.label || slot
                  }</span>
                  <span style="font-size:12px;font-weight:800">${item ? esc(item.name) : '—'}</span>
                </div>`;
              })
              .join('')}
          </div>
        </div>
      </div>
    </div>`;
  },

  bind(root) {
    root.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        sfx.tap();
        rerender();
      }),
    );
    root.querySelectorAll('[data-slot]').forEach((b) =>
      b.addEventListener('click', () => {
        slotFilter = b.dataset.slot;
        sfx.tap();
        rerender();
      }),
    );

    root.querySelectorAll('[data-item]').forEach((b) =>
      b.addEventListener('click', () => openItem(b.dataset.item)),
    );
    root.querySelectorAll('[data-room]').forEach((b) =>
      b.addEventListener('click', () => openRoom(b.dataset.room)),
    );
    root.querySelector('[data-act="preview-pet"]')?.addEventListener('click', () => {
      modal({
        title: 'Образ целиком',
        body: `<div style="height:240px;margin:6px 0">${renderPug({
          color: pets().color,
          equipped: pets().equipped,
          state: 'happy',
        })}</div>`,
        actions: [{ label: 'Класс!', value: true }],
      });
    });
  },
};

/* ------------------------------------------------------------------ карточки */

function itemCard(item, isOwned, isEquipped) {
  const rarityCls = item.rarity === 'epic' ? 'rarity-epic' : item.rarity === 'rare' ? 'rarity-rare' : '';
  return `
  <button class="item-card ${isEquipped ? 'equipped' : ''}" data-item="${item.id}">
    <div class="item-preview">
      <span class="rarity ${rarityCls}">${item.rarity === 'epic' ? 'эпик' : item.rarity === 'rare' ? 'редкий' : 'обычный'}</span>
      <span class="big">${item.emoji}</span>
    </div>
    <b>${esc(item.name)}</b>
    <div class="price ${isOwned ? 'owned' : ''}">${isOwned ? '✓ куплено' : `🪙 ${item.price}`}</div>
    <div class="buy ${isEquipped ? 'equipped-btn' : isOwned ? '' : 'disabled-like'}">
      ${isEquipped ? 'Надето' : isOwned ? 'Надеть' : 'Примерить'}
    </div>
  </button>`;
}

function roomCard(room, isOwned, isActive) {
  const bg =
    {
      room_cozy: 'linear-gradient(160deg,#FFEBD6,#F4CDA7)',
      room_garden: 'linear-gradient(160deg,#DFF6DB,#B8E0A0)',
      room_beach: 'linear-gradient(160deg,#DFF3FF,#F7E2B0)',
      room_space: 'linear-gradient(160deg,#312C56,#4A4470)',
      room_winter: 'linear-gradient(160deg,#E8F4FF,#FFFFFF)',
    }[room.id] || 'linear-gradient(160deg,#FFEBD6,#F4CDA7)';
  return `
  <button class="item-card ${isActive ? 'equipped' : ''}" data-room="${room.id}">
    <div class="item-preview" style="background:${bg}">
      <span class="big">${room.emoji}</span>
    </div>
    <b>${esc(room.name)}</b>
    <div class="price ${isOwned ? 'owned' : ''}">${room.price === 0 ? 'бесплатно' : isOwned ? '✓ куплено' : `🪙 ${room.price}`}</div>
    <div class="buy ${isActive ? 'equipped-btn' : ''}">${isActive ? 'Выбрано' : isOwned ? 'Включить' : 'Пример'}</div>
  </button>`;
}

/* ------------------------------------------------------------------- превью */

async function openItem(itemId) {
  const item = state.catalog.clothes.find((c) => c.id === itemId);
  if (!item) return;
  const pet = pets();
  const owned = state.snapshot.inventory.includes(itemId);
  const isEquipped = pet.equipped[item.slot] === itemId;
  sfx.tap();

  const preview = { ...(pet.equipped || {}), [item.slot]: itemId };
  const body = `
    <div style="height:200px;margin:8px 0">${renderPug({ color: pet.color, equipped: preview, state: 'happy' })}</div>
    <div class="row" style="gap:8px;justify-content:center;margin-bottom:10px">
      <span class="chip">${item.emoji} ${esc(item.name)}</span>
      <span class="chip ${owned ? 'chip-mint' : 'chip-coin'}">${owned ? 'куплено' : `🪙 ${item.price}`}</span>
    </div>
    ${
      !owned && pet.coins < item.price
        ? `<p class="center" style="color:#e05252">Не хватает ${item.price - pet.coins} монет. Сыграйте в мини-игру 🎮</p>`
        : ''
    }`;

  const actions = owned
    ? [
        { label: 'Закрыть', value: 'close', variant: 'ghost' },
        { label: isEquipped ? 'Снять' : 'Надеть', value: isEquipped ? 'unequip' : 'equip' },
      ]
    : [
        { label: 'Отмена', value: 'close', variant: 'ghost' },
        { label: `Купить за ${item.price}`, value: 'buy', disabled: pet.coins < item.price },
      ];

  const choice = await modal({ title: 'Примерка', body, actions, dismissible: true });
  if (choice === 'buy') {
    const ok = await buyItem(itemId);
    if (ok) {
      await equipItem(itemId);
      haptic('success');
      toast('Наряд надет на мопса 🎀', 'success');
    }
  } else if (choice === 'equip') {
    await equipItem(itemId);
    haptic('success');
  } else if (choice === 'unequip') {
    await equipItem(itemId);
  }
  rerender();
}

async function openRoom(roomId) {
  const room = state.catalog.rooms.find((r) => r.id === roomId);
  if (!room) return;
  const pet = pets();
  const owned = room.price === 0 || state.snapshot.inventory.includes(roomId);
  const isActive = pet.room === roomId;
  sfx.tap();
  const choice = await modal({
    title: room.name,
    body: `<p>${owned ? 'Красивый выбор! Включить эту комнату?' : `Комната стоит ${room.price} монет.`}</p>
      <div style="height:150px;margin-top:12px">${renderPugThumb({ color: pet.color, item: null })}</div>`,
    actions: owned
      ? [
          { label: 'Отмена', value: 'close', variant: 'ghost' },
          { label: isActive ? 'Уже включена' : 'Включить', value: 'apply', disabled: isActive },
        ]
      : [
          { label: 'Отмена', value: 'close', variant: 'ghost' },
          { label: `Купить за ${room.price}`, value: 'buy', disabled: pet.coins < room.price },
        ],
  });
  if (choice === 'apply') await setRoom(roomId);
  if (choice === 'buy') {
    const ok = await buyItem(roomId);
    if (ok) await setRoom(roomId);
  }
  rerender();
}
