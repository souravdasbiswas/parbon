/**
 * Creates password hashes for the environment variables — the plain text is never stored.
 *
 *   npm run admin:hash -- "your-strong-password"     → ADMIN_PASSWORD_HASH (+ a SESSION_SECRET)
 *   npm run admin:hash -- --scanner 482913           → SCANNER_PIN_HASH (gate volunteers' coupon scanner PIN)
 */
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../server/src/services/authService.js';

const args = process.argv.slice(2);

if (args[0] === '--scanner') {
  const pin = args[1];
  if (!pin || pin.length < 6) {
    console.error('Usage: npm run admin:hash -- --scanner "a-pin-of-6+-characters"');
    process.exit(1);
  }
  console.log(`SCANNER_PIN_HASH=${await hashPassword(pin)}`);
  console.log('\nAdd this line to your .env or Hostinger environment variables. Share the PIN only with gate volunteers.');
  process.exit(0);
}

const password = args[0];
if (!password || password.length < 10) {
  console.error('Usage: npm run admin:hash -- "a-strong-password-of-10+-characters"');
  process.exit(1);
}

console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
console.log(`SESSION_SECRET=${randomBytes(48).toString('base64url')}`);
console.log('\nAdd both lines (plus ADMIN_USERNAME=...) to your .env or Hostinger environment variables.');
