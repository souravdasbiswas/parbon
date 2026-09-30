import { Router } from 'express';
import { config } from '../config.js';
import { announcementService } from '../services/announcementService.js';
import { eventService } from '../services/eventService.js';

export const seoRouter = Router();

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/durga-puja', priority: '0.9', changefreq: 'weekly' },
  { path: '/announcements', priority: '0.8', changefreq: 'daily' },
  { path: '/events', priority: '0.8', changefreq: 'weekly' },
  { path: '/about', priority: '0.7', changefreq: 'monthly' },
  { path: '/gallery', priority: '0.6', changefreq: 'monthly' },
  { path: '/get-involved', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.5', changefreq: 'yearly' },
];

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

seoRouter.get('/robots.txt', (_req, res) => {
  res.type('text/plain').setHeader('Cache-Control', 'public, max-age=3600');
  if (config.siteNoindex) return res.send('User-agent: *\nDisallow: /\n');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /scan\nDisallow: /c/\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

seoRouter.get('/sitemap.xml', async (_req, res) => {
  const events = await eventService.listPublished();
  const announcements = await announcementService.listPublished();
  const urls = [
    ...STATIC_PAGES,
    ...events.map((e) => ({ path: `/events/${e.slug}`, priority: '0.7', changefreq: 'weekly' })),
    ...announcements.map((a) => ({ path: `/announcements/${a.slug}`, priority: '0.6', changefreq: 'monthly' })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${escapeXml(config.siteUrl + u.path)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
    )
    .join('\n');
  res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
});
