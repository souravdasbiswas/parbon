/** Small helpers shared by the coupon pages (admin, public and scanner). */

/** ISO → value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : '');

const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
export const formatWhen = (iso) => (iso ? DATE_TIME.format(new Date(iso)) : '—');

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text });
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export function couponShareText({ holder, typeName, quantity, eventTitle, url }) {
  const who = holder ? `${holder}'s ` : 'Your ';
  return `${who}${typeName || 'coupon'} ×${quantity} for ${eventTitle || 'the event'} 🎟️\nShow this QR at the entrance:\n${url}`;
}

export const PAYMENT_LABELS = {
  to_verify: 'To verify',
  pledged: 'Pay at counter',
  paid: 'Paid',
  rejected: 'Rejected',
  free: 'Free',
};

export const ATTENDANCE_LABELS = { none: 'Not in yet', partial: 'Partly in', in: 'All in', cancelled: 'Cancelled' };

export const REGISTRATION_LABELS = { draft: 'Draft', open: 'Open', closed: 'Closed', over: 'Over' };

export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
