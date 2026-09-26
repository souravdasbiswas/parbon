import { useId, useRef, useState } from 'react';
import { ApiError, inquiryApi } from '../../services/api.js';
import Icon from '../motifs/Icon.jsx';
import Button from '../ui/Button.jsx';
import styles from './InquiryForm.module.css';

const INQUIRY_TYPES = [
  { value: 'general', label: 'General enquiry', bn: 'সাধারণ জিজ্ঞাসা' },
  { value: 'volunteer', label: 'Volunteering', bn: 'স্বেচ্ছাসেবা' },
  { value: 'membership', label: 'Membership', bn: 'সদস্যপদ' },
  { value: 'sponsorship', label: 'Sponsorship / Donation', bn: 'পৃষ্ঠপোষকতা / অনুদান' },
  { value: 'performance', label: 'Perform at a cultural programme', bn: 'অনুষ্ঠানে অংশগ্রহণ' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(values) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = 'Please tell us your name.';
  if (!EMAIL_RE.test(values.email.trim())) errors.email = 'Please enter a valid email address.';
  if (values.phone && !/^[+()\d\s-]{6,20}$/.test(values.phone.trim())) errors.phone = 'Please enter a valid phone number.';
  if (values.message.trim().length < 10) errors.message = 'Please write a message of at least 10 characters.';
  return errors;
}

export default function InquiryForm({ initialType = 'general' }) {
  const uid = useId();
  const formRef = useRef(null);
  const type = INQUIRY_TYPES.some((t) => t.value === initialType) ? initialType : 'general';
  const [values, setValues] = useState({ type, name: '', email: '', phone: '', message: '', website: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [serverMessage, setServerMessage] = useState('');

  const id = (name) => `${uid}-${name}`;
  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  const focusFirstError = (errs) => {
    const first = Object.keys(errs).find((k) => errs[k]);
    if (first) formRef.current?.querySelector(`[name="${first}"]`)?.focus();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const clientErrors = validate(values);
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      focusFirstError(clientErrors);
      return;
    }
    setStatus('submitting');
    setServerMessage('');
    try {
      await inquiryApi.submit(values);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiError && err.fields) {
        setErrors(err.fields);
        focusFirstError(err.fields);
      }
      setServerMessage(err.message || 'Something went wrong. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className={styles.success} role="status" tabIndex={-1} ref={(el) => el?.focus()}>
        <span className={styles.successIcon}>
          <Icon name="check" size={28} />
        </span>
        <p lang="bn" className={styles.successBn}>
          অনেক ধন্যবাদ! আপনার বার্তা আমরা পেয়েছি।
        </p>
        <p>Thank you — your message has reached us. A member of our committee will get back to you soon.</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setValues({ type, name: '', email: '', phone: '', message: '', website: '' });
            setStatus('idle');
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  const field = (name) => ({
    id: id(name),
    name,
    value: values[name],
    onChange,
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? id(`${name}-error`) : undefined,
  });

  const fieldError = (name) =>
    errors[name] ? (
      <p id={id(`${name}-error`)} className={styles.error}>
        {errors[name]}
      </p>
    ) : null;

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor={id('type')}>What would you like to talk about?</label>
        <select {...field('type')}>
          {INQUIRY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label} — {t.bn}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={id('name')}>
            Your name <span aria-hidden="true">*</span>
          </label>
          <input {...field('name')} type="text" autoComplete="name" required maxLength={100} />
          {fieldError('name')}
        </div>
        <div className={styles.field}>
          <label htmlFor={id('email')}>
            Email <span aria-hidden="true">*</span>
          </label>
          <input {...field('email')} type="email" autoComplete="email" required maxLength={200} inputMode="email" />
          {fieldError('email')}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor={id('phone')}>
          Phone <span className={styles.optional}>(optional)</span>
        </label>
        <input {...field('phone')} type="tel" autoComplete="tel" maxLength={20} inputMode="tel" />
        {fieldError('phone')}
      </div>

      <div className={styles.field}>
        <label htmlFor={id('message')}>
          Message <span aria-hidden="true">*</span>
        </label>
        <textarea {...field('message')} rows={6} required maxLength={3000} />
        <p className={styles.hint}>
          You can write in English or <span lang="bn">বাংলা</span>.
        </p>
        {fieldError('message')}
      </div>

      {/* Honeypot — hidden from people, tempting for bots. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={id('website')}>Leave this field empty</label>
        <input {...field('website')} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status === 'error' && serverMessage && (
        <p className={styles.formError} role="alert">
          {serverMessage}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" size="lg" arrow disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Sending…' : 'Send message'}
        </Button>
        <p className={styles.privacy}>We only use your details to reply to you.</p>
      </div>
    </form>
  );
}
