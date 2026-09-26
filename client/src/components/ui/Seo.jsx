import { useLocation } from 'react-router';
import { BRAND } from '../../content/navigation.js';

const DEFAULT_DESCRIPTION =
  'Parbon Sanskritik Samity is a Bengali cultural community celebrating music, literature, art, food and festivals — beginning with Durga Puja 2026.';

/**
 * Per-page metadata. React 19 hoists <title>, <meta> and <link> into <head> automatically.
 */
export default function Seo({ title, description = DEFAULT_DESCRIPTION, image = '/brand/og-image.jpg', noindex = false, type = 'website' }) {
  const { pathname } = useLocation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fullTitle = title ? `${title} · ${BRAND.name.en}` : `${BRAND.name.en} · ${BRAND.name.bn}`;
  const url = `${origin}${pathname}`;
  const imageUrl = image.startsWith('http') ? image : `${origin}${image}`;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex" />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={BRAND.name.en} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:locale:alternate" content="bn_IN" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}
