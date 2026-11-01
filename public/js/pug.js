/**
 * pug.js — мультяшный мопс на чистом SVG.
 * Без внешних ассетов: работает офлайн и в Telegram WebView.
 *
 * renderPug({ color, equipped, state, sleeping }) → строка SVG.
 * Слоты одежды: hat, glasses, bandana, outfit.
 */
import { PUG_COLORS } from './catalog.js';

const palette = (id) => PUG_COLORS.find((c) => c.id === id) || PUG_COLORS[0];
const MASK = '#3f3733';
const MASK_DARK = '#2f2825';

/* --------------------------------------------------------------- одежда */

const CLOTH = {
  hat_party: (c) => `
    <g class="hat">
      <path d="M110 4 L136 62 L84 62 Z" fill="${c}" stroke="rgba(0,0,0,.08)" stroke-width="2"/>
      <path d="M96 46 L124 46" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".85"/>
      <circle cx="110" cy="4" r="8" fill="#fff"/>
      <circle cx="110" cy="4" r="4" fill="${c}"/>
    </g>`,
  hat_beanie: (c) => `
    <g class="hat">
      <path d="M64 62 C64 24 156 24 156 62 Z" fill="${c}"/>
      <rect x="60" y="54" width="100" height="16" rx="8" fill="${c}" opacity=".85"/>
      <circle cx="110" cy="20" r="8" fill="#fff" opacity=".92"/>
    </g>`,
  hat_cap: (c) => `
    <g class="hat">
      <path d="M66 58 C66 24 154 24 154 58 Z" fill="${c}"/>
      <path d="M148 52 C176 52 180 66 162 70 L146 62 Z" fill="${c}" opacity=".85"/>
      <circle cx="110" cy="26" r="4" fill="#fff" opacity=".8"/>
    </g>`,
  hat_crown: (c) => `
    <g class="hat">
      <path d="M74 58 L74 26 L92 42 L110 16 L128 42 L146 26 L146 58 Z" fill="${c}" stroke="#d9a520" stroke-width="2"/>
      <circle cx="110" cy="34" r="4" fill="#fff8dc"/>
      <circle cx="90" cy="42" r="3" fill="#fff8dc"/>
      <circle cx="130" cy="42" r="3" fill="#fff8dc"/>
    </g>`,
  glasses_round: (c) => `
    <g class="glasses" fill="none" stroke="${c}" stroke-width="4.5">
      <circle cx="91" cy="92" r="15"/><circle cx="129" cy="92" r="15"/>
      <path d="M106 92 h8"/><path d="M76 88 l-10 -4"/><path d="M144 88 l10 -4"/>
    </g>`,
  glasses_sun: (c) => `
    <g class="glasses">
      <rect x="74" y="82" width="31" height="22" rx="10" fill="${c}"/>
      <rect x="115" y="82" width="31" height="22" rx="10" fill="${c}"/>
      <path d="M105 91 h10" stroke="${c}" stroke-width="4.5"/>
      <path d="M79 92 q8 -7 16 -4" stroke="#fff" stroke-width="2.6" opacity=".45" fill="none" stroke-linecap="round"/>
      <path d="M120 92 q8 -7 16 -4" stroke="#fff" stroke-width="2.6" opacity=".45" fill="none" stroke-linecap="round"/>
      <path d="M74 86 l-8 -3" stroke="${c}" stroke-width="3.5"/>
      <path d="M146 86 l8 -3" stroke="${c}" stroke-width="3.5"/>
    </g>`,
  glasses_heart: (c) => `
    <g class="glasses" fill="${c}">
      <path d="M91 84 c-7 -8 -20 -3 -17 7 c2 7 12 13 17 16 c5 -3 15 -9 17 -16 c3 -10 -10 -15 -17 -7 Z" opacity=".9"/>
      <path d="M129 84 c-7 -8 -20 -3 -17 7 c2 7 12 13 17 16 c5 -3 15 -9 17 -16 c3 -10 -10 -15 -17 -7 Z" opacity=".9"/>
      <path d="M108 90 h4" stroke="${c}" stroke-width="4"/>
    </g>`,
  bandana_red: (c) => `
    <g class="bandana">
      <path d="M74 136 C90 150 130 150 146 136 L140 150 C120 164 100 164 80 150 Z" fill="${c}"/>
      <path d="M110 158 l-8 16 l16 0 Z" fill="${c}" opacity=".9"/>
    </g>`,
  bandana_scarf: (c) => `
    <g class="bandana">
      <path d="M72 132 C90 148 130 148 148 132 L152 146 C130 162 90 162 68 146 Z" fill="${c}"/>
      <path d="M96 160 l-6 20 h14 l-2 -20 Z" fill="${c}" opacity=".85"/>
      <path d="M80 140 h60" stroke="#fff" strokewidth="2" opacity=".3"/>
    </g>`,
  bow_tie: (c) => `
    <g class="bandana">
      <path d="M110 142 l-20 -10 v20 Z" fill="${c}"/>
      <path d="M110 142 l20 -10 v20 Z" fill="${c}"/>
      <circle cx="110" cy="142" r="5.5" fill="${c}" stroke="#fff" stroke-width="2"/>
    </g>`,
  outfit_sweater: (c) => `
    <g class="outfit">
      <path d="M62 156 C62 128 158 128 158 156 C158 190 148 206 110 206 C72 206 62 190 62 156 Z" fill="${c}"/>
      <path d="M84 140 C96 150 124 150 136 140" stroke="#fff" stroke-width="4" fill="none" opacity=".5"/>
      <path d="M78 176 h64" stroke="#fff" stroke-width="3" opacity=".35"/>
    </g>`,
  outfit_hero: (c) => `
    <g class="outfit">
      <path d="M60 150 C60 126 160 126 160 150 C160 192 150 208 110 208 C70 208 60 192 60 150 Z" fill="${c}"/>
      <path d="M110 168 l7 12 h-14 Z" fill="#FFD166"/>
      <circle cx="110" cy="152" r="7" fill="#FFD166"/>
      <path d="M150 140 C176 150 176 190 158 200 L150 186 C164 180 164 158 148 152 Z" fill="#EB5757" opacity=".9"/>
    </g>`,
  outfit_pajama: (c) => `
    <g class="outfit">
      <path d="M62 156 C62 130 158 130 158 156 C158 192 148 206 110 206 C72 206 62 192 62 156 Z" fill="${c}"/>
      <circle cx="88" cy="164" r="3" fill="#fff" opacity=".85"/>
      <circle cx="126" cy="176" r="3" fill="#fff" opacity=".85"/>
      <circle cx="108" cy="188" r="2.5" fill="#fff" opacity=".7"/>
      <path d="M0 0" />
    </g>`,
  outfit_santa: (c) => `
    <g class="outfit">
      <path d="M62 154 C62 128 158 128 158 154 C158 190 148 206 110 206 C72 206 62 190 62 154 Z" fill="${c}"/>
      <path d="M62 158 C90 172 130 172 158 158 L158 168 C130 182 90 182 62 168 Z" fill="#fff"/>
      <circle cx="110" cy="162" r="6" fill="#fff"/>
    </g>`,
};

