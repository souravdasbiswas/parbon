/**
 * Small lotus + flourish divider, echoing the ornament beneath the Parbon wordmark.
 */
export default function LotusDivider({ className }) {
  return (
    <svg className={className} viewBox="0 0 240 28" width="240" height="28" fill="none" aria-hidden="true" focusable="false">
      <path d="M0 16 H84" stroke="var(--color-vermilion)" strokeWidth="1" />
      <path d="M156 16 H240" stroke="var(--color-vermilion)" strokeWidth="1" />
      <path d="M86 16 C 94 8, 102 8, 104 16 C 102 22, 94 22, 86 16 Z" fill="var(--color-gold)" opacity="0.8" />
      <path d="M154 16 C 146 8, 138 8, 136 16 C 138 22, 146 22, 154 16 Z" fill="var(--color-gold)" opacity="0.8" />
      <g fill="var(--color-vermilion)">
        <path d="M120 2 C 127 9, 127 17, 120 24 C 113 17, 113 9, 120 2 Z" />
        <path d="M120 24 C 112 23, 106 18, 104 11 C 111 11, 117 15, 120 24 Z" opacity="0.85" />
        <path d="M120 24 C 128 23, 134 18, 136 11 C 129 11, 123 15, 120 24 Z" opacity="0.85" />
      </g>
    </svg>
  );
}
