import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
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
 * Storage is an append-only NDJSON file so it works on any shared host;
 * replace `persist` with a database insert when one is introduced.
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
