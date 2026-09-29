/**
 * Ready-made Parbon coupon designs, grouped by occasion. The designer and the "Add coupon type" form
 * start from one of these; a coupon type with no saved design uses the template for its kind.
 * Artwork lives in client/public/brand/coupon-*.png (drawn by scripts/generate-coupon-art.mjs).
 */
const LOGO = '/brand/logo-480.png';
const art = (name) => `/brand/coupon-${name}.png`;

export const THEMES = [
  { id: 'durga', label: 'Durga Puja' },
  { id: 'bhog', label: 'Bhog & food' },
  { id: 'culture', label: 'Cultural night' },
  { id: 'bijoya', label: 'Bijoya' },
  { id: 'lakshmi', label: 'Lakshmi & Kali Puja' },
  { id: 'saraswati', label: 'Saraswati Puja' },
  { id: 'boishakh', label: 'Poila Boishakh' },
  { id: 'vip', label: 'VIP & donors' },
  { id: 'general', label: 'Any event' },
];

// ── Small builders so each template reads like a layout ──
const text = (id, value, x, y, w, h, o = {}) => ({ id, type: 'text', text: value, x, y, w, h, font: 'body', size: 24, weight: 400, color: '#231a15', ...o });
const code = (id, x, y, w, h, o = {}) => ({ id, type: 'code', x, y, w, h, font: 'mono', size: 34, weight: 700, letterSpacing: 4, align: 'center', color: '#231a15', ...o });
const qr = (id, x, y, s, o = {}) => ({ id, type: 'qr', x, y, w: s, h: s, fg: '#231a15', bg: '#ffffff', padding: 14, radius: 18, ...o });
const img = (id, src, x, y, w, h, o = {}) => ({ id, type: 'image', src, x, y, w, h, fit: 'contain', blend: 'normal', ...o });
const rect = (id, x, y, w, h, fill, o = {}) => ({ id, type: 'shape', shape: 'rect', x, y, w, h, fill, stroke: 'transparent', strokeWidth: 0, radius: 0, ...o });
const oval = (id, x, y, w, h, fill, o = {}) => ({ id, type: 'shape', shape: 'ellipse', x, y, w, h, fill, stroke: 'transparent', strokeWidth: 0, ...o });
const icon = (id, name, x, y, s, color, o = {}) => ({ id, type: 'icon', name, x, y, w: s, h: s, color, strokeWidth: 1.5, ...o });
const bg = (from, to, angle = 135, image = null) => ({ color: from, gradient: to ? { from, to, angle } : null, image });

/** The tear-off stub on the right of a 1200×560 ticket: QR, code and a Bengali label. */
const stub = ({ fill, ink = '#fffaf0', label = 'Scan at entry', bn, perf = '#fffaf0', qrFg = '#231a15' }) => [
  rect('stub', 850, 0, 350, 560, fill),
  { id: 'perf', type: 'shape', shape: 'line', x: 590, y: 278, w: 520, h: 4, rotate: 90, fill: 'transparent', stroke: perf, strokeWidth: 5, dashed: true },
  text('scan', label, 870, 40, 310, 30, { size: 18, weight: 700, uppercase: true, letterSpacing: 5, color: ink, align: 'center', opacity: 0.85 }),
  qr('qr', 905, 86, 240, { fg: qrFg }),
  code('code', 870, 346, 310, 50, { color: ink }),
  ...(bn ? [text('stubBn', bn, 870, 410, 310, 64, { font: 'bengali', size: 40, color: ink, align: 'center' })] : []),
  text('price', '{{price}}', 870, 482, 310, 36, { size: 20, weight: 600, color: ink, align: 'center', opacity: 0.8 }),
];

/** The holder's details on the left of a ticket. */
const details = ({ x = 230, w = 590, y = 318, ink = '#231a15', soft = '#6b5d53', nameFont = 'display' }) => [
  text('name', '{{name}}', x, y, w, 52, { font: nameFont, size: 42, weight: 600, color: ink }),
  text('date', '{{date}}', x, y + 64, w, 34, { size: 22, weight: 600, color: ink, opacity: 0.85 }),
  text('venue', '{{venue}}', x, y + 100, w, 60, { size: 20, color: soft }),
];

