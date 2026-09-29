import styles from '../Admin.module.css';

/** Labelled form field in the admin style, with hint and error text wired for screen readers. */
export function Field({ label, hint, error, children, id, required, className = '' }) {
  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id}>
        {label} {required && <span aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
      {error && (
        <p className={styles.fieldError} id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
