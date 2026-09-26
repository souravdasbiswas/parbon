import { pick } from '../../i18n/pick.js';

/**
 * Renders the Bengali value of a localized field with the correct `lang` attribute,
 * so fonts, line-height, hyphenation and screen readers all treat it as Bengali.
 */
export default function Bn({ text, as: Tag = 'span', className, ...rest }) {
  const value = pick(text, 'bn');
  if (!value) return null;
  return (
    <Tag lang="bn" className={className} {...rest}>
      {value}
    </Tag>
  );
}
