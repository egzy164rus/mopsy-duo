/**
 * views/games.js — мини-игры на 10–25 секунд.
 * Все игры возвращают score 0…100, награда начисляется сервером
 * (с кулдауном и защитой от накрутки).
 */
import { state, pets, petNameGen, runGame, rerender, sfx, toast } from '../core.js';
import { esc, haptic } from '../ui.js';

const BEST_KEY = 'mopsy_game_best';

const loadBest = () => {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
  } catch {
    return {};
  }
};
const saveBest = (game, score) => {
  const best = loadBest();
  if (!best[game] || score > best[game]) {
    best[game] = Math.round(score);
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
      /* ignore */
    }
  }
};

export default {
  render() {
    const games = state.catalog.games;
    const best = loadBest();
    const gamesToday = (state.snapshot.actions || []).filter((a) => a.type === 'game').length;
    return `
    <div class="screen">
      <div class="row-between">
        <div>
          <h1 class="h1">Мини-игры</h1>
          <p class="muted" style="margin-top:4px">Веселье приносит монеты и опыт мопсу</p>
        </div>
        <span class="chip chip-coin">🪙 ${pets().coins}</span>
      </div>

      <div class="card" style="background:linear-gradient(150deg,#fff,#f0fff9)">
        <div class="row-between">
          <div>
            <div class="h3">Настроение и монеты</div>
            <p class="muted" style="margin-top:3px">Каждая игра повышает настроение ${esc(petNameGen())}</p>
          </div>
          <div style="font-size:28px">🎮</div>
        </div>
      </div>

      <div class="games-grid">
        ${games
          .map(
            (g) => `
          <button class="game-card" data-game="${g.id}">
            <span class="g-ic">${g.icon}</span>
            <b>${esc(g.title)}</b>
            <small>${esc(g.desc)}</small>
            <span class="g-dur">${g.duration} с</span>
            ${best[g.id] ? `<small style="color:var(--coral-dark)">рекорд: ${best[g.id]}</small>` : ''}
          </button>`,
          )
          .join('')}
      </div>

      <div class="card">
        <div class="card-title"><h3>🏆 Как это работает</h3></div>
        <ul class="stack" style="gap:8px">
          <li class="row" style="gap:9px"><span>🪙</span><span class="muted" style="font-size:12.5px">За игру — до 40 монет, чем выше счёт, тем больше награда</span></li>
          <li class="row" style="gap:9px"><span>⭐</span><span class="muted" style="font-size:12.5px">Опыт идёт мопсу — так растёт его уровень</span></li>
          <li class="row" style="gap:9px"><span>⏳</span><span class="muted" style="font-size:12.5px">Между играми одного типа — пауза 45 секунд</span></li>
        </ul>
        <p class="muted" style="margin-top:10px;font-size:11.5px">Сыграно сегодня: ${gamesToday}</p>
      </div>
    </div>`;
  },

  bind(root) {
    root.querySelectorAll('[data-game]').forEach((btn) =>
      btn.addEventListener('click', () => {
        sfx.tap();
        haptic('medium');
        openGame(btn.dataset.game);
      }),
    );
  },
};

/* ======================================================= оболочка мини-игры */

