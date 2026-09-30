import { readFile, stat } from 'node:fs/promises';
import { config } from '../config.js';
import { routeChunkPreloadHref } from './clientManifest.js';

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let cached = { mtimeMs: 0, html: '' };
async function loadIndex(file) {
  const { mtimeMs } = await stat(file);
  if (mtimeMs !== cached.mtimeMs) cached = { mtimeMs, html: await readFile(file, 'utf8') };
  return cached.html;
}

const absolute = (url) => (/^https?:\/\//.test(url) ? url : `${config.siteUrl}${url}`);

async function injectUi(html, ui = {}) {
  const version = ui.version || config.uiVersion;
  const preload = await routeChunkPreloadHref(version);
  const tags = [
    `<meta name="parbon-ui" content="${escapeHtml(version)}" />`,
    ui.overrideActive && '<meta name="parbon-ui-preview" content="1" />',
    preload && `<link rel="modulepreload" href="${escapeHtml(preload)}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

  return html
    .replace(/<html([^>]*)>/i, (match, attrs) => (/\sdata-ui=/.test(attrs) ? match : `<html${attrs} data-ui="${escapeHtml(version)}">`))
    .replace('</head>', `    ${tags}\n  </head>`);
}

export async function renderShell(indexFile, ui) {
  return injectUi(await loadIndex(indexFile), ui);
}

/**
 * Link-preview crawlers (WhatsApp, Facebook, X…) don't run JavaScript, so pages that are
 * commonly shared get their title, description and image written into the HTML here.
 */
export async function renderWithMeta(indexFile, { title, description, image, url, type = 'article' }, ui) {
  const html = await loadIndex(indexFile);
  const fullTitle = `${title} · Parbon Sanskritik Samity`;
  const tags = [
    `<meta property="og:title" content="${escapeHtml(fullTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(absolute(url))}" />`,
    `<meta property="og:type" content="${escapeHtml(type)}" />`,
    image && `<meta property="og:image" content="${escapeHtml(absolute(image))}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<link rel="canonical" href="${escapeHtml(absolute(url))}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

  return injectUi(
    html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`)
      .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
      .replace(/\s*<meta property="og:(type|image)"[^>]*\/>/g, '')
      .replace('</head>', `    ${tags}\n  </head>`),
    ui,
  );
}

export const summarise = (text = '', max = 180) => {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};
