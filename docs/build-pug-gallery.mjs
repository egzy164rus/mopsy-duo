/**
 * build-pug-gallery.mjs — генерирует docs/pug-gallery.html:
 * самодостаточную страницу-галерею мопса (все состояния, окрасы, наряды).
 * Запуск: node docs/build-pug-gallery.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPug } from '../public/js/pug.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const pugCss = fs.readFileSync(path.join(ROOT, 'public/pug.css'), 'utf8');
const baseCss = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');

// из styles.css берём только переменные и базовые классы, которые нужны галерее
const tokens = baseCss.slice(baseCss.indexOf(':root {'), baseCss.indexOf('* {'));
const cardCss = baseCss.match(/\.card \{[\s\S]*?\}\n/)?.[0] ?? '';
const chipCss = baseCss.match(/\.chip \{[\s\S]*?\}\n/)?.[0] ?? '';

const STATES = [
  ['normal', 'Обычное', 'В порядке, ждёт заботы', {}],
  ['happy', 'Счастливое', 'Все показатели высокие', {}],
  ['hungry', 'Голодное', 'Сытость или питьё < 28', {}],
  ['sleepy', 'Сонное', 'Спит, энергия восстанавливается', { sleeping: true }],
  ['sad', 'Грустное', 'Настроение < 38', {}],
  ['sick', 'Больное', 'Здоровье < 35, нужно лечение', {}],
  ['dirty', 'Грязное', 'Чистота < 28, пора купаться', {}],
];

const COLORS = [
  ['fawn', 'Пшеничный'],
  ['apricot', 'Абрикосовый'],
  ['silver', 'Серебристый'],
  ['black', 'Чёрный'],
];

const OUTFITS = [
  ['hat_party', 'Праздничный колпак', 'hat'],
  ['hat_beanie', 'Вязаная шапка', 'hat'],
  ['hat_cap', 'Кепка путешественника', 'hat'],
  ['hat_crown', 'Корона мопса', 'hat'],
  ['glasses_round', 'Круглые очки', 'glasses'],
  ['glasses_sun', 'Солнечные очки', 'glasses'],
  ['glasses_heart', 'Очки-сердечки', 'glasses'],
  ['bandana_red', 'Красная бандана', 'bandana'],
  ['bandana_scarf', 'Тёплый шарф', 'bandana'],
  ['bow_tie', 'Бабочка-джентльмен', 'bandana'],
  ['outfit_sweater', 'Уютный свитер', 'outfit'],
  ['outfit_pajama', 'Пижама в звёздочку', 'outfit'],
  ['outfit_hero', 'Костюм супермопса', 'outfit'],
  ['outfit_santa', 'Костюм Деда Мороза', 'outfit'],
];

const cell = (svg, title, sub) => `
  <figure class="cell">
    <div class="cell-art">${svg}</div>
    <figcaption><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</figcaption>
  </figure>`;

const gallery = `
<section>
  <h2>7 состояний <span>меняются автоматически по показателям</span></h2>
  <div class="grid grid-4">
    ${STATES.map(([state, title, sub, extra]) =>
      cell(renderPug({ color: 'fawn', state, equipped: { hat: 'hat_party', bandana: 'bandana_red' }, ...extra }), title, sub),
    ).join('')}
  </div>
</section>

<section>
  <h2>4 окраса <span>выбираются при создании мопса</span></h2>
  <div class="grid grid-4">
    ${COLORS.map(([color, title]) =>
      cell(renderPug({ color, state: 'happy' }), title, ''),
    ).join('')}
  </div>
</section>

<section>
  <h2>14 нарядов <span>надеваются отдельно по слотам: голова · очки · шея · костюм</span></h2>
  <div class="grid grid-4">
    ${OUTFITS.map(([id, title, slot]) =>
      cell(renderPug({ color: 'fawn', state: 'happy', equipped: { [slot]: id } }), title, slotLabel(slot)),
    ).join('')}
  </div>
</section>

<section>
  <h2>Полный образ <span>можно комбинировать любые предметы и фон комнаты</span></h2>
  <div class="grid grid-3">
    ${cell(
      renderPug({
        color: 'apricot',
        state: 'happy',
        equipped: { hat: 'hat_crown', glasses: 'glasses_sun', bandana: 'bow_tie', outfit: 'outfit_hero' },
      }),
      'Супермопс',
      'корона + очки + бабочка + костюм',
    )}
    ${cell(
      renderPug({
        color: 'silver',
        state: 'happy',
        equipped: { hat: 'hat_beanie', glasses: 'glasses_round', bandana: 'bandana_scarf', outfit: 'outfit_sweater' },
      }),
      'Уютный зимний',
      'шапка + очки + шарф + свитер',
    )}
    ${cell(
      renderPug({
        color: 'fawn',
        state: 'happy',
        equipped: { hat: 'hat_cap', bandana: 'bandana_red', outfit: 'outfit_pajama' },
      }),
      'Домашний',
      'кепка + бандана + пижама',
    )}
  </div>
</section>

<section>
  <h2>Анимации <span>наведите на мопса — реакция на действие</span></h2>
  <div class="grid grid-4">
    ${[
      ['anim-jump', 'Прыжок', 'прогулка, радость'],
      ['anim-eat', 'Еда', 'кормление'],
      ['anim-bath', 'Купание', 'искупать'],
      ['anim-heal', 'Лечение', 'полечить'],
    ]
      .map(
        ([anim, title, sub]) => `
      <figure class="cell hover-anim">
        <div class="cell-art"><div class="pug-anim ${anim}" data-anim="${anim}">${renderPug({
          color: 'fawn',
          state: 'happy',
          equipped: { bandana: 'bandana_red' },
        })}</div></div>
        <figcaption><b>${title}</b><small>${sub}</small></figcaption>
      </figure>`,
      )
      .join('')}
  </div>
</section>`;

function slotLabel(slot) {
  return { hat: 'голова', glasses: 'очки', bandana: 'шея', outfit: 'костюм' }[slot] || slot;
}

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Мопсик вдвоём — галерея мопса</title>
<style>
${tokens}
${cardCss}
${chipCss}
${pugCss}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--ink);
  background: radial-gradient(120% 90% at 15% 0%, #fff6ec 0%, #ffead9 45%, #ffe3d2 100%);
  padding: 26px 18px 56px;
}
.wrap { max-width: 1180px; margin: 0 auto; }
header.hero { text-align: center; margin-bottom: 26px; }
header.hero .badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: #fff; padding: 7px 14px; border-radius: 99px;
  font-size: 12px; font-weight: 900; color: var(--coral-dark);
  box-shadow: 0 8px 20px rgba(109, 79, 63, 0.1); margin-bottom: 14px;
}
h1 { font-size: clamp(28px, 4vw, 42px); font-weight: 900; letter-spacing: -1.2px; margin: 0; }
h1 span { color: var(--coral); }
header.hero p { color: var(--ink-soft); font-weight: 700; margin: 10px auto 0; max-width: 620px; line-height: 1.5; }
section { margin-top: 34px; }
h2 {
  font-size: 19px; font-weight: 900; letter-spacing: -0.3px; margin: 0 0 14px;
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
}
h2 span { font-size: 12.5px; font-weight: 800; color: var(--muted); }
.grid { display: grid; gap: 12px; }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.cell {
  margin: 0; background: #fff; border-radius: 22px; padding: 10px 10px 12px;
  box-shadow: 0 8px 22px rgba(109, 79, 63, 0.09); text-align: center;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
}
.cell:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(109, 79, 63, 0.16); }
.cell-art {
  height: 168px; border-radius: 16px; overflow: hidden;
  background: linear-gradient(165deg, #fff7ef, #ffe9d8);
  display: grid; place-items: center;
}
.cell-art > svg, .cell-art > div { width: 100%; height: 100%; }
figcaption { margin-top: 9px; }
figcaption b { display: block; font-size: 13px; font-weight: 900; letter-spacing: -0.2px; }
figcaption small { display: block; font-size: 11px; font-weight: 700; color: var(--muted); line-height: 1.3; margin-top: 2px; }
.hover-anim .pug-anim { animation-play-state: paused; }
.hover-anim:hover .pug-anim { animation-play-state: running; }
.note {
  margin-top: 30px; background: #fff; border-radius: 20px; padding: 16px 18px;
  box-shadow: 0 8px 22px rgba(109, 79, 63, 0.08); font-size: 13px; font-weight: 700; color: var(--ink-soft); line-height: 1.55;
}
.note b { color: var(--ink); }
@media (max-width: 900px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: 1fr; } }
@media (max-width: 420px) { .cell-art { height: 140px; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <div class="badge">🐾 Технический рендер · чистый SVG, без картинок</div>
    <h1>Мопсик <span>вдвоём</span></h1>
    <p>Один векторный мопс на все случаи жизни: 7 состояний, 4 окраса, 14 предметов одежды
    и набор анимаций. Масштабируется без потерь, весит килобайты и работает офлайн.</p>
  </header>
  ${gallery}
  <div class="note">
    <b>Как это устроено:</b> функцию <code>renderPug({ color, equipped, state, sleeping })</code>
    из <code>public/js/pug.js</code> вызывает главный экран, гардероб и обучение — везде один
    и тот же мопс. Состояние приходит с сервера (<code>deriveState</code> в
    <code>server/engine.js</code>), одежда — из инвентаря питомца.
    Анимации — CSS-классы в <code>public/pug.css</code>, поэтому они не мешают друг другу
    и уважают <code>prefers-reduced-motion</code>.
  </div>
</div>
<script>
  // включаем анимацию на время наведения (для наглядности)
  document.querySelectorAll('.hover-anim').forEach((el) => {
    const anim = el.querySelector('.pug-anim');
    el.addEventListener('mouseenter', () => {
      anim.style.animation = 'none';
      void anim.offsetWidth;
      anim.style.animation = '';
    });
  });
</script>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'docs/pug-gallery.html'), html);
console.log('docs/pug-gallery.html готов:', Math.round(html.length / 1024), 'КБ');
