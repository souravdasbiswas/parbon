const IST_TZ = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(date, timeZone = IST_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function minutesFromClock(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const first = text.split(/[–-]/)[0].trim();
  let match = first.match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!match) match = first.match(/^(\d{1,2})\s*([AP]M)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2]?.length === 2 ? Number(match[2]) : 0;
  const suffix = (match[3] || match[2] || '').toUpperCase();
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null;
  if (suffix === 'PM' && hour < 12) hour += 12;
  if (suffix === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function clockMinutes(date, timeZone = IST_TZ) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

export function parseScheduleTime(value) {
  return minutesFromClock(value);
}

export function dateState(event, now = new Date()) {
  if (!event?.startDate) return 'before';
  const today = ymd(now);
  if (today < event.startDate) return 'before';
  if (event.endDate && today > event.endDate) return 'after';
  if (!event.endDate && today > event.startDate) return 'after';
  return 'during';
}

export function selectedScheduleDate(event, now = new Date()) {
  const days = (event?.schedule || []).filter(Boolean);
  if (!days.length) return '';
  const today = ymd(now);
  const hasToday = days.find((d) => d.date === today);
  if (hasToday && dateState(event, now) === 'during') return hasToday.date;
  return days.find((d) => d.main)?.date || days[0].date;
}

export function nowNext(event, now = new Date()) {
  if (dateState(event, now) !== 'during') return { mode: 'idle' };
  const today = ymd(now);
  const day = (event?.schedule || []).find((d) => d.date === today);
  if (!day) return { mode: 'today' };
  const minute = clockMinutes(now);
  const items = (day.items || [])
    .map((item, index) => ({ item, index, minute: minutesFromClock(item.time) }))
    .filter((entry) => entry.minute != null)
    .sort((a, b) => a.minute - b.minute || a.index - b.index);
  if (!items.length) return { mode: 'today', day };

  let current = null;
  let next = null;
  for (let i = 0; i < items.length; i += 1) {
    const entry = items[i];
    const following = items[i + 1];
    if (entry.minute <= minute && (!following || minute < following.minute)) {
      current = entry.item;
      next = following?.item || null;
      break;
    }
    if (entry.minute > minute) {
      next = entry.item;
      break;
    }
  }
  return { mode: current ? 'nowNext' : 'next', day, now: current, next };
}

export function addDaysIso(iso, days = 1) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function isItemLive(event, item, selectedDate, now = new Date()) {
  if (!item || selectedDate !== ymd(now) || dateState(event, now) !== 'during') return false;
  return nowNext(event, now).now === item;
}