/* ---------------------------------------------------------------- рендер */

/**
 * @param {{color?:string, equipped?:Record<string,string|null>, state?:string, sleeping?:boolean}} opts
 */
export function renderPug({ color = 'fawn', equipped = {}, state = 'normal', sleeping = false } = {}) {
  const c = palette(color);
  const body = c.body;
  const dark = c.dark;
  const light = shade(body, 18);
  const isSick = state === 'sick';
  const isSad = state === 'sad';
  const isSleepy = sleeping || state === 'sleepy';
  const isDirty = state === 'dirty';
  const isHungry = state === 'hungry';
  const tongue = state === 'happy' || state === 'eat' || state === 'play';

  const closeEyes = isSleepy || isSick;
  const mouth = isSad
    ? `<path d="M98 126 q12 -8 24 0" stroke="${MASK_DARK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
    : isSick
      ? `<path d="M98 127 q6 -5 11 0 q5 5 12 -1" stroke="${MASK_DARK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
      : `<path d="M100 122 q10 10 20 0" stroke="${MASK_DARK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;

  return `
<svg class="pug state-${state} ${sleeping ? 'is-sleeping' : ''} ${isDirty ? 'is-dirty' : ''}" viewBox="0 0 220 232" role="img" aria-label="Мопсик">
  <defs>
    <radialGradient id="pugGlow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fff" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <ellipse class="pug-shadow" cx="110" cy="218" rx="64" ry="9" fill="rgba(90,60,45,.16)"/>

  <!-- хвост -->
  <g class="pug-tail">
    <path d="M152 170 C176 176 184 152 168 142 C158 136 150 146 158 152" fill="none" stroke="${dark}" stroke-width="11" stroke-linecap="round"/>
  </g>

  <!-- тело -->
  <g class="pug-body">
    <ellipse cx="110" cy="162" rx="56" ry="44" fill="${body}"/>
    <ellipse cx="110" cy="176" rx="36" ry="26" fill="${light}" opacity=".55"/>
    <ellipse cx="86" cy="200" rx="16" ry="10" fill="${body}"/>
    <ellipse cx="134" cy="200" rx="16" ry="10" fill="${body}"/>
    <ellipse cx="86" cy="202" rx="9" ry="5" fill="${dark}" opacity=".5"/>
    <ellipse cx="134" cy="202" rx="9" ry="5" fill="${dark}" opacity=".5"/>
    ${equipped.outfit ? (CLOTH[equipped.outfit]?.(clothColor(equipped.outfit)) ?? '') : ''}
    ${
      isDirty
        ? `<g class="dirt">
             <ellipse cx="86" cy="150" rx="10" ry="6.5" fill="#B08968" opacity=".5"/>
             <ellipse cx="126" cy="168" rx="7.5" ry="5" fill="#B08968" opacity=".45"/>
             <ellipse cx="104" cy="186" rx="5.5" ry="4" fill="#B08968" opacity=".4"/>
             <path d="M150 166 q6 4 4 9" stroke="#B08968" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/>
           </g>`
        : ''
    }
    ${
      isHungry
        ? `<g class="rumble">
             <path d="M74 172 q-6 -6 0 -12" stroke="${MASK_DARK}" stroke-width="2.6" fill="none" opacity=".35" stroke-linecap="round"/>
             <path d="M66 178 q-8 -8 0 -16" stroke="${MASK_DARK}" stroke-width="2.6" fill="none" opacity=".22" stroke-linecap="round"/>
           </g>`
        : ''
    }
  </g>

  <!-- голова -->
  <g class="pug-head">
    <!-- уши -->
    <g class="ear ear-left">
      <ellipse cx="66" cy="80" rx="18" ry="24" fill="${MASK_DARK}" transform="rotate(-18 66 80)"/>
      <ellipse cx="68" cy="80" rx="9" ry="13" fill="${dark}" opacity=".45" transform="rotate(-18 68 80)"/>
    </g>
    <g class="ear ear-right">
      <ellipse cx="154" cy="80" rx="18" ry="24" fill="${MASK_DARK}" transform="rotate(18 154 80)"/>
      <ellipse cx="152" cy="80" rx="9" ry="13" fill="${dark}" opacity=".45" transform="rotate(18 152 80)"/>
    </g>

    <!-- морда -->
    <ellipse cx="110" cy="100" rx="54" ry="48" fill="${body}"/>
    <ellipse cx="110" cy="100" rx="54" ry="48" fill="url(#pugGlow)" opacity=".7"/>

    <!-- маска -->
    <ellipse cx="110" cy="116" rx="34" ry="25" fill="${MASK}"/>
    <ellipse cx="90" cy="94" rx="16" ry="15" fill="${MASK}" opacity=".92"/>
    <ellipse cx="130" cy="94" rx="16" ry="15" fill="${MASK}" opacity=".92"/>

    <!-- складки -->
    <path d="M86 68 q24 -8 48 0" stroke="${dark}" stroke-width="2.4" fill="none" opacity=".5"/>

    <!-- брови -->
    <g class="brows" opacity="0">
      <path d="M78 74 q12 -6 22 -1" stroke="${MASK_DARK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M120 73 q12 -5 22 1" stroke="${MASK_DARK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    </g>

    <!-- глаза -->
    <g class="eyes">
      <ellipse class="eye-open" cx="90" cy="93" rx="12" ry="13" fill="#fff"/>
      <ellipse class="eye-open" cx="130" cy="93" rx="12" ry="13" fill="#fff"/>
      <circle class="eye-open pupil" cx="92" cy="95" r="7" fill="#2b2320"/>
      <circle class="eye-open pupil" cx="128" cy="95" r="7" fill="#2b2320"/>
      <circle class="eye-open shine" cx="89" cy="91" r="2.8" fill="#fff"/>
      <circle class="eye-open shine" cx="125" cy="91" r="2.8" fill="#fff"/>
      <g class="eye-closed" opacity="0">
        <path d="M80 94 q10 9 20 0" stroke="${MASK_DARK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
        <path d="M120 94 q10 9 20 0" stroke="${MASK_DARK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      </g>
    </g>

    <!-- нос и рот -->
    <ellipse cx="110" cy="108" rx="9.5" ry="7.5" fill="${MASK_DARK}"/>
    <ellipse cx="107" cy="106" rx="2.6" ry="1.8" fill="#fff" opacity=".55"/>
    ${mouth}
    ${
      tongue
        ? `<path class="tongue" d="M104 128 q6 14 12 0 q-6 6 -12 0 Z" fill="#FF8FA8"/>`
        : ''
    }
    ${isHungry ? `<path class="drool" d="M113 128 q2.6 7 0 10.5 q-2.6 -3.5 0 -10.5 Z" fill="#BEE7FA" opacity=".95"/>` : ''}

    ${isSad ? `<g class="tear"><ellipse cx="80" cy="106" rx="3.2" ry="4.6" fill="#8FD6F5"/><ellipse cx="140" cy="104" rx="2.6" ry="3.8" fill="#8FD6F5" opacity=".8"/></g>` : ''}

    <!-- румянец -->
    <ellipse cx="72" cy="112" rx="9" ry="6" fill="#FF9DAE" opacity="${isSad ? '.25' : '.45'}"/>
    <ellipse cx="148" cy="112" rx="9" ry="6" fill="#FF9DAE" opacity="${isSad ? '.25' : '.45'}"/>

    <!-- ошейник -->
    <path d="M70 138 C88 150 132 150 150 138" stroke="#FF7A59" stroke-width="7" fill="none" stroke-linecap="round"/>
    <circle cx="110" cy="147" r="6" fill="#FFC95C"/>

    ${equipped.bandana ? (CLOTH[equipped.bandana]?.(clothColor(equipped.bandana)) ?? '') : ''}
    ${equipped.glasses ? (CLOTH[equipped.glasses]?.(clothColor(equipped.glasses)) ?? '') : ''}
    ${equipped.hat ? (CLOTH[equipped.hat]?.(clothColor(equipped.hat)) ?? '') : ''}
  </g>

  ${
    state === 'happy'
      ? `<g class="sparkles" fill="#FFC95C">
           <path d="M44 62 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z"/>
           <path d="M182 118 l2.4 6.4 6.4 2.4 -6.4 2.4 -2.4 6.4 -2.4 -6.4 -6.4 -2.4 6.4 -2.4 Z" opacity=".85"/>
         </g>`
      : ''
  }

  <!-- состояние «болеет» -->
  ${
    isSleepy
      ? `<g class="sleep-zzz" fill="#8B7BE8" font-family="Nunito, sans-serif" font-weight="900">
           <text x="168" y="70" font-size="15">Z</text>
           <text x="180" y="54" font-size="11" opacity=".75">z</text>
           <text x="190" y="42" font-size="8" opacity=".5">z</text>
         </g>`
      : ''
  }
  ${isSick ? `<text x="164" y="66" font-size="20">🩹</text><text x="26" y="70" font-size="16">💧</text>` : ''}
  ${isDirty ? `<text x="168" y="196" font-size="16">💨</text><text x="30" y="188" font-size="14">🪰</text>` : ''}
</svg>`;
}

function clothColor(id) {
  const map = {
    hat_party: '#FF8FB1',
    hat_beanie: '#7FB77E',
    hat_cap: '#6BBDF0',
    hat_crown: '#FFC95C',
    glasses_round: '#6B5B4B',
    glasses_sun: '#2F2B3A',
    glasses_heart: '#E86BA4',
    bandana_red: '#EB5757',
    bandana_scarf: '#A79BF0',
    bow_tie: '#6B5B4B',
    outfit_sweater: '#D98C5F',
    outfit_hero: '#4FB6E8',
    outfit_pajama: '#A79BF0',
    outfit_santa: '#EB5757',
  };
  return map[id] || '#FF8FA1';
}

/** Осветление/затемнение hex-цвета. */
function shade(hex, amount) {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((x) => x + x).join('') : n, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Мини-версия мопса для превью предметов и аватарок. */
export function renderPugThumb({ color = 'fawn', item = null } = {}) {
  const slot = item ? slotOf(item) : null;
  const equipped = slot ? { [slot]: item } : {};
  return renderPug({ color, equipped, state: 'happy' });
}

const slotOf = (itemId) => {
  if (itemId.startsWith('hat_')) return 'hat';
  if (itemId.startsWith('glasses_')) return 'glasses';
  if (itemId.startsWith('bandana_') || itemId === 'bow_tie') return 'bandana';
  if (itemId.startsWith('outfit_')) return 'outfit';
  return null;
};