function openGame(game) {
  const meta = state.catalog.games.find((g) => g.id === game);
  const overlay = document.createElement('div');
  overlay.className = 'minigame';
  overlay.innerHTML = `
    <div class="mg-top">
      <button class="btn-icon" data-close aria-label="Закрыть">✕</button>
      <span class="mg-score" data-score>0</span>
      <span class="mg-timer" data-timer>${meta.duration} с</span>
    </div>
    <div class="mg-area" data-area>
      <div class="mg-hint" data-hint>${esc(meta.desc)}</div>
    </div>`;
  document.body.appendChild(overlay);

  const area = overlay.querySelector('[data-area]');
  const scoreEl = overlay.querySelector('[data-score]');
  const timerEl = overlay.querySelector('[data-timer]');
  const hintEl = overlay.querySelector('[data-hint]');

  let stopped = false;
  let cleanup = () => {};

  const api = {
    area,
    scoreEl,
    timerEl,
    hintEl,
    setScore: (v) => {
      scoreEl.textContent = String(Math.round(v));
    },
    setTimer: (v) => {
      timerEl.textContent = `${Math.max(0, Math.ceil(v))} с`;
    },
    isStopped: () => stopped,
  };

  const close = () => {
    stopped = true;
    try {
      cleanup();
    } catch {
      /* ignore */
    }
    overlay.remove();
    rerender();
  };

  overlay.querySelector('[data-close]').addEventListener('click', close);

  const finish = async (score) => {
    if (stopped) return;
    stopped = true;
    try {
      cleanup();
    } catch {
      /* ignore */
    }
    saveBest(game, score);
    const rounded = Math.round(Math.max(0, Math.min(100, score)));
    const stars = rounded >= 80 ? '⭐⭐⭐' : rounded >= 50 ? '⭐⭐' : rounded >= 20 ? '⭐' : '🐾';

    const center = document.createElement('div');
    center.className = 'mg-center';
    center.innerHTML = `
      <div class="mg-center-inner">
        <div class="mg-big">${rounded >= 50 ? '🎉' : '🐶'}</div>
        <div class="mg-result">${rounded} очков</div>
        <div style="font-size:20px">${stars}</div>
        <p class="muted" style="font-size:13px">${esc(pets().name)} доволен игрой!</p>
        <button class="btn btn-block" data-collect>Забрать награду</button>
        <button class="skip-link" data-skip-close>Закрыть</button>
      </div>`;
    overlay.appendChild(center);

    center.querySelector('[data-skip-close]').addEventListener('click', close);
    center.querySelector('[data-collect]').addEventListener('click', async () => {
      const btn = center.querySelector('[data-collect]');
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Начисляем…';
      const res = await runGame(game, rounded);
      close();
      if (res) {
        toast(`+${res.rewards.coins} монет · +${res.rewards.xp} опыта`, 'success', { icon: '🎁' });
        if (res.rewards.levelUp) toast(`Новый уровень: ${res.rewards.levelUp}!`, 'success', { icon: '🏅' });
      }
    });
  };

  const GAMES = { bone: gameBone, treat: gameTreat, jump: gameJump, tug: gameTUG };
  const runner = GAMES[game] || gameBone;
  cleanup = runner(api, finish, meta) || (() => {});
}

/* ------------------------------------------------------------- ловля косточки */

