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

/** Emails a registrant their coupon links. Returns false when email is not configured. */
export async function sendCouponEmail({ event, registration, coupons }) {
  if (!mailConfigured() || !registration.email) return false;
  const live = coupons.filter((c) => (c.status || 'active') === 'active');
  if (!live.length) return false;

  const title = event.title?.en || 'our event';
  const typeName = (c) => c.type?.name?.en || c.typeName?.en || 'Coupon';
  const lines = live.map((c) => `• ${typeName(c)} ×${c.quantity} — code ${c.code}\n  ${c.url}`);
  const payment = PAYMENT_TEXT[registration.paymentStatus] || '';
  const venue = [event.venue?.name, event.venue?.address].filter(Boolean).join(', ');

  const text = [
    `Nomoshkar ${registration.name},`,
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
  ]
    .filter((l) => l !== false && l !== undefined)
    .join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#fbf6ee;font-family:Georgia,serif;color:#231a15">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <p style="margin:0 0 4px;color:#a8201a;font-size:22px">নমস্কার ${escapeHtml(registration.name)},</p>
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
  </div></body></html>`;

  return sendMailTo({ to: registration.email, subject: `Your coupons — ${title}`, text, html });
}
