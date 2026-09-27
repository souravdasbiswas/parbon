/**
 * The official Parbon logo, served as responsive AVIF/WebP/PNG derivatives of
 * images/logo.jpeg (see scripts/optimize-images.mjs). The artwork is never redrawn.
 */
export default function Logo({ width = 320, sizes, className, loading = 'lazy', fetchPriority, alt = 'Parbon Sanskritik Samity' }) {
  const set = (ext) => [160, 320, 480, 720].map((w) => `/brand/logo-${w}.${ext} ${w}w`).join(', ');
  const height = Math.round((width * 1066) / 903);
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={set('avif')} sizes={sizes || `${width}px`} />
      <source type="image/webp" srcSet={set('webp')} sizes={sizes || `${width}px`} />
      <img
        src={`/brand/logo-${width >= 320 ? 480 : 160}.png`}
        srcSet={set('png')}
        sizes={sizes || `${width}px`}
        width={width}
        height={height}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
      />
    </picture>
  );
}
