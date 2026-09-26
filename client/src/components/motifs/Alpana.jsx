/**
 * Procedurally drawn alpana (Bengali floor art): concentric rings of petals,
 * dots and loops. Pure SVG, inherits `currentColor`, decorative only.
 */
const TAU = Math.PI * 2;

function ring(count, radius, render) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 360;
    return render(angle, i, radius);
  });
}

const petal = (len, width) =>
  `M0 0 C ${width} ${-len * 0.35}, ${width * 0.6} ${-len * 0.85}, 0 ${-len} C ${-width * 0.6} ${-len * 0.85}, ${-width} ${-len * 0.35}, 0 0 Z`;

export default function Alpana({ className, strokeWidth = 1.2, style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="-200 -200 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle r="10" />
      <circle r="3" fill="currentColor" stroke="none" />
      {ring(8, 0, (a, i) => (
        <path key={`p1-${i}`} d={petal(42, 13)} transform={`rotate(${a}) translate(0 -12)`} />
      ))}
      <circle r="60" />
      {ring(32, 66, (a, i) => (
        <circle key={`d1-${i}`} r="2" cx={Math.sin((a * TAU) / 360) * 66} cy={-Math.cos((a * TAU) / 360) * 66} fill="currentColor" stroke="none" />
      ))}
      {ring(16, 0, (a, i) => (
        <path key={`p2-${i}`} d={petal(54, 15)} transform={`rotate(${a + 11.25}) translate(0 -74)`} />
      ))}
      {ring(16, 0, (a, i) => (
        <path key={`p3-${i}`} d={petal(26, 7)} transform={`rotate(${a + 11.25}) translate(0 -86)`} opacity="0.7" />
      ))}
      <circle r="134" />
      <circle r="140" strokeDasharray="1 7" strokeWidth={strokeWidth * 2.2} />
      {ring(24, 0, (a, i) => (
        <path
          key={`l-${i}`}
          d="M -12 0 C -12 -18, 12 -18, 12 0"
          transform={`rotate(${a}) translate(0 -148)`}
        />
      ))}
      {ring(24, 0, (a, i) => (
        <g key={`s-${i}`} transform={`rotate(${a + 7.5}) translate(0 -168)`}>
          <path d="M0 8 C 6 0, 6 -8, 0 -16 C -6 -8, -6 0, 0 8 Z" />
          <circle r="1.8" cy="-24" fill="currentColor" stroke="none" />
        </g>
      ))}
      <circle r="190" opacity="0.6" />
    </svg>
  );
}