function gameBone(ui, finish, meta) {
  const { area } = ui;
  const rect = () => area.getBoundingClientRect();
  let pugX = 0.5;
  let caught = 0;
  let missed = 0;
  const bones = [];
  const pugEl = document.createElement('div');
  pugEl.className = 'mg-pug';
  pugEl.textContent = '🐶';
  pugEl.style.left = '50%';
  area.appendChild(pugEl);

  const move = (clientX) => {
    const r = rect();
    pugX = Math.max(0.08, Math.min(0.92, (clientX - r.left) / r.width));
    pugEl.style.left = `${pugX * 100}%`;
  };
  const onPointer = (e) => move(e.touches ? e.touches[0].clientX : e.clientX);
  area.addEventListener('pointermove', onPointer);
  area.addEventListener('touchmove', (e) => { e.preventDefault(); onPointer(e); }, { passive: false });
  area.addEventListener('pointerdown', onPointer);

  const start = performance.now();
  const duration = meta.duration * 1000;
  let lastSpawn = 0;
  let raf = 0;

  const loop = (now) => {
    if (ui.isStopped()) return;
    const elapsed = now - start;
    const left = (duration - elapsed) / 1000;
    ui.setTimer(left);
    if (elapsed >= duration) return finish(scoreBone());

    if (elapsed - lastSpawn > 620) {
      lastSpawn = elapsed;
      const el = document.createElement('div');
      el.className = 'mg-falling';
      el.textContent = Math.random() < 0.18 ? '🥎' : '🦴';
      const x = 8 + Math.random() * 84;
      el.style.left = `${x}%`;
      el.style.top = '-30px';
      const isToy = el.textContent === '🥎';
      area.appendChild(el);
      bones.push({ el, x, y: -30, vy: 0.14 + Math.random() * 0.08, isToy });
    }

    for (const b of bones) {
      if (b.dead) continue;
      b.y += b.vy * (16.7 * 1.6);
      b.el.style.top = `${b.y}px`;
      b.el.style.transform = `rotate(${b.y * 0.6}deg)`;
      const r = rect();
      if (b.y > r.height - 66 && Math.abs(b.x / 100 - pugX) < 0.16 && b.y < r.height - 10) {
        b.dead = true;
        b.el.remove();
        if (b.isToy) {
          caught = Math.max(0, caught - 1);
          sfx.error();
        } else {
          caught += 1;
          sfx.coin();
          ui.setScore(Math.min(100, caught * 5));
          haptic('light');
        }
      } else if (b.y > r.height + 20) {
        b.dead = true;
        b.el.remove();
        missed += 1;
      }
    }

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  function scoreBone() {
    return Math.min(100, caught * 5.2 + missed * 0);
  }

  return () => {
    cancelAnimationFrame(raf);
    area.removeEventListener('pointermove', onPointer);
    area.removeEventListener('pointerdown', onPointer);
    bones.forEach((b) => b.el.remove());
    pugEl.remove();
  };
}

/* ------------------------------------------------------------ найди лакомство */

function gameTreat(ui, finish, meta) {
  const { area } = ui;
  let round = 0;
  let correct = 0;
  const totalRounds = 3;
  let timers = [];
  let active = true;

  const watcher = document.createElement('div');
  watcher.className = 'mg-watcher';
  watcher.textContent = '🐶';
  area.appendChild(watcher);

  const progressEl = document.createElement('div');
  progressEl.className = 'mg-progress';
  progressEl.textContent = 'Раунд 1 из 3';
  area.appendChild(progressEl);

  const cups = [0, 1, 2].map((i) => {
    const el = document.createElement('div');
    el.className = 'mg-cup';
    el.textContent = '🥛';
    el.style.left = `calc(50% + ${(i - 1) * 92}px)`;
    el.style.transform = 'translateX(-50%)';
    area.appendChild(el);
    return el;
  });

  const setHint = (text) => {
    if (ui.hintEl) ui.hintEl.textContent = text;
  };

  const startRound = () => {
    if (!active) return;
    if (round >= totalRounds) return finish((correct / totalRounds) * 100);
    round += 1;
    if (ui.timerEl) ui.timerEl.textContent = `Раунд ${round}/${totalRounds}`;
    progressEl.textContent = `Раунд ${round} из ${totalRounds}`;
    ui.setScore((correct / totalRounds) * 100);
    const prize = Math.floor(Math.random() * 3);
    cups.forEach((c) => {
      c.classList.remove('up', 'found');
      c.textContent = '🥛';
      c.style.pointerEvents = 'none';
    });
    cups[prize].classList.add('up');
    cups[prize].textContent = '🍪';
    setHint('Запоминайте, где лакомство…');

    timers.push(
      setTimeout(() => {
        cups.forEach((c) => {
          c.classList.remove('up');
          c.textContent = '🥛';
        });
        setHint('Тапайте по чашке!');
        cups.forEach((c) => {
          c.style.pointerEvents = 'auto';
        });
        // «перемешивание»
        cups.forEach((c, i) => {
          const shuffle = (i + prize) % 3;
          c.style.left = `calc(50% + ${(shuffle - 1) * 92}px)`;
        });
        // переназначаем позиции чашек случайно
        const order = [0, 1, 2].sort(() => Math.random() - 0.5);
        cups.forEach((c, i) => {
          c.dataset.pos = String(order[i]);
          c.style.left = `calc(50% + ${(order[i] - 1) * 92}px)`;
        });
        cups.forEach((c) => {
          c.onclick = () => {
            if (!active) return;
            cups.forEach((x) => (x.style.pointerEvents = 'none'));
            if (Number(c.dataset.pos) === prize) {
              correct += 1;
              c.classList.add('found');
              c.textContent = '🍪';
              sfx.success();
              haptic('success');
              ui.setScore((correct / totalRounds) * 100);
            } else {
              c.classList.add('up');
              sfx.error();
              haptic('error');
              const right = cups.find((x) => Number(x.dataset.pos) === prize);
              right?.classList.add('found');
              if (right) right.textContent = '🍪';
            }
            timers.push(setTimeout(startRound, 1100));
          };
        });
      }, 900),
    );
  };

  if (ui.timerEl) ui.timerEl.textContent = 'Раунд 1/3';
  startRound();

  return () => {
    active = false;
    timers.forEach(clearTimeout);
    cups.forEach((c) => c.remove());
    watcher.remove();
    progressEl.remove();
  };
}

/* --------------------------------------------------------- прыжки через барьер */

function gameJump(ui, finish, meta) {
  const { area } = ui;
  const obstacles = [];
  let score = 0;
  let hearts = 3;
  let jumping = false;
  let jumpStart = 0;
  let lastSpawn = 0;
  let raf = 0;
  const start = performance.now();
  const duration = meta.duration * 1000;

  const pugEl = document.createElement('div');
  pugEl.className = 'mg-pug';
  pugEl.textContent = '🐶';
  pugEl.style.left = '18%';
  area.appendChild(pugEl);

  const heartsEl = document.createElement('div');
  heartsEl.style.cssText = 'position:absolute;bottom:10px;right:12px;font-size:18px';
  heartsEl.textContent = '❤️❤️❤️';
  area.appendChild(heartsEl);

  const jump = () => {
    if (jumping || ui.isStopped()) return;
    jumping = true;
    jumpStart = performance.now();
    sfx.tap();
    haptic('light');
  };
  area.addEventListener('pointerdown', jump);

  const loop = (now) => {
    if (ui.isStopped()) return;
    const elapsed = now - start;
    ui.setTimer((duration - elapsed) / 1000);
    if (elapsed >= duration || hearts <= 0) return finish(Math.min(100, score));

    // прыжок: 520 мс
    const jt = now - jumpStart;
    const offset = jumping ? (jt < 260 ? -(jt / 260) * 74 : -74 + ((jt - 260) / 260) * 74) : 0;
    pugEl.style.transform = `translateX(-50%) translateY(${Math.max(-74, offset)}px)`;
    if (jt > 520) jumping = false;

    if (elapsed - lastSpawn > 1250) {
      lastSpawn = elapsed;
      const el = document.createElement('div');
      el.className = 'mg-obstacle';
      el.textContent = ['🌵', '🪨', '🧱'][Math.floor(Math.random() * 3)];
      el.style.left = '104%';
      el.style.bottom = '8px';
      area.appendChild(el);
      obstacles.push({ el, x: 104, passed: false });
    }

    for (const o of obstacles) {
      if (o.dead) continue;
      o.x -= 0.85;
      o.el.style.left = `${o.x}%`;
      const near = Math.abs(o.x - 18) < 6;
      if (near && !o.passed && jumping && -offset > 34) {
        o.passed = true;
        score += 9;
        sfx.coin();
        ui.setScore(score);
      } else if (near && !o.passed && !jumping) {
        o.passed = true;
        hearts -= 1;
        heartsEl.textContent = '❤️'.repeat(Math.max(0, hearts)) + '🤍'.repeat(3 - Math.max(0, hearts));
        sfx.error();
        haptic('error');
        area.style.background = 'rgba(255,180,180,.5)';
        setTimeout(() => (area.style.background = ''), 220);
      }
      if (o.x < -10) {
        o.dead = true;
        o.el.remove();
      }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    area.removeEventListener('pointerdown', jump);
    obstacles.forEach((o) => o.el.remove());
    pugEl.remove();
    heartsEl.remove();
  };
}

/* ------------------------------------------------------ перетягивание игрушки */

function gameTUG(ui, finish, meta) {
  const { area } = ui;
  let fill = 50;
  let taps = 0;
  let raf = 0;
  let last = performance.now();
  const start = performance.now();
  const duration = meta.duration * 1000;

  const bar = document.createElement('div');
  bar.className = 'mg-tug-bar';
  bar.innerHTML = '<div class="mg-tug-fill" style="width:50%"></div>';
  area.appendChild(bar);

  const knob = document.createElement('div');
  knob.className = 'mg-tug-knob';
  knob.textContent = '🪢';
  knob.style.left = '50%';
  knob.style.top = 'calc(46% + 9px)';
  area.appendChild(knob);

  const rival = document.createElement('div');
  rival.textContent = '🐕';
  rival.style.cssText = 'position:absolute;top:calc(46% - 66px);left:14%;font-size:34px';
  area.appendChild(rival);

  const me = document.createElement('div');
  me.textContent = '🐶';
  me.style.cssText = 'position:absolute;top:calc(46% + 30px);right:14%;font-size:34px';
  area.appendChild(me);

  const tap = () => {
    if (ui.isStopped()) return;
    taps += 1;
    fill = Math.min(100, fill + 2.4);
    knob.style.left = `${fill}%`;
    bar.firstElementChild.style.width = `${fill}%`;
    ui.setScore(fill);
    if (taps % 4 === 0) {
      sfx.tap();
      haptic('light');
    }
  };
  area.addEventListener('pointerdown', tap);

  const loop = (now) => {
    if (ui.isStopped()) return;
    const dt = (now - last) / 1000;
    last = now;
    const elapsed = now - start;
    ui.setTimer((duration - elapsed) / 1000);
    fill = Math.max(0, fill - dt * 6);
    knob.style.left = `${fill}%`;
    bar.firstElementChild.style.width = `${fill}%`;
    ui.setScore(fill);
    if (elapsed >= duration) return finish(fill);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  ui.setTimer(meta.duration);

  return () => {
    cancelAnimationFrame(raf);
    area.removeEventListener('pointerdown', tap);
    bar.remove();
    knob.remove();
    rival.remove();
    me.remove();
  };
}
