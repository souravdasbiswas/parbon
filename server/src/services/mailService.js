import { config } from '../config.js';

let transporterPromise;

async function getTransporter() {
  if (!config.mail.host || !config.mail.to) return null;
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
  const transporter = await getTransporter();
  if (!transporter) return false;
  await transporter.sendMail({ from: config.mail.from, to: config.mail.to, subject, text, replyTo });
  return true;
}
