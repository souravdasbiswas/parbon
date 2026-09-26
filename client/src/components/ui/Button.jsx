import { Link } from 'react-router';
import Icon from '../motifs/Icon.jsx';
import styles from './Button.module.css';

/**
 * Polymorphic button: renders a router <Link> for internal paths, <a> for
 * external/hash links, and <button> otherwise.
 */
export default function Button({ to, href, variant = 'primary', size = 'md', arrow = false, className = '', children, ...rest }) {
  const cls = `${styles.button} ${styles[variant]} ${styles[size]} ${className}`;
  const content = (
    <>
      <span>{children}</span>
      {arrow && <Icon name="arrow" size={18} className={styles.arrow} />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    const external = /^https?:\/\//.test(href);
    return (
      <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {content}
    </button>
  );
}
