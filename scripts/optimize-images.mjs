/**
 * Generates web-optimised derivatives of the official logo (images/logo.jpeg).
 * The artwork itself is never redrawn — its paper tone is neutralised to white (so the
 * site's multiply blend and white logo cards keep working), empty margins are trimmed
 * and the file is resized / re-encoded for fast delivery.
 *
 * Usage (sharp is intentionally not a project dependency, so hosting installs stay lean):
 *   npm i --no-save sharp && npm run images
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
  sharp.cache(false);
} catch {
  console.error('sharp is not installed. Run: npm i --no-save sharp && npm run images');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'images', 'logo.jpeg');
const out = path.join(root, 'client', 'public', 'brand');
const pub = path.join(root, 'client', 'public');
await mkdir(out, { recursive: true });

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// The artwork is printed on a warm paper tone. Sample the outer border and scale each
// channel so that paper (including its light texture) becomes pure white; inks and
// blacks are left essentially untouched. A logo already on white is a no-op.
const paperWhite = async (input) => {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const band = Math.max(8, Math.round(Math.min(info.width, info.height) * 0.03));
  const channels = [[], [], []];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (x >= band && x < info.width - band && y >= band && y < info.height - band) continue;
      const i = (y * info.width + x) * info.channels;
      for (let c = 0; c < 3; c++) channels[c].push(data[i + c]);
    }
  }
  const level = channels.map((values) => {
    values.sort((a, b) => a - b);
    return Math.max(1, values[Math.floor(values.length * 0.02)]);
  });
  console.log(`Paper tone: rgb(${level.join(', ')}) -> white`);
  return sharp(input)
    .removeAlpha()
    .linear(level.map((v) => 255 / v), [0, 0, 0])
    .toBuffer();
};

const neutral = await paperWhite(source);
const trimmed = await sharp(neutral).trim({ background: '#ffffff', threshold: 12 }).toBuffer();
const meta = await sharp(trimmed).metadata();
console.log(`Trimmed logo: ${meta.width}x${meta.height}`);

for (const width of [160, 320, 480, 720]) {
  const base = sharp(trimmed).resize({ width, withoutEnlargement: true });
  await base.clone().avif({ quality: 60, effort: 6 }).toFile(path.join(out, `logo-${width}.avif`));
  await base.clone().webp({ quality: 82 }).toFile(path.join(out, `logo-${width}.webp`));
  await base.clone().png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(out, `logo-${width}.png`));
}

// Square icons: whole logo centred on a white tile (the logo's own background).
const square = async (size, file, padding = 0.08, background = WHITE) => {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(trimmed).resize({ width: inner, height: inner, fit: 'contain', background }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(file);
};

await square(32, path.join(pub, 'favicon-32.png'), 0.02);
await square(180, path.join(pub, 'apple-touch-icon.png'));
await square(192, path.join(out, 'icon-192.png'));
await square(512, path.join(out, 'icon-512.png'));

// Open Graph / social share card (1200x630) — logo centred on its own white background.
const ogLogo = await sharp(trimmed).resize({ height: 560, fit: 'inside' }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: WHITE } })
  .composite([{ input: ogLogo, gravity: 'center' }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(path.join(out, 'og-image.jpg'));

console.log(`Brand assets written to ${path.relative(root, out)}`);

