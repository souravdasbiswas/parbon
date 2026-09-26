/**
 * Generates the UPI donation QR code (SVG) shown on the website.
 * Re-run whenever the UPI ID changes:
 *
 *   npm i --no-save qrcode && node scripts/generate-upi-qr.mjs <upi-id> "<payee name>"
 *
 * Writes server/media/donations/upi-qr.svg and prints the UPI link to put in
 * server/data/support.json (donation.methods[].upiLink).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let QRCode;
try {
  ({ default: QRCode } = await import('qrcode'));
} catch {
  console.error('qrcode is not installed. Run: npm i --no-save qrcode');
  process.exit(1);
}

const [upiId, payeeName = 'Parbon Sanskritik Samity'] = process.argv.slice(2);
if (!upiId || !/^[\w.-]+@[\w.-]+$/.test(upiId)) {
  console.error('Usage: node scripts/generate-upi-qr.mjs <upi-id> "<payee name>"');
  process.exit(1);
}

// `pa` must contain a literal "@" (some UPI apps reject %40); the ID is validated above.
const link = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&cu=INR`;
const svg = await QRCode.toString(link, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 2,
  color: { dark: '#2e1f18', light: '#fffdf9' },
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'server', 'media', 'donations');
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'upi-qr.svg'), svg, 'utf8');
console.log(`QR written to server/media/donations/upi-qr.svg\nUPI link: ${link}`);
