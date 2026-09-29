/**
 * Draws the decorative artwork used by the ready-made coupon templates (kash phool, dhak,
 * lal-paar border, marigold garland, diya, moon…) as SVG and saves transparent PNGs to
 * client/public/brand/coupon-*.png. The artwork is original and procedural.
 *
 *   npm i --no-save sharp && node scripts/generate-coupon-art.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('sharp is not installed. Run: npm i --no-save sharp && node scripts/generate-coupon-art.mjs');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'client', 'public', 'brand');
await mkdir(outDir, { recursive: true });

// Seeded random, so the artwork is identical every time the script runs.
let seed = 20261016;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const r = (a, b) => a + rand() * (b - a);
const f = (n) => Math.round(n * 10) / 10;
const TAU = Math.PI * 2;

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

// ── Alpana (same geometry as the site's Alpana motif) ──
function alpana(color, sw = 2.4) {
  const petal = (len, width) =>
    `M0 0 C ${width} ${-len * 0.35}, ${width * 0.6} ${-len * 0.85}, 0 ${-len} C ${-width * 0.6} ${-len * 0.85}, ${-width} ${-len * 0.35}, 0 0 Z`;
  const ring = (n, fn) => Array.from({ length: n }, (_, i) => fn((i / n) * 360, i)).join('');
  const body = `<g transform="translate(400 400) scale(2)" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round">
    <circle r="10"/><circle r="3" fill="${color}" stroke="none"/>
    ${ring(8, (a) => `<path d="${petal(42, 13)}" transform="rotate(${a}) translate(0 -12)"/>`)}
    <circle r="60"/>
    ${ring(32, (a) => `<circle r="2" cx="${f(Math.sin((a * TAU) / 360) * 66)}" cy="${f(-Math.cos((a * TAU) / 360) * 66)}" fill="${color}" stroke="none"/>`)}
    ${ring(16, (a) => `<path d="${petal(54, 15)}" transform="rotate(${a + 11.25}) translate(0 -74)"/>`)}
    ${ring(16, (a) => `<path d="${petal(26, 7)}" transform="rotate(${a + 11.25}) translate(0 -86)" opacity="0.7"/>`)}
    <circle r="134"/><circle r="140" stroke-dasharray="1 7" stroke-width="${sw * 2.2}"/>
    ${ring(24, (a) => `<path d="M -12 0 C -12 -18, 12 -18, 12 0" transform="rotate(${a}) translate(0 -148)"/>`)}
    ${ring(24, (a) => `<g transform="rotate(${a + 7.5}) translate(0 -168)"><path d="M0 8 C 6 0, 6 -8, 0 -16 C -6 -8, -6 0, 0 8 Z"/><circle r="1.8" cy="-24" fill="${color}" stroke="none"/></g>`)}
    <circle r="190" opacity="0.6"/>
  </g>`;
  return svg(800, 800, body);
}

// ── Lal paar: the red-and-gold border of a Bengali sari ──
function paar() {
  const w = 2400;
  const h = 72;
  let kolka = '';
  for (let x = 0; x < w; x += 36) {
    kolka += `<path d="M${x} 72 L${x + 9} 50 L${x + 18} 72 Z M${x + 18} 72 L${x + 27} 50 L${x + 36} 72 Z" fill="#a8201a"/>`;
    kolka += `<circle cx="${x + 18}" cy="52" r="2.6" fill="#d8b56a"/>`;
  }
  let dots = '';
  for (let x = 12; x < w; x += 24) dots += `<circle cx="${x}" cy="31" r="2" fill="#f4e3b8"/>`;
  return svg(w, h, `<rect width="${w}" height="24" fill="#a8201a"/><rect y="24" width="${w}" height="14" fill="#7f1611"/>${dots}<rect y="40" width="${w}" height="3" fill="#d8b56a"/>${kolka}`);
}

// ── Kash phool: autumn grass plumes, the first sign of Pujo ──
function kash() {
  const w = 700;
  const h = 900;
  let body = '';
  const stems = 7;
  for (let s = 0; s < stems; s += 1) {
    const bx = 250 + s * 32 + r(-20, 20);
    const lean = r(-120, 160);
    const top = r(60, 260);
    const cx = bx + lean * 0.4;
    const tx = bx + lean;
    body += `<path d="M${f(bx)} ${h} Q ${f(cx)} ${f((h + top) / 2)} ${f(tx)} ${f(top)}" stroke="#c9b58a" stroke-width="3" fill="none" opacity="0.9"/>`;
    // Feathery plume along the upper part of the stem.
    for (let i = 0; i < 120; i += 1) {
      const t = i / 120;
      const tt = 1 - t * 0.5;
      const x = (1 - tt) ** 2 * bx + 2 * (1 - tt) * tt * cx + tt ** 2 * tx;
      const y = (1 - tt) ** 2 * h + 2 * (1 - tt) * tt * ((h + top) / 2) + tt ** 2 * top;
      const len = (1 - t) * 14 + 52 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + r(-6, 6);
      for (const side of [-1, 1]) {
        const ang = -Math.PI / 2 + side * r(0.3, 1.0) + (lean / 900);
        const x2 = x + Math.cos(ang) * len;
        const y2 = y + Math.sin(ang) * len;
        body += `<path d="M${f(x)} ${f(y)} Q ${f((x + x2) / 2 + side * 6)} ${f((y + y2) / 2)} ${f(x2)} ${f(y2)}" stroke="#ffffff" stroke-width="${f(r(1.4, 2.8))}" stroke-linecap="round" fill="none" opacity="${f(r(0.5, 0.95))}"/>`;
      }
    }
  }
  // Leaves at the base.
  for (let i = 0; i < 9; i += 1) {
    const bx = 240 + i * 28;
    const tx = bx + r(-200, 220);
    body += `<path d="M${bx} ${h} Q ${f((bx + tx) / 2)} ${f(h - 200)} ${f(tx)} ${f(h - r(220, 380))}" stroke="#7d8f55" stroke-width="${f(r(3, 6))}" fill="none" stroke-linecap="round" opacity="0.85"/>`;
  }
  return svg(w, h, `<g filter="url(#soft)">${body}</g>`, '<filter id="soft"><feGaussianBlur stdDeviation="0.6"/></filter>');
}

// ── Dhak: the festival drum with its kash-feather plume ──
function dhak() {
  const w = 640;
  const h = 760;
  let plume = '';
  for (let i = 0; i < 90; i += 1) {
    const a = r(-2.6, -0.55);
    const len = r(90, 190);
    const x1 = 300;
    const y1 = 250;
    plume += `<path d="M${x1} ${y1} Q ${f(x1 + Math.cos(a) * len * 0.5 + r(-10, 10))} ${f(y1 + Math.sin(a) * len * 0.5)} ${f(x1 + Math.cos(a) * len)} ${f(y1 + Math.sin(a) * len)}" stroke="#ffffff" stroke-width="${f(r(1.5, 3))}" stroke-linecap="round" fill="none" opacity="${f(r(0.6, 1))}"/>`;
  }
  let ropes = '';
  for (let i = 0; i <= 10; i += 1) {
    const y = 350 + i * 30;
    ropes += `<path d="M${130 + Math.sin((i / 10) * Math.PI) * -18} ${y} L ${510 + Math.sin((i / 10) * Math.PI) * 18} ${y + 30}" stroke="#f1dfb8" stroke-width="3" opacity="0.8"/>`;
    ropes += `<path d="M${510 + Math.sin((i / 10) * Math.PI) * 18} ${y} L ${130 + Math.sin((i / 10) * Math.PI) * -18} ${y + 30}" stroke="#f1dfb8" stroke-width="3" opacity="0.8"/>`;
  }
  const defs = `<linearGradient id="body" x1="0" x2="1"><stop offset="0" stop-color="#6e120e"/><stop offset="0.45" stop-color="#c42b1f"/><stop offset="1" stop-color="#5a0e0b"/></linearGradient>
    <linearGradient id="skin" x1="0" x2="1"><stop offset="0" stop-color="#e9d6ad"/><stop offset="1" stop-color="#c9ad76"/></linearGradient>`;
  const body = `<g>${plume}</g>
    <path d="M300 250 L300 330" stroke="#3a241a" stroke-width="6"/>
    <path d="M140 340 C 110 450, 110 600, 140 700 L 500 700 C 530 600, 530 450, 500 340 Z" fill="url(#body)"/>
    <ellipse cx="320" cy="340" rx="180" ry="34" fill="url(#skin)" stroke="#2b1a12" stroke-width="6"/>
    <ellipse cx="320" cy="700" rx="180" ry="30" fill="#3a241a"/>
    ${ropes}
    <rect x="118" y="480" width="404" height="16" rx="8" fill="#231a15"/>
    <rect x="118" y="560" width="404" height="16" rx="8" fill="#231a15"/>
    <path d="M500 380 L 600 250" stroke="#5a3a22" stroke-width="10" stroke-linecap="round"/>
    <circle cx="604" cy="244" r="12" fill="#5a3a22"/>`;
  return svg(w, h, body, defs);
}

// ── Marigold garland (genda phool mala) hanging in swags ──
function marigold() {
  const w = 2400;
  const h = 300;
  const flower = (x, y, s, c1, c2) => {
    let p = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="${c2}"/>`;
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * TAU + r(-0.1, 0.1);
      p += `<circle cx="${f(x + Math.cos(a) * s * 0.62)}" cy="${f(y + Math.sin(a) * s * 0.62)}" r="${f(s * 0.42)}" fill="${c1}" opacity="0.9"/>`;
    }
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      p += `<circle cx="${f(x + Math.cos(a) * s * 0.3)}" cy="${f(y + Math.sin(a) * s * 0.3)}" r="${f(s * 0.3)}" fill="${c2}"/>`;
    }
    return p;
  };
  let body = '';
  const swag = 400;
  for (let sx = 0; sx < w; sx += swag) {
    for (let i = 0; i <= 18; i += 1) {
      const t = i / 18;
      const x = sx + t * swag;
      const y = 30 + Math.sin(t * Math.PI) * 170;
      const orange = i % 3 === 0;
      body += `<path d="M${f(x - 10)} ${f(y)} q 10 -14 22 -4 q -4 12 -22 4z" fill="#5c7f3a" opacity="0.9"/>`;
      body += flower(x, y, 24, orange ? '#f07a1a' : '#f6b21b', orange ? '#d9580f' : '#e89a0c');
    }
    // A hanging tassel in the middle of each swag.
    for (let k = 0; k < 3; k += 1) body += flower(sx + swag / 2, 230 + k * 28, 15 - k * 2, '#f6b21b', '#e89a0c');
    body += flower(sx, 30, 26, '#c42b1f', '#8f1a14');
  }
  return svg(w, h, body);
}

// ── Mango-leaf toran (aam pallab), for auspicious days and Poila Boishakh ──
function mangoToran() {
  const w = 2400;
  const h = 220;
  let body = `<path d="M0 26 L ${w} 26" stroke="#8a5a2b" stroke-width="6"/>`;
  for (let x = 20; x < w; x += 46) {
    const len = r(120, 170);
    const tilt = r(-8, 8);
    body += `<g transform="translate(${x} 26) rotate(${f(tilt)})">
      <path d="M0 0 C 26 ${f(len * 0.3)}, 22 ${f(len * 0.8)}, 0 ${f(len)} C -22 ${f(len * 0.8)}, -26 ${f(len * 0.3)}, 0 0 Z" fill="${rand() > 0.5 ? '#3f7a2f' : '#58923a'}"/>
      <path d="M0 4 L0 ${f(len - 6)}" stroke="#a9d27a" stroke-width="2" opacity="0.8"/>
    </g>`;
  }
  for (let x = 43; x < w; x += 92) body += `<circle cx="${x}" cy="30" r="13" fill="#f07a1a"/><circle cx="${x}" cy="30" r="7" fill="#f6b21b"/>`;
  return svg(w, h, body);
}

// ── Diya: an earthen lamp with a warm glow ──
function diya() {
  const defs = `<radialGradient id="glow"><stop offset="0" stop-color="#ffd76a" stop-opacity="0.9"/><stop offset="0.4" stop-color="#ffb03a" stop-opacity="0.35"/><stop offset="1" stop-color="#ff8a00" stop-opacity="0"/></radialGradient>
    <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6a00"/><stop offset="0.5" stop-color="#ffb400"/><stop offset="1" stop-color="#fff4c2"/></linearGradient>
    <linearGradient id="clay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9784a"/><stop offset="1" stop-color="#8a3b1c"/></linearGradient>`;
  const body = `<circle cx="300" cy="230" r="230" fill="url(#glow)"/>
    <path d="M300 60 C 350 150, 345 215, 300 250 C 255 215, 250 150, 300 60 Z" fill="url(#flame)"/>
    <path d="M300 150 C 318 190, 316 222, 300 240 C 284 222, 282 190, 300 150 Z" fill="#fff8dd"/>
    <path d="M110 300 C 150 420, 450 420, 490 300 C 420 330, 180 330, 110 300 Z" fill="url(#clay)"/>
    <path d="M110 300 C 180 270, 420 270, 490 300 C 420 330, 180 330, 110 300 Z" fill="#b95a2e"/>
    <path d="M490 300 L 560 282 L 505 320 Z" fill="#b95a2e"/>
    <path d="M150 350 C 230 380, 370 380, 450 350" stroke="#f3c07a" stroke-width="5" fill="none" stroke-dasharray="2 14" stroke-linecap="round"/>`;
  return svg(600, 440, body, defs);
}

// ── Full moon of Kojagori Lakshmi Puja ──
function moon() {
  const defs = `<radialGradient id="halo"><stop offset="0.45" stop-color="#fff6d8" stop-opacity="0.7"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>
    <radialGradient id="face" cx="0.4" cy="0.35"><stop offset="0" stop-color="#fffdf2"/><stop offset="1" stop-color="#ecdcae"/></radialGradient>`;
  let craters = '';
  for (let i = 0; i < 7; i += 1) craters += `<circle cx="${f(r(230, 370))}" cy="${f(r(230, 370))}" r="${f(r(10, 30))}" fill="#d8c48c" opacity="${f(r(0.12, 0.25))}" filter="url(#cb)"/>`;
  return svg(600, 600, `<circle cx="300" cy="300" r="300" fill="url(#halo)"/><circle cx="300" cy="300" r="150" fill="url(#face)"/>${craters}`, `${defs}<filter id="cb"><feGaussianBlur stdDeviation="4"/></filter>`);
}

// ── Banana leaf, for bhog coupons ──
function bananaLeaf() {
  const defs = `<linearGradient id="leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8f3a"/><stop offset="0.5" stop-color="#3c7a2c"/><stop offset="1" stop-color="#2d5f21"/></linearGradient>`;
  let veins = '';
  for (let x = 60; x < 1140; x += 18) {
    veins += `<path d="M${x} 250 C ${x + 30} 180, ${x + 50} 110, ${x + 70} ${f(40 + Math.abs(600 - x) * 0.05)}" stroke="#7fb55e" stroke-width="2" fill="none" opacity="0.55"/>`;
    veins += `<path d="M${x} 250 C ${x + 30} 320, ${x + 50} 390, ${x + 70} ${f(460 - Math.abs(600 - x) * 0.05)}" stroke="#7fb55e" stroke-width="2" fill="none" opacity="0.55"/>`;
  }
  const body = `<path d="M20 250 C 200 10, 1000 0, 1180 250 C 1000 500, 200 490, 20 250 Z" fill="url(#leaf)"/>
    <clipPath id="c"><path d="M20 250 C 200 10, 1000 0, 1180 250 C 1000 500, 200 490, 20 250 Z"/></clipPath>
    <g clip-path="url(#c)">${veins}</g>
    <path d="M20 250 L 1180 250" stroke="#b9dd8f" stroke-width="7" stroke-linecap="round"/>`;
  return svg(1200, 500, body, defs);
}

// ── Shiuli (night jasmine) sprig ──
function shiuli() {
  const flower = (x, y, s) => {
    let p = '';
    for (let i = 0; i < 5; i += 1) p += `<ellipse cx="0" cy="${-11 * s}" rx="${5.5 * s}" ry="${11 * s}" transform="translate(${f(x)} ${f(y)}) rotate(${i * 72 + r(-8, 8)})" fill="#fffaf0" stroke="#e9dcc4" stroke-width="0.8"/>`;
    return `${p}<circle cx="${f(x)}" cy="${f(y)}" r="${f(4.8 * s)}" fill="#f07a1a"/>`;
  };
  let body = '<path d="M0 90 C 140 70, 260 130, 420 60 S 640 90, 700 40" stroke="#6d5a3a" stroke-width="4" fill="none"/>';
  for (let i = 0; i < 12; i += 1) {
    const x = 30 + i * 55;
    body += `<path d="M0 0 C 12 -10, 36 -10, 48 0 C 36 10, 12 10, 0 0 Z" fill="#5c7f3a" transform="translate(${x} ${f(80 + r(-30, 20))}) rotate(${f(r(-50, 40))})"/>`;
  }
  for (let i = 0; i < 16; i += 1) body += flower(r(20, 680), r(30, 200), r(1.1, 1.8));
  return svg(700, 240, body);
}

// ── Palash (flame of the forest), for Saraswati Puja and Basanta ──
function palash() {
  let body = '<path d="M40 380 C 180 300, 260 240, 420 200 S 640 120, 760 40" stroke="#4a3526" stroke-width="10" fill="none" stroke-linecap="round"/>';
  const bloom = (x, y) => {
    let p = '';
    for (let i = 0; i < 6; i += 1) {
      const a = r(-2.8, -0.3);
      const len = r(40, 70);
      p += `<path d="M${f(x)} ${f(y)} C ${f(x + Math.cos(a) * len * 0.6 + 12)} ${f(y + Math.sin(a) * len * 0.6)}, ${f(x + Math.cos(a) * len)} ${f(y + Math.sin(a) * len - 10)}, ${f(x + Math.cos(a) * len - 6)} ${f(y + Math.sin(a) * len + 4)}" stroke="${rand() > 0.4 ? '#f2571f' : '#ff7e2b'}" stroke-width="${f(r(9, 14))}" stroke-linecap="round" fill="none"/>`;
    }
    return `${p}<circle cx="${f(x)}" cy="${f(y)}" r="6" fill="#3b2a1e"/>`;
  };
  for (let i = 0; i < 9; i += 1) {
    const t = i / 8;
    body += bloom(60 + t * 680 + r(-10, 10), 370 - t * 320 + r(-20, 10));
  }
  return svg(800, 420, body);
}

// ── Sindoor splash, for Bijoya and sindoor khela ──
function sindoor() {
  const defs = '<filter id="b"><feGaussianBlur stdDeviation="3"/></filter>';
  let body = '';
  const blob = (cx, cy, rr, color, o) => {
    // A smooth, irregular splash: random radii joined with quadratic curves through midpoints.
    const n = 12;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * TAU;
      const rad = rr * r(0.72, 1.18);
      return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
    });
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let d = `M${f(mid(pts[n - 1], pts[0])[0])} ${f(mid(pts[n - 1], pts[0])[1])} `;
    for (let i = 0; i < n; i += 1) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      d += `Q ${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])} `;
    }
    return `<path d="${d}Z" fill="${color}" opacity="${o}" filter="url(#b)"/>`;
  };
  body += blob(300, 300, 190, '#c42b1f', 0.9);
  body += blob(320, 290, 130, '#e0352a', 0.9);
  body += blob(280, 320, 80, '#8f1a14', 0.6);
  for (let i = 0; i < 40; i += 1) {
    const a = r(0, TAU);
    const d = r(200, 290);
    body += `<circle cx="${f(300 + Math.cos(a) * d)}" cy="${f(300 + Math.sin(a) * d)}" r="${f(r(3, 14))}" fill="#c42b1f" opacity="${f(r(0.5, 0.95))}"/>`;
  }
  return svg(600, 600, body, defs);
}

// ── Lotus ──
function lotus() {
  const defs = `<linearGradient id="p" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e46a8b"/><stop offset="1" stop-color="#ffd3de"/></linearGradient>
    <linearGradient id="q" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#c9476c"/><stop offset="1" stop-color="#f7a9bd"/></linearGradient>`;
  const petal = (a, len, wid, fill) =>
    `<path d="M0 0 C ${wid} ${-len * 0.35}, ${wid * 0.55} ${-len * 0.85}, 0 ${-len} C ${-wid * 0.55} ${-len * 0.85}, ${-wid} ${-len * 0.35}, 0 0 Z" fill="${fill}" stroke="#b83a5e" stroke-width="1.5" transform="translate(300 330) rotate(${a})"/>`;
  let body = '';
  for (const a of [-80, 80, -62, 62]) body += petal(a, 170, 60, 'url(#q)');
  for (const a of [-40, 40, -20, 20]) body += petal(a, 220, 70, 'url(#p)');
  body += petal(0, 240, 74, 'url(#p)');
  body += '<path d="M120 340 C 200 380, 400 380, 480 340 C 420 400, 180 400, 120 340 Z" fill="#4f8f3a"/>';
  return svg(600, 420, body, defs);
}

// ── Gold corner flourish ──
function corner() {
  let body = '';
  const g = '#d8b56a';
  body += `<path d="M20 380 L20 60 Q 20 20 60 20 L380 20" stroke="${g}" stroke-width="5" fill="none"/>`;
  body += `<path d="M44 360 L44 80 Q 44 44 80 44 L360 44" stroke="${g}" stroke-width="2" fill="none" opacity="0.8"/>`;
  body += `<path d="M60 60 C 140 60, 170 90, 170 140 C 170 180, 130 190, 115 165 C 100 140, 125 120, 140 132" stroke="${g}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  body += `<path d="M60 60 C 60 140, 90 170, 140 170 C 180 170, 190 130, 165 115 C 140 100, 120 125, 132 140" stroke="${g}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  body += `<circle cx="60" cy="60" r="12" fill="${g}"/>`;
  for (let i = 0; i < 6; i += 1) body += `<circle cx="${200 + i * 30}" cy="44" r="4" fill="${g}"/><circle cx="44" cy="${200 + i * 30}" r="4" fill="${g}"/>`;
  return svg(400, 400, body);
}

// ── Musical notes, for cultural evenings ──
function notes() {
  const g = '#e8c77a';
  let staff = '';
  for (let i = 0; i < 5; i += 1) staff += `<path d="M0 ${140 + i * 18} C 200 ${100 + i * 18}, 400 ${200 + i * 18}, 600 ${130 + i * 18} S 900 ${90 + i * 18}, 1000 ${150 + i * 18}" stroke="${g}" stroke-width="2" fill="none" opacity="0.55"/>`;
  const note = (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})" fill="${g}"><ellipse cx="0" cy="0" rx="16" ry="11" transform="rotate(-20)"/><rect x="12" y="-90" width="5" height="90"/><path d="M17 -90 C 40 -70, 50 -50, 35 -30 C 42 -52, 30 -62, 17 -66 Z"/></g>`;
  const pair = (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})" fill="${g}"><ellipse cx="0" cy="0" rx="16" ry="11" transform="rotate(-20)"/><ellipse cx="60" cy="-12" rx="16" ry="11" transform="rotate(-20 60 -12)"/><rect x="12" y="-90" width="5" height="90"/><rect x="72" y="-102" width="5" height="90"/><path d="M12 -92 L77 -104 L77 -88 L12 -76 Z"/></g>`;
  return svg(1000, 300, `${staff}${note(150, 200, 1)}${pair(330, 190, 1.1)}${note(560, 170, 0.9)}${pair(720, 175, 1)}${note(920, 200, 0.8)}`);
}

// ── Stars / sparkles for night themes ──
function sparkles() {
  let body = '';
  for (let i = 0; i < 70; i += 1) {
    const x = r(0, 1200);
    const y = r(0, 600);
    const s = r(1, 3.5);
    if (rand() > 0.85) {
      body += `<path d="M${f(x)} ${f(y - s * 4)} L${f(x + s)} ${f(y - s)} L${f(x + s * 4)} ${f(y)} L${f(x + s)} ${f(y + s)} L${f(x)} ${f(y + s * 4)} L${f(x - s)} ${f(y + s)} L${f(x - s * 4)} ${f(y)} L${f(x - s)} ${f(y - s)} Z" fill="#fff3c8" opacity="${f(r(0.6, 1))}"/>`;
    } else body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.6)}" fill="#fff3c8" opacity="${f(r(0.3, 0.9))}"/>`;
  }
  return svg(1200, 600, body);
}

const ART = {
  'coupon-alpana-gold': alpana('#d8b56a'),
  'coupon-alpana-white': alpana('#fffaf0'),
  'coupon-alpana-red': alpana('#a8201a'),
  'coupon-paar': paar(),
  'coupon-kash': kash(),
  'coupon-dhak': dhak(),
  'coupon-marigold': marigold(),
  'coupon-mango-toran': mangoToran(),
  'coupon-diya': diya(),
  'coupon-moon': moon(),
  'coupon-banana-leaf': bananaLeaf(),
  'coupon-shiuli': shiuli(),
  'coupon-palash': palash(),
  'coupon-sindoor': sindoor(),
  'coupon-lotus': lotus(),
  'coupon-corner': corner(),
  'coupon-notes': notes(),
  'coupon-sparkles': sparkles(),
};

// Line art compresses well as a palette PNG; soft glows and gradients keep full colour.
const SMOOTH = new Set(['coupon-diya', 'coupon-moon', 'coupon-sindoor', 'coupon-lotus', 'coupon-banana-leaf', 'coupon-dhak']);
for (const [name, source] of Object.entries(ART)) {
  const file = path.join(outDir, `${name}.png`);
  const png = SMOOTH.has(name) ? { compressionLevel: 9 } : { compressionLevel: 9, palette: true, quality: 90 };
  const info = await sharp(Buffer.from(source)).png(png).toFile(file);
  console.log(`+ ${name}.png (${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB)`);
}
