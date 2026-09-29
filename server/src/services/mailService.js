import { config } from '../config.js';

let transporterPromise;

/** True when outgoing email is set up (e.g. Hostinger: smtp.hostinger.com, 465, the site mailbox). */
export const mailConfigured = () => Boolean(config.mail.host);

async function getTransporter() {
  if (!mailConfigured()) return null;
  transporterPromise ??= import('nodemailer').then(({ default: nodemailer }) =>
    nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    }),
  );
  return transporterPromise;
}

/** Sends an email to the committee inbox. Silently no-ops when SMTP is not configured. */
export async function sendMail({ subject, text, replyTo }) {
  if (!config.mail.to) return false;
  return sendMailTo({ to: config.mail.to, subject, text, replyTo });
}

/** Sends an email to any address (e.g. a registrant's coupons). Returns false when SMTP is not configured. */
export async function sendMailTo({ to, subject, text, html, replyTo }) {
  const transporter = await getTransporter();
  if (!transporter) return false;
  await transporter.sendMail({ from: config.mail.from, to, subject, text, html, replyTo });
  return true;
}
