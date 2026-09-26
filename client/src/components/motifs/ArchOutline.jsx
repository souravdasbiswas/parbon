/**
 * Temple / pandal arch outline (ogee arch with a lotus finial), inspired by
 * Bengal's terracotta temple doorways. Scales to its container.
 */
export const ARCH_PATH =
  'M4 196 V78 C4 50 22 34 42 28 C52 16 66 12 76 6 C84 4 92 2 100 0 C108 2 116 4 124 6 C134 12 148 16 158 28 C178 34 196 50 196 78 V196';

export default function ArchOutline({ className, fill = 'none' }) {
  return (
    <svg className={className} viewBox="-2 -14 204 214" fill="none" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={ARCH_PATH} fill={fill} stroke="var(--color-gold)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <path
        d="M14 196 V82 C14 58 30 44 48 38 C58 26 72 22 80 17 C88 14 94 12 100 11 C106 12 112 14 120 17 C128 22 142 26 152 38 C170 44 186 58 186 82 V196"
        stroke="var(--color-vermilion)"
        strokeWidth="1"
        opacity="0.55"
        vectorEffect="non-scaling-stroke"
      />
      <g transform="translate(100 -6)" fill="var(--color-vermilion)">
        <path d="M0 -8 C 4 -4, 4 1, 0 5 C -4 1, -4 -4, 0 -8 Z" />
        <path d="M0 5 C -5 4, -8 1, -9 -3 C -5 -3, -2 0, 0 5 Z" opacity="0.8" />
        <path d="M0 5 C 5 4, 8 1, 9 -3 C 5 -3, 2 0, 0 5 Z" opacity="0.8" />
      </g>
    </svg>
  );
}
