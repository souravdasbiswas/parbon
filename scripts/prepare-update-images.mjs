/**
 * Turns announcement posters in images/updates/<year>/<YYYY-MM-DD>-<slug>.<ext> into
 * web-ready files at server/media/announcements/<slug>.jpg (+ .webp), max 1600px wide,
 * with metadata (EXIF/GPS) stripped. Prints the image block to paste into
 * server/data/announcements.seed.json.
 *
 * Existing outputs are left alone (so published posters are never re-encoded);
 * pass --force to regenerate them.
 *
 * Usage (sharp is intentionally not a project dependency):
 *   npm i --no-save sharp && npm run images:updates
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
  sharp.cache(false);
} catch {
  console.error('sharp is not installed. Run: npm i --no-save sharp && npm run images:updates');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'images', 'updates');
const outDir = path.join(root, 'server', 'media', 'announcements');
const force = process.argv.includes('--force');
const NAME_RE = /^\d{4}-\d{2}-\d{2}-([a-z0-9]+(?:-[a-z0-9]+)*)\.(jpe?g|png|webp)$/i;

await mkdir(outDir, { recursive: true });
const entries = await readdir(sourceDir, { recursive: true, withFileTypes: true });
const files = entries.filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));

let problems = 0;
for (const file of files) {
  const match = NAME_RE.exec(file.name);
  if (!match) {
    console.warn(`! Skipped ${file.name}: name it YYYY-MM-DD-slug.jpg (lowercase letters, digits and hyphens).`);
    problems += 1;
    continue;
  }
  const slug = match[1].toLowerCase();
  const input = path.join(file.parentPath ?? file.path, file.name);
  const jpg = path.join(outDir, `${slug}.jpg`);
  const webp = path.join(outDir, `${slug}.webp`);

  if (!force && existsSync(jpg)) {
    const { width, height } = await sharp(jpg).metadata();
    console.log(`= ${slug}.jpg exists (${width}x${height})`);
    continue;
  }

  const base = sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true }).flatten({ background: '#fffdf9' });
  const info = await base.clone().jpeg({ quality: 86, mozjpeg: true }).toFile(jpg);
  await base.clone().webp({ quality: 82 }).toFile(webp);
  console.log(`+ ${slug}.jpg (${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB)`);
  console.log(`  "image": { "src": "/media/announcements/${slug}.jpg", "alt": "…", "width": ${info.width}, "height": ${info.height} }`);
}

if (problems) process.exitCode = 1;
