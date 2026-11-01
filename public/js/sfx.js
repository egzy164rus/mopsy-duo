/**
 * sfx.js — приятные звуки без внешних файлов (WebAudio).
 * Кнопка «без звука» в профиле сохраняется в localStorage.
 */

const MUTE_KEY = 'mopsy_muted';
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  muted = false;
}

function audio() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.08, delay = 0, slide = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  get muted() {
    return muted;
  },
  toggleMute() {
    muted = !muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!muted) sfx.tap();
    return muted;
  },
  tap() {
    tone({ freq: 620, dur: 0.07, type: 'sine', gain: 0.05 });
  },
  success() {
    tone({ freq: 660, dur: 0.1, type: 'sine', gain: 0.07 });
    tone({ freq: 880, dur: 0.14, type: 'sine', gain: 0.06, delay: 0.09 });
  },
  eat() {
    tone({ freq: 300, dur: 0.09, type: 'triangle', gain: 0.07 });
    tone({ freq: 240, dur: 0.11, type: 'triangle', gain: 0.06, delay: 0.1 });
    tone({ freq: 200, dur: 0.12, type: 'triangle', gain: 0.05, delay: 0.22 });
  },
  water() {
    tone({ freq: 520, dur: 0.12, type: 'sine', gain: 0.05, slide: 240 });
    tone({ freq: 700, dur: 0.1, type: 'sine', gain: 0.04, delay: 0.1, slide: -200 });
  },
  happy() {
    tone({ freq: 780, dur: 0.1, type: 'sine', gain: 0.06 });
    tone({ freq: 990, dur: 0.11, type: 'sine', gain: 0.05, delay: 0.08 });
    tone({ freq: 1180, dur: 0.14, type: 'sine', gain: 0.045, delay: 0.17 });
  },
  bark() {
    tone({ freq: 320, dur: 0.08, type: 'sawtooth', gain: 0.05, slide: -120 });
    tone({ freq: 300, dur: 0.08, type: 'sawtooth', gain: 0.045, delay: 0.14, slide: -110 });
  },
  coin() {
    tone({ freq: 1050, dur: 0.08, type: 'square', gain: 0.03 });
    tone({ freq: 1400, dur: 0.12, type: 'square', gain: 0.025, delay: 0.07 });
  },
  error() {
    tone({ freq: 260, dur: 0.16, type: 'sine', gain: 0.06, slide: -80 });
  },
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.16, type: 'sine', gain: 0.07, delay: i * 0.1 }),
    );
  },
};
