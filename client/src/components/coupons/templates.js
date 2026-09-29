/**
 * Ready-made Parbon coupon designs. The designer starts from one of these; coupons whose type has
 * no saved design use the template for its kind.
 */
const LOGO = '/brand/logo-480.png';

const ticketBase = ({ stub, bgFrom, bgTo, accent, kicker, bengali, icon }) => ({
  version: 1,
  width: 1200,
  height: 560,
  background: { color: bgFrom, gradient: { from: bgFrom, to: bgTo, angle: 120 }, image: null },
  border: { color: accent, width: 0, radius: 36 },
  elements: [
    { id: 'stub', type: 'shape', shape: 'rect', x: 850, y: 0, w: 350, h: 560, fill: stub, stroke: 'transparent', strokeWidth: 0, radius: 0 },
    { id: 'perf', type: 'shape', shape: 'line', x: 590, y: 278, w: 520, h: 4, rotate: 90, fill: 'transparent', stroke: '#fffaf1', strokeWidth: 5, dashed: true },
    { id: 'motif', type: 'icon', name: 'alpana', x: 58, y: 262, w: 130, h: 130, color: '#d8bf8a', strokeWidth: 1.2, opacity: 0.9 },
    { id: 'logo', type: 'image', src: LOGO, x: 44, y: 34, w: 156, h: 184, fit: 'contain', blend: 'multiply' },
    { id: 'kicker', type: 'text', text: kicker, x: 230, y: 58, w: 590, h: 30, font: 'body', size: 19, weight: 700, uppercase: true, letterSpacing: 6, color: '#984520' },
    { id: 'title', type: 'text', text: '{{event}}', x: 230, y: 92, w: 590, h: 136, font: 'display', size: 62, weight: 600, lineHeight: 1.02, color: accent },
    { id: 'badge', type: 'text', text: '{{type}}', x: 230, y: 244, w: 300, h: 50, font: 'body', size: 22, weight: 700, uppercase: true, letterSpacing: 3, color: '#fffaf1', background: '#231a15', radius: 25, align: 'center', valign: 'middle' },
    { id: 'admits', type: 'text', text: 'Admits {{quantity}}', x: 548, y: 244, w: 272, h: 50, font: 'body', size: 24, weight: 700, color: accent, valign: 'middle' },
    { id: 'name', type: 'text', text: '{{name}}', x: 230, y: 318, w: 590, h: 52, font: 'display', size: 42, weight: 600, color: '#231a15' },
    { id: 'date', type: 'text', text: '{{date}}', x: 230, y: 382, w: 590, h: 34, font: 'body', size: 22, weight: 600, color: '#3a302b' },
    { id: 'venue', type: 'text', text: '{{venue}}', x: 230, y: 418, w: 590, h: 60, font: 'body', size: 20, weight: 400, color: '#6b5d53' },
    { id: 'rule', type: 'shape', shape: 'rect', x: 44, y: 500, w: 776, h: 4, fill: '#b08a45', radius: 2 },
    { id: 'icon', type: 'icon', name: icon, x: 776, y: 20, w: 52, h: 52, color: '#b08a45', strokeWidth: 1.4 },
    { id: 'scan', type: 'text', text: 'Scan at entry', x: 870, y: 40, w: 310, h: 30, font: 'body', size: 18, weight: 700, uppercase: true, letterSpacing: 5, color: '#efe2c4', align: 'center' },
    { id: 'qr', type: 'qr', x: 905, y: 86, w: 240, h: 240, fg: '#231a15', bg: '#ffffff', padding: 14, radius: 18 },
    { id: 'code', type: 'code', x: 870, y: 346, w: 310, h: 50, font: 'mono', size: 34, weight: 700, letterSpacing: 4, color: '#ffffff', align: 'center' },
    { id: 'bn', type: 'text', text: bengali, x: 870, y: 412, w: 310, h: 64, font: 'bengali', size: 40, weight: 400, color: '#efe2c4', align: 'center' },
    { id: 'price', type: 'text', text: '{{price}}', x: 870, y: 482, w: 310, h: 36, font: 'body', size: 20, weight: 600, color: '#efe2c4', align: 'center', opacity: 0.85 },
  ],
});

