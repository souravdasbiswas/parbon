/**
 * Line icons drawn for Parbon — dhak, shankha, lotus, bhog, pradip and friends.
 * 24×24 grid, 1.5 stroke, `currentColor`.
 */
const PATHS = {
  dhak: (
    <>
      <ellipse cx="6.5" cy="14" rx="2.5" ry="5.5" />
      <ellipse cx="17.5" cy="14" rx="2.5" ry="5.5" />
      <path d="M6.5 8.5h11M6.5 19.5h11" />
      <path d="M7.5 9.5l9 9M16.5 9.5l-9 9" opacity="0.7" />
      <path d="M17.5 8.5c.5-2.5 2-4.3 4-5.5M18.8 8.3c.8-1.8 2.2-3 3.7-3.6" />
    </>
  ),
  shankha: (
    <>
      <path d="M3 15.5c0-5.8 4.8-10.5 10.8-10.5 4 0 7.2 2.6 7.2 6 0 4.9-5.2 8.8-11.4 9.5L5.2 21c-1.4-1.3-2.2-3.4-2.2-5.5z" />
      <path d="M14.5 8.5c-1.9 0-3 1.5-2.5 3 .4 1.3 2.1 1.7 3 .8.8-.8.3-2-.6-2" />
      <path d="M6 13.2c1.5.2 3 1 4 2.3M5.2 16.4c1.4 0 2.8.6 3.8 1.6" opacity="0.7" />
    </>
  ),
  lotus: (
    <>
      <path d="M12 19.5c-3-2.6-4-6.3-3-10.2.8-1.3 1.8-2.5 3-3.8 1.2 1.3 2.2 2.5 3 3.8 1 3.9 0 7.6-3 10.2z" />
      <path d="M12 19.5c-4.4.1-7.7-2.6-8.8-7 2.2-.3 4.2.2 5.8 1.3M12 19.5c4.4.1 7.7-2.6 8.8-7-2.2-.3-4.2.2-5.8 1.3" />
      <path d="M4 21h16" />
    </>
  ),
  bhog: (
    <>
      <path d="M3 12.5h18a9 7 0 0 1-18 0z" />
      <path d="M9 20.5h6" />
      <path d="M9 9.5c-1-1.2.8-2.3 0-3.8M12 9.5c-1-1.2.8-2.3 0-3.8M15 9.5c-1-1.2.8-2.3 0-3.8" opacity="0.75" />
    </>
  ),
  lamp: (
    <>
      <path d="M3 14c1.8 3.4 5 5.2 9 5.2s7.2-1.8 9-5.2H3z" />
      <path d="M12 12.5c-1.9-1.6-2.1-3.8 0-7 2.1 3.2 1.9 5.4 0 7z" />
      <path d="M10 21.5h4" />
    </>
  ),
  music: (
    <>
      <path d="M9 17.5V5.5l11-2.5v12" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="15" r="2.5" />
      <path d="M9 9l11-2.5" opacity="0.7" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
      <path d="M12 6.5v13" />
      <path d="M6 9c1.4 0 2.8.3 4 .8M6 12c1.4 0 2.8.3 4 .8M14 9.8c1.2-.5 2.6-.8 4-.8" opacity="0.7" />
    </>
  ),
  alpana: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3.5c1.6 1.8 1.6 4 0 6-1.6-2-1.6-4.2 0-6zM12 14.5c1.6 2 1.6 4.2 0 6-1.6-1.8-1.6-4 0-6zM3.5 12c1.8-1.6 4-1.6 6 0-2 1.6-4.2 1.6-6 0zM14.5 12c2-1.6 4.2-1.6 6 0-1.8 1.6-4 1.6-6 0z" />
      <circle cx="12" cy="12" r="9.5" strokeDasharray="0.5 3" />
    </>
  ),
  people: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M2.5 19.5c.6-3.4 2.8-5.5 5.5-5.5s4.9 2.1 5.5 5.5" />
      <path d="M13.5 14.8c.9-.6 1.9-.8 3-.8 2.4 0 4.3 1.8 5 5" />
    </>
  ),
  sindoor: (
    <>
      <path d="M5 14.5v2c0 1.9 3.1 3.5 7 3.5s7-1.6 7-3.5v-2" />
      <ellipse cx="12" cy="14.5" rx="7" ry="2.8" />
      <path d="M7 13c.2-3 2.3-5.2 5-5.2s4.8 2.2 5 5.2" />
      <circle cx="12" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
  phone: <path d="M5 3.5h3.5l1.8 4.5-2.3 1.5a11 11 0 0 0 6.5 6.5l1.5-2.3 4.5 1.8V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5 1.5 1.5 0 0 1 5 3.5z" />,
  arrow: <path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  check: <path d="M4.5 12.5l4.5 4.5 10.5-10.5" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  share: (
    <>
      <circle cx="17.5" cy="5.5" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18.5" r="2.5" />
      <path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4" />
    </>
  ),
  link: <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />,
  pinTop: <path d="M9 3.5h6M12 3.5V9l4 4H8l4-4M12 13v7.5" />,
  megaphone: (
    <>
      <path d="M3.5 10v4a1 1 0 0 0 1 1H7l7 4.5V4.5L7 9H4.5a1 1 0 0 0-1 1z" />
      <path d="M17.5 9a4 4 0 0 1 0 6M8 15l1.2 5" />
    </>
  ),
  facebook: <path d="M14 8h2.5V4.5H14A4 4 0 0 0 10 8.5V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3v-2.2c0-.5.3-.8.5-.8z" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M4 20l1.2-3.8A8.5 8.5 0 1 1 8 19z" />
      <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8a4.5 4.5 0 0 1-2.3-2.3l.8-1-1-2z" />
    </>
  ),
};

export default function Icon({ name, size = 24, className, title, strokeWidth = 1.5 }) {
  const content = PATHS[name];
  if (!content) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
      focusable="false"
    >
      {content}
    </svg>
  );
}
