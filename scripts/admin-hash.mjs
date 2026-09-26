/**
 * Creates the admin password hash for ADMIN_PASSWORD_HASH (and a SESSION_SECRET).
 * The plain password is never stored anywhere.
 *
 *   npm run admin:hash -- "your-strong-password"
 */
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../server/src/services/authService.js';

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Usage: npm run admin:hash -- "a-strong-password-of-10+-characters"');
  process.exit(1);
}

console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
console.log(`SESSION_SECRET=${randomBytes(48).toString('base64url')}`);
console.log('\nAdd both lines (plus ADMIN_USERNAME=...) to your .env or Hostinger environment variables.');
