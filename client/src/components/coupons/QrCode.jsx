import QRCode from 'qrcode';
import { useMemo } from 'react';

/**
 * A crisp SVG QR code drawn from the module matrix (no canvas, no innerHTML), so colours,
 * padding and rounding follow the coupon design and it scales cleanly when saved as an image.
 */
export default function QrCode({ value, fg = '#231a15', bg = '#ffffff', padding = 0, radius = 0, className, title = 'QR code' }) {
  const { size, path } = useMemo(() => {
    try {
      const { modules } = QRCode.create(String(value || ' '), { errorCorrectionLevel: 'M' });
      let d = '';
      for (let y = 0; y < modules.size; y += 1) {
        for (let x = 0; x < modules.size; x += 1) {
          if (modules.data[y * modules.size + x]) d += `M${x} ${y}h1v1h-1z`;
        }
      }
      return { size: modules.size, path: d };
    } catch {
      return { size: 1, path: '' };
    }
  }, [value]);

  return (
    <div className={className} style={{ width: '100%', height: '100%', padding, background: bg, borderRadius: radius, boxSizing: 'border-box' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" shapeRendering="crispEdges" role="img" aria-label={title}>
        <path d={path} fill={fg} />
      </svg>
    </div>
  );
}
