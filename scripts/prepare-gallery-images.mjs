/**
 * Turns gallery photos in images/gallery/<slug>.<ext> into web-ready files in server/media/gallery/:
 *   <slug>.jpg        — full size for the slideshow, max 1600px on the long side
 *   <slug>-small.webp — grid thumbnail, max 720px on the long side
 * Metadata (EXIF/GPS) is stripped. Prints the item block to paste into server/data/gallery.json.
 *
 * Existing outputs are left alone (so published photos are never re-encoded);
 * pass --force to regenerate them.
 *
 * Usage (sharp is intentionally not a project dependency):
 *   npm i --no-save sharp && npm run images:gallery
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
  console.error('sharp is not installed. Run: npm i --no-save sharp && npm run images:gallery');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'images', 'gallery');
const outDir = path.join(root, 'server', 'media', 'gallery');
const force = process.argv.includes('--force');
const NAME_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(jpe?g|png|webp)$/i;

await mkdir(outDir, { recursive: true });
const files = (await readdir(sourceDir, { withFileTypes: true })).filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));

let problems = 0;
for (const file of files) {
  const match = NAME_RE.exec(file.name);
  if (!match) {
    console.warn(`! Skipped ${file.name}: name it slug.jpg (lowercase letters, digits and hyphens).`);
    problems += 1;
    continue;
  }
  const slug = match[1].toLowerCase();
  const input = path.join(sourceDir, file.name);
  const jpg = path.join(outDir, `${slug}.jpg`);
  const small = path.join(outDir, `${slug}-small.webp`);

  let info;
  if (!force && existsSync(jpg) && existsSync(small)) {
    info = await sharp(jpg).metadata();
    console.log(`= ${slug}.jpg exists (${info.width}x${info.height})`);
  } else {
    const base = sharp(input).rotate().flatten({ background: '#fffdf9' });
    info = await base.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toFile(jpg);
    const thumb = await base.clone().resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(small);
    console.log(`+ ${slug}.jpg (${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB) · thumb ${Math.round(thumb.size / 1024)} KB`);
  }
  console.log(
    `  { "id": "${slug}", "album": "…", "src": "/media/gallery/${slug}.jpg", "thumb": "/media/gallery/${slug}-small.webp", "width": ${info.width}, "height": ${info.height}, "alt": { "en": "…", "bn": "…" }, "caption": { "en": "…", "bn": "…" } }`,
  );
}

if (problems) process.exitCode = 1;