const ticket = (o) => ({
  version: 1,
  width: 1200,
  height: 560,
  background: o.background,
  border: { color: o.borderColor || '#a8201a', width: o.borderWidth || 0, radius: o.radius ?? 36 },
  elements: o.elements,
});

const card = (o) => ({
  version: 1,
  width: 800,
  height: 1200,
  background: o.background,
  border: { color: o.borderColor || '#d8bf8a', width: o.borderWidth ?? 14, radius: o.radius ?? 40 },
  elements: o.elements,
});

// ── The original three, kept for existing coupon types ──
const classic = ({ stubFill, bgFrom, bgTo, accent, kicker, bengali, iconName, countText = 'Admits {{quantity}}' }) =>
  ticket({
    background: bg(bgFrom, bgTo, 120),
    borderColor: accent,
    elements: [
      ...stub({ fill: stubFill, bn: bengali, ink: '#efe2c4' }).filter((e) => e.id !== 'code'),
      code('code', 870, 346, 310, 50, { color: '#ffffff' }),
      icon('motif', 'alpana', 58, 262, 130, '#d8bf8a', { strokeWidth: 1.2, opacity: 0.9 }),
      img('logo', LOGO, 44, 34, 156, 184, { blend: 'multiply' }),
      text('kicker', kicker, 230, 58, 590, 30, { size: 19, weight: 700, uppercase: true, letterSpacing: 6, color: '#984520' }),
      text('title', '{{event}}', 230, 92, 590, 136, { font: 'display', size: 62, weight: 600, lineHeight: 1.02, color: accent }),
      text('badge', '{{type}}', 230, 244, 300, 50, { size: 22, weight: 700, uppercase: true, letterSpacing: 3, color: '#fffaf1', background: '#231a15', radius: 25, align: 'center', valign: 'middle' }),
      text('admits', countText, 548, 244, 272, 50, { size: 24, weight: 700, color: accent, valign: 'middle' }),
      ...details({}),
      rect('rule', 44, 500, 776, 4, '#b08a45', { radius: 2 }),
      icon('icon', iconName, 776, 20, 52, '#b08a45', { strokeWidth: 1.4 }),
    ],
  });

