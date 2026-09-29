import { existsSync } from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { cors } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/api.js';
import { seoRouter } from './routes/seo.js';
import { announcementService } from './services/announcementService.js';
import { couponService, couponsEnabled } from './services/couponService.js';
import { eventService } from './services/eventService.js';
import { renderWithMeta, summarise } from './services/htmlMeta.js';
import { findStoredImage } from './services/uploadService.js';

const STATIC_ROUTES = new Set(['/', '/about', '/durga-puja', '/events', '/gallery', '/get-involved', '/contact', '/announcements']);

async function isKnownClientRoute(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (STATIC_ROUTES.has(clean)) return true;
  if (clean === '/admin' || clean.startsWith('/admin/')) return true;
  if (clean === '/scan' || clean === '/register') return true;
  // Coupon links and registration pages render their own "not found / ended" states.
  if (/^\/c\/[\w-]{22}$/.test(clean) || /^\/register\/[a-z0-9-]+$/.test(clean)) return true;
  const match = clean.match(/^\/events\/([a-z0-9-]+)$/);
  if (match) return Boolean(await eventService.getPublishedBySlug(match[1]));
  const ann = clean.match(/^\/announcements\/([a-z0-9-]+)$/);
  if (ann) return Boolean(await announcementService.getPublishedBySlug(ann[1]));
  return false;
}

/** Link previews (WhatsApp etc.) for event pages: name, summary and cover picture. */
async function eventPreview(pathname) {
  const m = pathname.match(/^\/events\/([a-z0-9-]+)\/?$/);
  if (!m) return null;
  try {
    const event = await eventService.getPublishedBySlug(m[1]);
    if (!event) return null;
    return { title: event.title.en, description: summarise(event.summary?.en || event.summary?.bn), image: event.image?.src, url: `/events/${event.slug}` };
  } catch {
    return null;
  }
}

/** Link previews (WhatsApp etc.) for registration pages and coupon links; null when not applicable. */
async function couponPreview(pathname) {
  if (!couponsEnabled()) return null;
  try {
    const reg = pathname.match(/^\/register\/([a-z0-9-]+)\/?$/);
    if (reg) {
      const event = await couponService.getPublicEvent(reg[1]);
      if (!event) return null;
      return {
        title: `Register — ${event.title.en}`,
        description: summarise(event.tagline?.en || event.description?.en || 'Register and get your coupons online.'),
        url: `/register/${event.slug}`,
        type: 'website',
      };
    }
    const c = pathname.match(/^\/c\/([\w-]{22})\/?$/);
    if (c) {
      const coupon = await couponService.getCouponByToken(c[1]);
      if (!coupon) return null;
      return {
        title: `${coupon.type.name?.en || 'Coupon'} — ${coupon.event.title.en}`,
        description: 'Your digital coupon. Show the QR code at the entrance.',
        url: `/c/${c[1]}`,
        type: 'website',
      };
    }
  } catch {
    // Expired coupons (410) or a database hiccup: fall back to the plain page.
  }
  return null;
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-src': ['https://www.google.com', 'https://maps.google.com'],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cors(config.corsOrigins));

  app.use('/api', apiRouter);
  app.use(seoRouter);

  // Photos for the gallery / committee, uploadable without rebuilding the frontend.
  app.use('/media', express.static(config.paths.media, { maxAge: '30d', index: false }));
  // Announcement images uploaded while a database is configured are stored in MySQL.
  app.get('/media/announcements/:name', async (req, res, next) => {
    let image;
    try {
      image = await findStoredImage(req.params.name);
    } catch {
      // Database unreachable: answer 404 like any missing image rather than failing the page.
      return next();
    }
    if (!image) return next();
    res.setHeader('Content-Type', image.mime);
    // File names are random and never reused, so the image can be cached for a long time.
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.send(image.bytes);
  });
  app.use('/media', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `No file at ${req.originalUrl}` } });
  });

  const dist = config.paths.clientDist;
  const indexHtml = path.join(dist, 'index.html');

  if (existsSync(indexHtml)) {
    app.use(
      '/assets',
      express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', index: false, fallthrough: false }),
    );
    app.use(
      express.static(dist, {
        index: false,
        maxAge: '7d',
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );

    // SPA fallback: every non-API GET renders the React app. Unknown routes still
    // render the app's friendly 404 page, but with a real 404 status for crawlers.
    app.get('/{*splat}', async (req, res, next) => {
      try {
        if (!req.accepts('html')) return next();
        const known = await isKnownClientRoute(req.path);
        if (/^\/(admin|scan|c\/)/.test(req.path)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.status(known ? 200 : 404).setHeader('Cache-Control', 'no-cache');

        const preview = (await couponPreview(req.path)) || (await eventPreview(req.path));
        if (preview) return res.type('html').send(await renderWithMeta(indexHtml, preview));

        // Shared announcement links get a rich preview (poster, title, text) in WhatsApp etc.
        const ann = req.path.match(/^\/announcements\/([a-z0-9-]+)\/?$/);
        const item = ann && (await announcementService.getPublishedBySlug(ann[1]));
        if (item) {
          const html = await renderWithMeta(indexHtml, {
            title: item.title.en,
            description: summarise(item.body?.en || item.body?.bn),
            image: item.image?.src,
            url: `/announcements/${item.slug}`,
          });
          return res.type('html').send(html);
        }
        res.sendFile(indexHtml);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.get('/', (_req, res) => {
      res
        .type('text')
        .send('Parbon API is running. Build the client (npm run build) or use the Vite dev server (npm run dev).');
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
  });
  app.use(errorHandler);

  return app;
}
