import { config } from '../config.js';
import { mailConfigured, sendMailTo } from './mailService.js';

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const IST = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const when = (iso) => (iso ? IST.format(new Date(iso)) : '');

const PAYMENT_TEXT = {
  to_verify: 'We have your transaction ID and will verify the payment.',
  pledged: 'Please pay at the counter when you arrive.',
  paid: 'Payment received — thank you!',
  free: '',
  rejected: 'We could not verify your payment. Please contact us.',
};

/**
 * Builds the coupon email, or null when there is nothing to send. Only committee-written text
 * (event, venue, coupon names) and generated codes/links go in — never what a registrant typed —
 * so the public form can't be used to send someone a message in Parbon's name.
 */
export function buildCouponEmail({ event, registration, coupons }) {
  const live = coupons.filter((c) => (c.status || 'active') === 'active');
  if (!live.length) return null;

  const title = event.title?.en || 'our event';
  const typeName = (c) => c.type?.name?.en || c.typeName?.en || 'Coupon';
  const lines = live.map((c) => `• ${typeName(c)} ×${c.quantity} — code ${c.code}\n  ${c.url}`);
  const payment = PAYMENT_TEXT[registration.paymentStatus] || '';
  const venue = [event.venue?.name, event.venue?.address].filter(Boolean).join(', ');
  const why = `You're receiving this because this email address was used to register for ${title} on ${config.siteUrl}. If that wasn't you, you can ignore this email.`;

  const text = [
    'Nomoshkar,',
    '',
    `Your coupons for ${title} are ready. Open a link and show the QR code at the entrance:`,
    '',
    ...lines,
    '',
    `When: ${when(event.startsAt)} – ${when(event.endsAt)}`,
    venue && `Where: ${venue}`,
    registration.amountDue ? `Amount: ₹${registration.amountDue}. ${payment}` : '',
    '',
    'Please keep these links to yourself — anyone with a link can use the coupon. They stop working after the event.',
    '',
    'See you there!',
    'Parbon Sanskritik Samity',
    config.siteUrl,
    '',
    why,
  ]
    .filter((l) => l !== false && l !== undefined)
    .join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#fbf6ee;font-family:Georgia,serif;color:#231a15">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <p style="margin:0 0 4px;color:#a8201a;font-size:22px">নমস্কার,</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5">Your coupons for <strong>${escapeHtml(title)}</strong> are ready.
      Open a coupon and show its QR code at the entrance.</p>
    ${live
      .map(
        (c) => `<a href="${escapeHtml(c.url)}" style="display:block;margin:0 0 12px;padding:16px 18px;border-radius:14px;background:#fff;border:1px solid #e2d3bd;border-left:6px solid #a8201a;text-decoration:none;color:#231a15">
      <span style="display:block;font-size:18px;font-weight:bold">${escapeHtml(typeName(c))} ×${c.quantity}</span>
      <span style="display:block;margin-top:4px;font-family:monospace;font-size:15px;color:#6b5d53">Code ${escapeHtml(c.code)}</span>
      <span style="display:inline-block;margin-top:10px;padding:8px 14px;border-radius:999px;background:#a8201a;color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold">Open coupon →</span>
    </a>`,
      )
      .join('\n')}
    <p style="margin:20px 0 6px;font-size:15px"><strong>When:</strong> ${escapeHtml(when(event.startsAt))} – ${escapeHtml(when(event.endsAt))}</p>
    ${venue ? `<p style="margin:0 0 6px;font-size:15px"><strong>Where:</strong> ${escapeHtml(venue)}</p>` : ''}
    ${registration.amountDue ? `<p style="margin:0 0 6px;font-size:15px"><strong>Amount:</strong> ₹${registration.amountDue}. ${escapeHtml(payment)}</p>` : ''}
    <p style="margin:18px 0 0;font-size:13px;color:#6b5d53">Please keep these links to yourself — anyone with a link can use the coupon. They stop working after the event.</p>
    <p style="margin:18px 0 0;font-size:15px">See you there!<br><span style="color:#a8201a">Parbon Sanskritik Samity</span></p>
    <p style="margin:24px 0 0;font-size:12px;color:#8a7a6d">${escapeHtml(why)}</p>
  </div></body></html>`;

  return { to: registration.email, subject: `Your coupons — ${title}`, text, html };
}

// Public registrations may trigger at most this many coupon emails per recipient / per network.
const PER_RECIPIENT = 3;
const PER_NETWORK = 10;
const WINDOW_MS = 24 * 3600 * 1000;
const sent = new Map();

/** True (and counted) if another public coupon email to this address from this IP is allowed. */
export function allowPublicCouponEmail(email, ip, at = Date.now()) {
  const keys = [`to:${String(email).toLowerCase()}`, `ip:${ip || 'unknown'}`];
  const recent = keys.map((k) => (sent.get(k) || []).filter((t) => at - t < WINDOW_MS));
  if (recent[0].length >= PER_RECIPIENT || recent[1].length >= PER_NETWORK) return false;
  keys.forEach((k, i) => sent.set(k, [...recent[i], at]));
  if (sent.size > 20000) {
    for (const [k, list] of sent) if (!list.some((t) => at - t < WINDOW_MS)) sent.delete(k);
  }
  return true;
}

/** Emails a registrant their coupon links. Returns false when email is not configured. */
export async function sendCouponEmail(input) {
  if (!mailConfigured() || !input.registration.email) return false;
  const mail = buildCouponEmail(input);
  if (!mail) return false;
  return sendMailTo(mail);
}