export const TEMPLATES = [
  {
    id: 'entry',
    label: 'Entry pass — sindoor red',
    kind: 'entry',
    design: ticketBase({ stub: '#a8201a', bgFrom: '#fffaf1', bgTo: '#f3e3c6', accent: '#a8201a', kicker: 'Parbon Sanskritik Samity', bengali: 'প্রবেশপত্র', icon: 'dhak' }),
  },
  {
    id: 'food',
    label: 'Food coupon — bhog gold',
    kind: 'food',
    design: {
      ...ticketBase({ stub: '#984520', bgFrom: '#fff7e6', bgTo: '#f6d9a8', accent: '#984520', kicker: 'Parbon · Bhog & Prasad', bengali: 'ভোগের কুপন', icon: 'bhog' }),
    },
  },
  {
    id: 'card',
    label: 'Festive card — portrait',
    kind: 'other',
    design: {
      version: 1,
      width: 800,
      height: 1200,
      background: { color: '#7f1611', gradient: { from: '#7f1611', to: '#c42b1f', angle: 160 }, image: null },
      border: { color: '#d8bf8a', width: 14, radius: 40 },
      elements: [
        { id: 'panel', type: 'shape', shape: 'rect', x: 60, y: 330, w: 680, h: 800, fill: '#fffaf1', radius: 32 },
        { id: 'logoBg', type: 'shape', shape: 'ellipse', x: 290, y: 30, w: 220, h: 220, fill: '#fffaf1' },
        { id: 'logo', type: 'image', src: LOGO, x: 315, y: 44, w: 170, h: 196, fit: 'contain', blend: 'multiply' },
        { id: 'title', type: 'text', text: '{{event}}', x: 60, y: 256, w: 680, h: 70, font: 'display', size: 50, weight: 600, color: '#efe2c4', align: 'center', valign: 'middle' },
        { id: 'type', type: 'text', text: '{{type}}', x: 100, y: 360, w: 600, h: 44, font: 'body', size: 26, weight: 700, uppercase: true, letterSpacing: 6, color: '#a8201a', align: 'center' },
        { id: 'qr', type: 'qr', x: 220, y: 420, w: 360, h: 360, fg: '#231a15', bg: '#ffffff', padding: 12, radius: 16 },
        { id: 'code', type: 'code', x: 100, y: 800, w: 600, h: 56, font: 'mono', size: 40, weight: 700, letterSpacing: 6, color: '#231a15', align: 'center' },
        { id: 'admits', type: 'text', text: 'Admits {{quantity}}', x: 100, y: 866, w: 600, h: 44, font: 'body', size: 28, weight: 700, color: '#a8201a', align: 'center' },
        { id: 'name', type: 'text', text: '{{name}}', x: 100, y: 920, w: 600, h: 56, font: 'display', size: 42, weight: 600, color: '#231a15', align: 'center' },
        { id: 'date', type: 'text', text: '{{date}}', x: 100, y: 986, w: 600, h: 36, font: 'body', size: 22, weight: 600, color: '#3a302b', align: 'center' },
        { id: 'venue', type: 'text', text: '{{venue}}', x: 100, y: 1026, w: 600, h: 64, font: 'body', size: 20, weight: 400, color: '#6b5d53', align: 'center' },
        { id: 'lotus', type: 'icon', name: 'lotus', x: 376, y: 1136, w: 48, h: 48, color: '#d8bf8a', strokeWidth: 1.5 },
      ],
    },
  },
];

export const templateFor = (kind) => (TEMPLATES.find((t) => t.kind === kind) || TEMPLATES[0]).design;
export const designOrTemplate = (type) => type?.design || templateFor(type?.kind);
