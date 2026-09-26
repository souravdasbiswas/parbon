import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { HttpError } from '../middleware/errorHandler.js';

const MAX_BYTES = 5 * 1024 * 1024;

// Identify images by their magic bytes — never trust the declared type or file name.
const SIGNATURES = [
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];

/** Saves a base64 data-URL image under MEDIA_DIR/announcements and returns its public path. */
export async function saveAnnouncementImage(dataUrl) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new HttpError(422, 'INVALID_IMAGE', 'Please choose a JPEG, PNG or WebP image.');

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_BYTES) throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Image must be 5 MB or smaller.');
  const kind = SIGNATURES.find((s) => s.test(buffer));
  if (!kind) throw new HttpError(422, 'INVALID_IMAGE', 'That file does not look like a valid image.');

  const dir = path.join(config.paths.media, 'announcements');
  await mkdir(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const name = `${date}-${randomBytes(6).toString('hex')}.${kind.ext}`;
  await writeFile(path.join(dir, name), buffer);
  return { src: `/media/announcements/${name}`, bytes: buffer.length };
}