export const TEMPLATES = [
  // ── Durga Puja ──
  {
    id: 'entry',
    label: 'Sindoor red ticket',
    theme: 'durga',
    kind: 'entry',
    design: classic({ stubFill: '#a8201a', bgFrom: '#fffaf1', bgTo: '#f3e3c6', accent: '#a8201a', kicker: 'Parbon Sanskritik Samity', bengali: 'প্রবেশপত্র', iconName: 'dhak' }),
  },
  {
    id: 'durga-kash',
    label: 'Sharat sky & kash phool',
    theme: 'durga',
    kind: 'entry',
    design: ticket({
      background: bg('#b9d4ee', '#fdf4e3', 170),
      elements: [
        oval('sun', 470, -160, 420, 420, '#fff6dc', { opacity: 0.8 }),
        img('kash', art('kash'), -40, 120, 360, 463, { opacity: 0.95 }),
        img('kash2', art('kash'), 640, 190, 290, 373, { opacity: 0.7 }),
        img('paar', art('paar'), 0, 524, 1200, 36, { fit: 'cover' }),
        img('logo', LOGO, 250, 36, 110, 130, { blend: 'multiply' }),
        text('kicker', 'শারদীয়া · Sharadiya', 370, 60, 460, 36, { font: 'bengali', size: 28, color: '#7f1611' }),
        text('title', '{{event}}', 250, 168, 580, 118, { font: 'display', size: 54, weight: 600, lineHeight: 1.04, color: '#7f1611' }),
        text('type', '{{type}} · Admits {{quantity}}', 250, 292, 580, 40, { size: 22, weight: 700, color: '#a8201a', uppercase: true, letterSpacing: 2 }),
        ...details({ x: 250, w: 580, y: 340, soft: '#4a3328' }),
        ...stub({ fill: '#a8201a', bn: 'মা আসছেন', perf: '#fdf4e3' }),
      ],
    }),
  },
  {
    id: 'durga-dhak',
    label: 'Dhaker taal — night',
    theme: 'durga',
    kind: 'entry',
    design: ticket({
      background: bg('#3b0a08', '#7f1611', 120),
      elements: [
        img('alpana', art('alpana-gold'), -170, -60, 680, 680, { opacity: 0.22 }),
        img('paar', art('paar'), 0, 0, 850, 26, { fit: 'cover' }),
        img('dhak', art('dhak'), 600, 170, 250, 297),
        text('kicker', 'Parbon Sanskritik Samity', 60, 64, 560, 30, { size: 18, weight: 700, uppercase: true, letterSpacing: 6, color: '#d8b56a' }),
        text('title', '{{event}}', 60, 100, 560, 140, { font: 'display', size: 66, weight: 600, lineHeight: 1, color: '#fff3d6' }),
        text('badge', '{{type}} ×{{quantity}}', 60, 250, 320, 50, { size: 22, weight: 700, uppercase: true, letterSpacing: 2, color: '#3b0a08', background: '#d8b56a', radius: 25, align: 'center', valign: 'middle' }),
        ...details({ x: 60, w: 540, y: 330, ink: '#fff3d6', soft: '#e9cfa0' }),
        ...stub({ fill: '#1e0605', ink: '#e8c77a', bn: 'ঢাকের তালে', perf: '#d8b56a' }),
      ],
    }),
  },
  {
    id: 'durga-lalpaar',
    label: 'Lal-paar sari — card',
    theme: 'durga',
    kind: 'entry',
    design: card({
      background: bg('#fffdf7', '#f7ecd9', 180),
      borderColor: '#a8201a',
      borderWidth: 0,
      elements: [
        rect('bandTop', 0, 0, 800, 46, '#a8201a'),
        img('paarTop', art('paar'), 0, 46, 800, 24, { fit: 'cover' }),
        img('paarBottom', art('paar'), 0, 1130, 800, 24, { fit: 'cover', rotate: 180 }),
        rect('bandBottom', 0, 1154, 800, 46, '#a8201a'),
        img('alpana', art('alpana-red'), 130, 330, 540, 540, { opacity: 0.12 }),
        img('logo', LOGO, 330, 92, 140, 165, { blend: 'multiply' }),
        text('bn', 'শুভ শারদীয়া', 60, 262, 680, 64, { font: 'bengali', size: 48, color: '#a8201a', align: 'center' }),
        text('title', '{{event}}', 60, 330, 680, 60, { font: 'display', size: 44, weight: 600, color: '#231a15', align: 'center' }),
        qr('qr', 240, 410, 320, { padding: 14, radius: 20, bg: '#ffffff' }),
        code('code', 100, 746, 600, 56, { size: 40, letterSpacing: 6 }),
        text('type', '{{type}} · Admits {{quantity}}', 100, 812, 600, 44, { size: 26, weight: 700, color: '#a8201a', align: 'center', uppercase: true, letterSpacing: 2 }),
        text('name', '{{name}}', 100, 872, 600, 56, { font: 'display', size: 42, weight: 600, align: 'center' }),
        text('date', '{{date}}', 100, 940, 600, 36, { size: 22, weight: 600, align: 'center', color: '#3a302b' }),
        text('venue', '{{venue}}', 100, 980, 600, 70, { size: 20, align: 'center', color: '#6b5d53' }),
        icon('lotus', 'lotus', 370, 1066, 60, '#b08a45'),
      ],
    }),
  },
  {
    id: 'durga-shiuli',
    label: 'Shiuli morning — soft',
    theme: 'durga',
    kind: 'other',
    design: card({
      background: bg('#fff8ee', '#f6e2cc', 170),
      borderColor: '#e9c9a5',
      borderWidth: 10,
      elements: [
        img('shiuli', art('shiuli'), -20, 20, 840, 288),
        img('shiuli2', art('shiuli'), 120, 1000, 700, 240, { rotate: 180, opacity: 0.85 }),
        text('bn', 'আগমনী', 60, 250, 680, 64, { font: 'bengali', size: 50, color: '#c2410c', align: 'center' }),
        text('title', '{{event}}', 60, 320, 680, 60, { font: 'display', size: 46, weight: 600, color: '#5a2d0c', align: 'center' }),
        qr('qr', 250, 400, 300, { fg: '#5a2d0c', padding: 16, radius: 28 }),
        code('code', 100, 720, 600, 56, { size: 38, color: '#5a2d0c' }),
        text('type', '{{type}} · {{quantity}}', 100, 786, 600, 40, { size: 24, weight: 700, color: '#c2410c', align: 'center', uppercase: true, letterSpacing: 3 }),
        text('name', '{{name}}', 100, 840, 600, 56, { font: 'display', size: 42, weight: 600, align: 'center', color: '#231a15' }),
        text('date', '{{date}} · {{time}}', 100, 906, 600, 36, { size: 21, weight: 600, align: 'center', color: '#4a3328' }),
        text('venue', '{{venue}}', 100, 944, 600, 60, { size: 19, align: 'center', color: '#6b5d53' }),
      ],
    }),
  },

  // ── Bhog & food ──
  {
    id: 'food',
    label: 'Bhog gold ticket',
    theme: 'bhog',
    kind: 'food',
    design: classic({ stubFill: '#984520', bgFrom: '#fff7e6', bgTo: '#f6d9a8', accent: '#984520', kicker: 'Parbon · Bhog & Prasad', bengali: 'ভোগের কুপন', iconName: 'bhog', countText: 'Serves {{quantity}}' }),
  },
  {
    id: 'bhog-leaf',
    label: 'Banana leaf bhog',
    theme: 'bhog',
    kind: 'food',
    design: ticket({
      background: bg('#fffaf0', '#f4ead2', 160),
      elements: [
        img('garland', art('marigold'), 0, -20, 850, 106, { fit: 'cover' }),
        img('leaf', art('banana-leaf'), -60, 300, 620, 258, { rotate: -6 }),
        text('bn', 'ভোগ', 560, 360, 260, 120, { font: 'bengali', size: 96, color: '#2d5f21', align: 'center' }),
        text('title', '{{event}}', 60, 100, 760, 70, { font: 'display', size: 52, weight: 600, color: '#2d5f21' }),
        text('type', '{{type}}', 60, 172, 760, 44, { font: 'display', size: 36, weight: 600, color: '#984520' }),
        text('serves', 'Serves {{quantity}} · {{name}}', 60, 226, 760, 40, { size: 24, weight: 700, color: '#231a15' }),
        text('date', '{{date}}', 60, 272, 500, 30, { size: 20, weight: 600, color: '#4a3328' }),
        ...stub({ fill: '#2d5f21', label: 'Show at the counter', bn: 'প্রসাদ', perf: '#f4ead2' }),
      ],
    }),
  },
  {
    id: 'bhog-marigold',
    label: 'Marigold prasad — card',
    theme: 'bhog',
    kind: 'food',
    design: card({
      background: bg('#fff1d6', '#ffcf86', 180),
      borderColor: '#e07a12',
      borderWidth: 12,
      elements: [
        img('garland', art('marigold'), -40, -10, 880, 110, { fit: 'cover' }),
        img('leaf', art('banana-leaf'), 60, 950, 680, 283, { opacity: 0.9 }),
        img('logo', LOGO, 340, 110, 120, 141, { blend: 'multiply' }),
        text('bn', 'মায়ের ভোগ', 60, 256, 680, 70, { font: 'bengali', size: 54, color: '#8f1a14', align: 'center' }),
        text('title', '{{event}}', 60, 330, 680, 50, { font: 'display', size: 38, weight: 600, color: '#5a2d0c', align: 'center' }),
        qr('qr', 250, 400, 300, { radius: 24 }),
        code('code', 100, 716, 600, 56, { size: 38, color: '#5a2d0c' }),
        text('type', '{{type}}', 100, 780, 600, 50, { font: 'display', size: 40, weight: 600, color: '#8f1a14', align: 'center' }),
        text('serves', 'Serves {{quantity}} · {{name}}', 100, 836, 600, 40, { size: 24, weight: 700, color: '#231a15', align: 'center' }),
        text('date', '{{date}}', 100, 882, 600, 34, { size: 20, weight: 600, color: '#4a3328', align: 'center' }),
      ],
    }),
  },

  // ── Cultural night ──
  {
    id: 'card',
    label: 'Festive red card',
    theme: 'culture',
    kind: 'other',
    design: card({
      background: bg('#7f1611', '#c42b1f', 160),
      elements: [
        rect('panel', 60, 330, 680, 800, '#fffaf1', { radius: 32 }),
        oval('logoBg', 290, 30, 220, 220, '#fffaf1'),
        img('logo', LOGO, 315, 44, 170, 196, { blend: 'multiply' }),
        text('title', '{{event}}', 60, 256, 680, 70, { font: 'display', size: 50, weight: 600, color: '#efe2c4', align: 'center', valign: 'middle' }),
        text('type', '{{type}}', 100, 360, 600, 44, { size: 26, weight: 700, uppercase: true, letterSpacing: 6, color: '#a8201a', align: 'center' }),
        qr('qr', 220, 420, 360, { padding: 12, radius: 16 }),
        code('code', 100, 800, 600, 56, { size: 40, letterSpacing: 6 }),
        text('admits', 'Admits {{quantity}}', 100, 866, 600, 44, { size: 28, weight: 700, color: '#a8201a', align: 'center' }),
        text('name', '{{name}}', 100, 920, 600, 56, { font: 'display', size: 42, weight: 600, align: 'center' }),
        text('date', '{{date}}', 100, 986, 600, 36, { size: 22, weight: 600, color: '#3a302b', align: 'center' }),
        text('venue', '{{venue}}', 100, 1026, 600, 64, { size: 20, color: '#6b5d53', align: 'center' }),
        icon('lotus', 'lotus', 376, 1136, 48, '#d8bf8a'),
      ],
    }),
  },
  {
    id: 'culture-stage',
    label: 'Stage night — indigo & gold',
    theme: 'culture',
    kind: 'other',
    design: ticket({
      background: bg('#15112e', '#3d1f5c', 125),
      elements: [
        img('sparkles', art('sparkles'), 0, 0, 850, 560, { fit: 'cover', opacity: 0.9 }),
        oval('spot', 420, -220, 520, 600, '#fff1c9', { opacity: 0.1 }),
        img('notes', art('notes'), 40, 380, 760, 228, { opacity: 0.8 }),
        text('bn', 'সাংস্কৃতিক সন্ধ্যা', 60, 50, 700, 60, { font: 'bengali', size: 40, color: '#e8c77a' }),
        text('title', '{{event}}', 60, 116, 740, 120, { font: 'display', size: 60, weight: 600, lineHeight: 1, color: '#ffffff' }),
        text('type', '{{type}} · Admits {{quantity}}', 60, 246, 740, 40, { size: 22, weight: 700, uppercase: true, letterSpacing: 3, color: '#e8c77a' }),
        text('name', '{{name}}', 60, 300, 740, 50, { font: 'display', size: 40, weight: 600, color: '#ffffff' }),
        text('date', '{{date}} · {{time}}', 60, 354, 740, 32, { size: 20, weight: 600, color: '#d9cfee' }),
        ...stub({ fill: '#b08a45', ink: '#15112e', bn: 'মঞ্চ', perf: '#e8c77a' }),
      ],
    }),
  },
  {
    id: 'culture-poster',
    label: 'Concert poster — card',
    theme: 'culture',
    kind: 'other',
    design: card({
      background: bg('#0f1b24', '#1f3a44', 170),
      borderColor: '#d8b56a',
      borderWidth: 6,
      radius: 28,
      elements: [
        img('corner1', art('corner'), 18, 18, 200, 200),
        img('corner2', art('corner'), 582, 982, 200, 200, { rotate: 180 }),
        img('notes', art('notes'), -40, 150, 880, 264, { opacity: 0.55 }),
        text('kicker', 'Parbon presents', 60, 70, 680, 36, { size: 20, weight: 700, uppercase: true, letterSpacing: 8, color: '#d8b56a', align: 'center' }),
        text('title', '{{event}}', 80, 120, 640, 140, { font: 'display', size: 58, weight: 600, lineHeight: 1, color: '#fff6e0', align: 'center', valign: 'middle' }),
        qr('qr', 230, 420, 340, { radius: 12 }),
        code('code', 100, 780, 600, 56, { size: 38, color: '#fff6e0' }),
        text('type', '{{type}} · Admits {{quantity}}', 100, 846, 600, 40, { size: 24, weight: 700, color: '#d8b56a', align: 'center', uppercase: true, letterSpacing: 2 }),
        text('name', '{{name}}', 100, 900, 600, 56, { font: 'display', size: 42, weight: 600, color: '#fff6e0', align: 'center' }),
        text('date', '{{date}} · {{time}}', 100, 964, 600, 34, { size: 21, weight: 600, color: '#cfe0e3', align: 'center' }),
      ],
    }),
  },

  // ── Bijoya ──
  {
    id: 'bijoya-sindoor',
    label: 'Subho Bijoya — sindoor khela',
    theme: 'bijoya',
    kind: 'entry',
    design: ticket({
      background: bg('#fffdf8', '#f8eee0', 160),
      elements: [
        img('paarTop', art('paar'), 0, 0, 850, 26, { fit: 'cover' }),
        img('paarBottom', art('paar'), 0, 534, 850, 26, { fit: 'cover', rotate: 180 }),
        img('splash', art('sindoor'), -90, 150, 420, 420, { opacity: 0.9 }),
        text('bn', 'শুভ বিজয়া', 300, 56, 520, 90, { font: 'bengali', size: 72, color: '#a8201a' }),
        text('title', '{{event}}', 300, 150, 520, 110, { font: 'display', size: 48, weight: 600, lineHeight: 1.05, color: '#231a15' }),
        text('type', '{{type}} · Admits {{quantity}}', 300, 268, 520, 36, { size: 22, weight: 700, uppercase: true, letterSpacing: 2, color: '#a8201a' }),
        ...details({ x: 300, w: 520, y: 320 }),
        ...stub({ fill: '#a8201a', bn: 'কোলাকুলি', perf: '#fffdf8' }),
      ],
    }),
  },

  // ── Lakshmi & Kali Puja ──
  {
    id: 'lakshmi-moon',
    label: 'Kojagori full moon — card',
    theme: 'lakshmi',
    kind: 'entry',
    design: card({
      background: bg('#0d1a36', '#27416f', 180),
      borderColor: '#d8b56a',
      borderWidth: 8,
      elements: [
        img('sparkles', art('sparkles'), 0, 0, 800, 600, { fit: 'cover' }),
        img('moon', art('moon'), 190, -30, 420, 420),
        img('alpana', art('alpana-white'), 100, 560, 600, 600, { opacity: 0.08 }),
        text('bn', 'কোজাগরী লক্ষ্মীপূজা', 40, 360, 720, 64, { font: 'bengali', size: 46, color: '#f4d98c', align: 'center' }),
        text('title', '{{event}}', 60, 426, 680, 50, { font: 'display', size: 38, weight: 600, color: '#ffffff', align: 'center' }),
        qr('qr', 270, 496, 260, { radius: 16 }),
        code('code', 100, 772, 600, 56, { size: 38, color: '#ffffff' }),
        text('type', '{{type}} · Admits {{quantity}}', 100, 836, 600, 40, { size: 23, weight: 700, color: '#f4d98c', align: 'center', uppercase: true, letterSpacing: 2 }),
        text('name', '{{name}}', 100, 888, 600, 54, { font: 'display', size: 40, weight: 600, color: '#ffffff', align: 'center' }),
        text('date', '{{date}} · {{time}}', 100, 950, 600, 34, { size: 20, weight: 600, color: '#c9d6ee', align: 'center' }),
        img('diya', art('diya'), 290, 1000, 220, 161),
      ],
    }),
  },
  {
    id: 'diya-glow',
    label: 'Diya glow — festival of lights',
    theme: 'lakshmi',
    kind: 'entry',
    design: ticket({
      background: bg('#1f0b04', '#56200a', 130),
      elements: [
        img('sparkles', art('sparkles'), 0, 0, 850, 560, { fit: 'cover' }),
        img('garland', art('marigold'), 0, -24, 850, 106, { fit: 'cover' }),
        img('diya', art('diya'), 560, 300, 290, 213),
        text('bn', 'দীপাবলি', 60, 110, 500, 70, { font: 'bengali', size: 56, color: '#ffc861' }),
        text('title', '{{event}}', 60, 180, 560, 110, { font: 'display', size: 54, weight: 600, lineHeight: 1.02, color: '#fff3dc' }),
        text('type', '{{type}} · Admits {{quantity}}', 60, 296, 540, 36, { size: 22, weight: 700, uppercase: true, letterSpacing: 2, color: '#ffc861' }),
        ...details({ x: 60, w: 500, y: 344, ink: '#fff3dc', soft: '#f0caa0' }),
        ...stub({ fill: '#ffb638', ink: '#3b1406', bn: 'শুভ দীপাবলি', perf: '#ffc861' }),
      ],
    }),
  },

  // ── Saraswati Puja ──
  {
    id: 'saraswati-basanti',
    label: 'Basanti yellow — Saraswati Puja',
    theme: 'saraswati',
    kind: 'entry',
    design: ticket({
      background: bg('#fff7c7', '#ffd54a', 140),
      elements: [
        img('palash', art('palash'), 560, -70, 330, 173),
        img('lotus', art('lotus'), 40, 350, 260, 182),
        icon('book', 'book', 700, 420, 110, '#b45309', { opacity: 0.55 }),
        text('bn', 'সরস্বতী পূজা', 60, 60, 520, 80, { font: 'bengali', size: 60, color: '#b91c1c' }),
        text('title', '{{event}}', 60, 146, 740, 100, { font: 'display', size: 48, weight: 600, lineHeight: 1.02, color: '#7c2d12' }),
        text('type', '{{type}} · Admits {{quantity}}', 60, 250, 700, 36, { size: 22, weight: 700, uppercase: true, letterSpacing: 2, color: '#b45309' }),
        ...details({ x: 320, w: 500, y: 300, ink: '#422006', soft: '#7c4a14' }),
        ...stub({ fill: '#e0661b', bn: 'বসন্ত পঞ্চমী', perf: '#fff7c7' }),
      ],
    }),
  },

  // ── Poila Boishakh ──
  {
    id: 'boishakh-toran',
    label: 'Nobo Borsho — mango toran',
    theme: 'boishakh',
    kind: 'entry',
    design: ticket({
      background: bg('#fffdf6', '#fdf0d8', 160),
      elements: [
        img('alpana', art('alpana-red'), 480, 130, 420, 420, { opacity: 0.1 }),
        img('toran', art('mango-toran'), 0, 0, 850, 78, { fit: 'cover' }),
        img('paar', art('paar'), 0, 534, 850, 26, { fit: 'cover', rotate: 180 }),
        text('bn', 'শুভ নববর্ষ', 60, 100, 600, 90, { font: 'bengali', size: 70, color: '#a8201a' }),
        text('title', '{{event}}', 60, 192, 740, 64, { font: 'display', size: 44, weight: 600, color: '#2d5f21' }),
        text('type', '{{type}} · Admits {{quantity}}', 60, 262, 740, 36, { size: 22, weight: 700, uppercase: true, letterSpacing: 2, color: '#a8201a' }),
        ...details({ x: 60, w: 740, y: 314 }),
        ...stub({ fill: '#2d5f21', bn: '১লা বৈশাখ', perf: '#fffdf6' }),
      ],
    }),
  },

  // ── VIP & donors ──
  {
    id: 'vip-gold',
    label: 'VIP pass — black & gold',
    theme: 'vip',
    kind: 'entry',
    design: ticket({
      background: bg('#0e0c0a', '#2b2118', 135),
      borderColor: '#d8b56a',
      borderWidth: 4,
      radius: 28,
      elements: [
        img('alpana', art('alpana-gold'), 330, -120, 800, 800, { opacity: 0.08 }),
        img('corner1', art('corner'), 14, 14, 150, 150),
        img('corner2', art('corner'), 686, 396, 150, 150, { rotate: 180 }),
        text('kicker', 'VIP', 90, 70, 300, 60, { font: 'display', size: 56, weight: 600, letterSpacing: 12, color: '#d8b56a' }),
        text('title', '{{event}}', 90, 140, 700, 110, { font: 'display', size: 52, weight: 600, lineHeight: 1.02, color: '#fff6e0' }),
        text('type', '{{type}} · Admits {{quantity}}', 90, 258, 700, 36, { size: 21, weight: 700, uppercase: true, letterSpacing: 3, color: '#d8b56a' }),
        ...details({ x: 90, w: 700, y: 312, ink: '#fff6e0', soft: '#cbb88f' }),
        ...stub({ fill: '#d8b56a', ink: '#1a140e', label: 'Priority entry', bn: 'বিশেষ অতিথি', perf: '#0e0c0a' }),
      ],
    }),
  },

  // ── Any event ──
  {
    id: 'minimal',
    label: 'Simple & clean',
    theme: 'general',
    kind: 'other',
    design: ticket({
      background: bg('#ffffff', null),
      borderColor: '#e2d3bd',
      borderWidth: 3,
      radius: 24,
      elements: [
        rect('bar', 0, 0, 14, 560, '#a8201a'),
        img('logo', LOGO, 56, 44, 90, 106, { blend: 'multiply' }),
        text('kicker', 'Parbon Sanskritik Samity', 164, 70, 600, 30, { size: 18, weight: 700, uppercase: true, letterSpacing: 5, color: '#984520' }),
        text('title', '{{event}}', 164, 104, 620, 70, { font: 'display', size: 50, weight: 600, color: '#231a15' }),
        text('type', '{{type}} · {{quantity}}', 56, 200, 740, 40, { size: 24, weight: 700, color: '#a8201a' }),
        ...details({ x: 56, w: 740, y: 260 }),
        rect('divider', 850, 40, 2, 480, '#e2d3bd'),
        qr('qr', 905, 70, 240, { padding: 0, radius: 0 }),
        code('code', 870, 330, 310, 50),
        text('price', '{{price}}', 870, 390, 310, 36, { size: 22, weight: 600, color: '#6b5d53', align: 'center' }),
        text('scan', 'Show this at the gate', 870, 470, 310, 30, { size: 16, weight: 600, color: '#6b5d53', align: 'center' }),
      ],
    }),
  },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id);
export const templateFor = (kind) => (TEMPLATES.find((t) => t.kind === kind) || TEMPLATES[0]).design;
export const designOrTemplate = (type) => type?.design || templateFor(type?.kind);
