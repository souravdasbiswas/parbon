/** Helpers for event countdowns set in Admin → Events (the API adds `countdownTo` to such events). */

const DEFAULT_DONE = { en: 'It’s today — see you there!', bn: 'আজ সেই দিন!' };
const STARTS_IN = { en: 'Starts in', bn: 'শুরু হতে বাকি' };

/**
 * Props for <Countdown> from an event: its own label and "it has started" message. Without a
 * label, the home page names the event; the event's own page (which already shows the name) says "Starts in".
 */
export function countdownProps(event, { onEventPage = false } = {}) {
  return {
    target: event.countdownTo,
    label: event.countdown?.label || (onEventPage ? STARTS_IN : event.title),
    doneMessage: event.countdown?.doneMessage || DEFAULT_DONE,
  };
}

/**
 * The event whose countdown the home page shows: one that is under way (the countdown has
 * reached zero but the event hasn't ended) first, otherwise the next countdown to finish.
 */
export function pickCountdownEvent(events, now = Date.now()) {
  const at = (e) => Date.parse(e.countdownTo);
  // A "date to be announced" event has no end, so its countdown only counts while it's in the future.
  const withTimer = (events || []).filter((e) => e.countdownTo && (e.status === 'upcoming' || (e.status === 'planned' && at(e) > now)));
  const running = withTimer.filter((e) => at(e) <= now).sort((a, b) => at(b) - at(a));
  if (running.length) return running[0];
  return withTimer.sort((a, b) => at(a) - at(b))[0] || null;
}
