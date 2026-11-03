// Code Kinnu Shorts kit: everything a scene needs to draw a frame as a pure function of time.
// A scene never keeps state between frames; the same t always draws the same picture.

export const W = 1080, H = 1920, FPS = 30;
export const CYAN = '#2BD9FF', INK = '#2a1a10';

// ---------- easing ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  linear: t => t,
  inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outQuint: t => 1 - Math.pow(1 - t, 5),
};

// 0→1 progress of a move that starts at t0 and lasts dur seconds
export const prog = (t, t0, dur, e = ease.inOutCubic) => e(clamp((t - t0) / dur));

// damped spring from 0 to 1, started at t0 (overshoots, then settles)
export function spring(t, t0, freq = 14, damp = .45) {
  const x = t - t0;
  if (x <= 0) return 0;
  const w = freq, z = damp, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}

// keyframes: [[time, value], ...] with an ease per segment
export function keys(t, ks, e = ease.inOutCubic) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      return lerp(v0, v1, e((t - t0) / (t1 - t0)));
    }
  }
  return ks[ks.length - 1][1];
}

// zoom is interpolated in log space so 1x→4x feels even
export const zoomKeys = (t, ks, e) => Math.exp(keys(t, ks.map(([a, b]) => [a, Math.log(b)]), e));

// ---------- words ----------
// words: [{w, s, e}] from the voice. at('hollow') = start of the first "hollow"; at('hollow', 2) = second one.
export function wordClock(words) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9']/g, '');
  return {
    words,
    at(word, n = 1) {
      let k = 0;
      for (const x of words) if (norm(x.w) === norm(word) && ++k === n) return x.s;
      throw new Error(`word "${word}" #${n} not in narration`);
    },
    end(word, n = 1) {
      let k = 0;
      for (const x of words) if (norm(x.w) === norm(word) && ++k === n) return x.e;
      throw new Error(`word "${word}" #${n} not in narration`);
    },
    duration: words.length ? words[words.length - 1].e : 0,
  };
}

// ---------- paper look ----------
let grainTile;
function grainPattern(g) {
  if (!grainTile) {
    grainTile = new OffscreenCanvas(256, 256);
    const c = grainTile.getContext('2d'), img = c.createImageData(256, 256);
    let s = 9;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 16807) % 2147483647;
      const v = 128 + ((s / 2147483647) - .5) * 70;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }
  return g.createPattern(grainTile, 'repeat');
}

// fill the current path as a sheet of paper: soft cast shadow, flat colour, paper fibre
export function paper(g, fill, { lift = 1, grain = .1 } = {}) {
  g.save();
  g.shadowColor = 'rgba(70,35,10,.38)';
  g.shadowBlur = 22 * lift; g.shadowOffsetY = 9 * lift;
  g.fillStyle = fill; g.fill();
  g.restore();
  if (grain) {
    g.save(); g.clip(); g.globalAlpha = grain; g.globalCompositeOperation = 'overlay';
    g.fillStyle = grainPattern(g); g.fillRect(-4000, -4000, 8000, 8000);
    g.restore();
  }
}

export function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// warm layered paper backdrop with rolling hills at the bottom
export function backdrop(g, t, { sky = ['#f4e8d2', '#ead2ab'], hills = ['#e9b97a', '#d98e5b', '#b8643f'] } = {}) {
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, sky[0]); bg.addColorStop(1, sky[1]);
  g.fillStyle = bg; g.fillRect(-W, -H, W * 3, H * 3);
  hills.forEach((col, k) => {
    g.beginPath(); g.moveTo(-W, H * 2);
    for (let x = -W; x <= W * 2; x += 30)
      g.lineTo(x, 1520 + k * 120 + Math.sin(x / 150 + k * 2 + t * .15 * (k + 1)) * 36);
    g.lineTo(W * 2, H * 2); g.closePath();
    paper(g, col, { lift: .8 });
  });
}

export function grainOverlay(g, amount = .08) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = amount; g.globalCompositeOperation = 'overlay';
  g.fillStyle = grainPattern(g); g.fillRect(0, 0, W, H); g.restore();
}

// ---------- camera ----------
// zoom about a focus point (fx, fy) that lands at screen centre
export function camera(g, zoom, fx = W / 2, fy = H / 2, sx = W / 2, sy = H / 2) {
  g.setTransform(zoom, 0, 0, zoom, sx - fx * zoom, sy - fy * zoom);
}

