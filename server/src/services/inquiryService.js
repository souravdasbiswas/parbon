import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { databaseReady } from '../db/index.js';
import { sendMail } from './mailService.js';

export const INQUIRY_TYPES = Object.freeze({
  general: 'General enquiry',
  volunteer: 'Volunteering',
  membership: 'Membership',
  sponsorship: 'Sponsorship / Donation',
  performance: 'Cultural performance',
});

/**
 * Persists an enquiry and (optionally) emails the committee.
 * With a database configured the enquiry goes to the `inquiries` table (survives redeploys);
 * otherwise, or if the database is unreachable, it's appended to STORAGE_DIR/inquiries.ndjson.
 */
export async function submitInquiry(input, meta = {}) {
  const record = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
    meta: { ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300) },
  };

  await persist(record);

  try {
    await notify(record);
  } catch (err) {
    // The enquiry is already saved — never fail the request because email is down.
    console.error('[parbon] failed to send enquiry email:', err.message);
  }

  return { id: record.id, createdAt: record.createdAt };
}

async function persist(record) {
  if (config.db.enabled) {
    try {
      const db = await databaseReady();
      await db.query(
        'INSERT INTO inquiries (id, created_at, type, name, email, phone, message, ip, user_agent, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          record.id,
          record.createdAt,
          record.type,
          record.name,
          record.email,
          record.phone || null,
          record.message,
          record.meta.ip?.slice(0, 64) || null,
          record.meta.userAgent || null,
          'form',
        ],
      );
      return;
    } catch (error) {
      // Keep the message: the file copy is imported into the database on the next start.
      console.error('[parbon] could not save enquiry to the database, writing it to file instead:', error.message);
    }
  }
  await persistToFile(record);
}

async function persistToFile(record) {
  await mkdir(config.paths.storage, { recursive: true });
  await appendFile(path.join(config.paths.storage, 'inquiries.ndjson'), `${JSON.stringify(record)}\n`, 'utf8');
}

async function notify(record) {
  const label = INQUIRY_TYPES[record.type] || record.type;
  const lines = [
    `Type: ${label}`,
    `Name: ${record.name}`,
    `Email: ${record.email}`,
    record.phone ? `Phone: ${record.phone}` : null,
    '',
    record.message,
    '',
    `Reference: ${record.id}`,
    `Received: ${record.createdAt}`,
  ].filter((l) => l !== null);

  await sendMail({
    subject: `[Parbon] ${label} — ${record.name}`,
    text: lines.join('\n'),
    replyTo: record.email,
  });
}