// ---------- captions ----------
// shows the spoken phrase word by word; key words turn cyan. Stays inside the Shorts safe zone.
export function captions(g, t, words, { y = 1300, size = 92, keyWords = [], chunk = 3 } = {}) {
  const i = words.findIndex(w => t >= w.s && t < (w.e + .25));
  if (i < 0) return;
  const start = i - (i % chunk), line = words.slice(start, start + chunk);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = `700 ${size}px Fredoka`; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const gap = size * .28, ws = line.map(w => g.measureText(w.w.toUpperCase()).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (line.length - 1);
  let x = (W - 120 - total) / 2 + 60;          // keep clear of the right-side buttons
  line.forEach((w, k) => {
    const on = t >= w.s, pop = on ? spring(t, w.s, 18, .5) : 0;
    if (!on) { x += ws[k] + gap; return; }
    const s = .7 + .3 * pop, cx = x + ws[k] / 2;
    g.save(); g.translate(cx, y); g.scale(s, s);
    const txt = w.w.toUpperCase();
    g.lineWidth = size * .2; g.strokeStyle = INK; g.strokeText(txt, -ws[k] / 2, 0);
    const isKey = keyWords.some(kw => w.w.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(kw));
    g.fillStyle = isKey ? CYAN : '#fffaf0'; g.fillText(txt, -ws[k] / 2, 0);
    g.restore();
    x += ws[k] + gap;
  });
  g.restore();
}

// Zack-style captions: 1-3 words in sentence case, white bold sans with a thin black outline and a hard
// drop shadow, centred at 78% height. Chunks break at phrase ends (w.p), pauses, or 3 words; hard cuts, no pop.
export function captionChunks(words, max = 3, gap = .3) {
  const chunks = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (w.p || cur.length >= max || !next || next.s - w.e > gap) { chunks.push(cur); cur = []; }
  });
  return chunks.map(c => ({ text: c.map(w => w.w).join(' '), s: c[0].s, e: c[c.length - 1].e }));
}

export function zackCaptions(g, t, chunks, { y = 1500, size = 76 } = {}) {
  const c = chunks.find((c, i) => t >= c.s && t < (chunks[i + 1] ? chunks[i + 1].s : c.e + .4));
  if (!c) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = `700 ${size}px Cap`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  let s = size;                                   // shrink long chunks so they never touch the edges
  while (g.measureText(c.text).width > W - 220 && s > 44) { s -= 4; g.font = `700 ${s}px Cap`; }
  const x = (W - 120) / 2 + 60;                   // nudged left of the Shorts action buttons
  g.fillStyle = '#000'; g.fillText(c.text, x + s * .07, y + s * .08);
  g.lineWidth = s * .09; g.strokeStyle = '#000'; g.strokeText(c.text, x, y);
  g.fillStyle = '#fff'; g.fillText(c.text, x, y);
  g.restore();
}

// a rounded label pill that springs in at t0
export function pill(g, t, t0, x, y, text, { bg = CYAN, fg = '#0b0b0b', size = 44 } = {}) {
  const p = spring(t, t0, 16, .5);
  if (p <= 0) return;
  g.save(); g.translate(x, y); g.scale(p, p);
  g.font = `700 ${size}px Fredoka`;
  const w = g.measureText(text).width + size * 1.1, h = size * 1.6;
  rr(g, -w / 2, -h / 2, w, h, h / 2); paper(g, bg, { lift: .6, grain: 0 });
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 2);
  g.restore();
}

// a big number that counts up over ~11 frames and lands on its word
export function stamp(g, t, t0, x, y, value, { size = 230, suffix = '', dur = .37 } = {}) {
  if (t < t0) return;
  const p = prog(t, t0, dur, ease.outExpo), s = spring(t, t0, 12, .42);
  const shown = Math.round(lerp(Math.max(0, value - 60), value, p)) + suffix;
  g.save(); g.translate(x, y); g.scale(.6 + .4 * s, .6 + .4 * s);
  g.font = `700 ${size}px Fredoka`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = size * .14; g.strokeStyle = INK; g.strokeText(shown, 0, 0);
  g.fillStyle = CYAN; g.fillText(shown, 0, 0);
  g.restore();
}
