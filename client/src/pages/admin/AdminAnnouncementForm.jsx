import { useEffect, useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import AnnouncementCard from '../../components/announcements/AnnouncementCard.jsx';
import Button from '../../components/ui/Button.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { invalidateApi } from '../../hooks/useApi.js';
import { adminApi } from '../../services/api.js';
import { AdminBar } from './AdminAnnouncements.jsx';
import { prepareImage, useAdminSession } from './adminSession.js';
import styles from './Admin.module.css';

const EMPTY = {
  title: { en: '', bn: '' },
  body: { en: '', bn: '' },
  image: null,
  location: { name: '', address: '', mapUrl: '' },
  contact: { name: '', phone: '', whatsapp: '', email: '' },
  link: { label: '', url: '' },
  status: 'published',
  pinned: false,
  showDonation: false,
  publishedAt: '',
};

// <input type="datetime-local"> works in local time without a zone.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const fromRecord = (r) => ({
  ...EMPTY,
  ...r,
  title: { ...EMPTY.title, ...r.title },
  body: { ...EMPTY.body, ...r.body },
  location: { ...EMPTY.location, ...(r.location || {}) },
  contact: { ...EMPTY.contact, ...(r.contact || {}) },
  link: { ...EMPTY.link, ...(r.link || {}) },
  publishedAt: toLocalInput(r.publishedAt),
});

function Field({ label, hint, error, children, id, required }) {
  return (
    <div className={styles.field}>
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

export default function AdminAnnouncementForm() {
  const { id } = useParams();
  const isNew = !id;
  const uid = useId();
  const navigate = useNavigate();
  const session = useAdminSession({ require: true });
  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ busy: false, message: '', uploading: false });
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (isNew || session.status !== 'authed') return;
    adminApi.announcement(id).then((r) => setForm(fromRecord(r)), setLoadError);
  }, [id, isNew, session.status]);

  if (session.status !== 'authed' || (!form && !loadError)) {
    return (
      <div className="container section">
        <LoadingState lines={5} />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="container section">
        <ErrorState error={loadError} />
      </div>
    );
  }

  const fid = (name) => `${uid}-${name.replace('.', '-')}`;
  const set = (path, value) =>
    setForm((f) => {
      const [group, key] = path.split('.');
      return key ? { ...f, [group]: { ...f[group], [key]: value } } : { ...f, [group]: value };
    });
  const bind = (path, extra = {}) => {
    const [group, key] = path.split('.');
    return {
      id: fid(path),
      value: key ? form[group]?.[key] ?? '' : form[group] ?? '',
      onChange: (e) => set(path, e.target.value),
      'aria-invalid': errors[path] ? 'true' : undefined,
      'aria-describedby': errors[path] ? `${fid(path)}-error` : undefined,
      ...extra,
    };
  };

  const onImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus((s) => ({ ...s, uploading: true, message: '' }));
    try {
      const { dataUrl, width, height } = await prepareImage(file);
      const { src } = await adminApi.uploadImage(dataUrl);
      set('image', { src, width, height, alt: form.image?.alt || '' });
    } catch (err) {
      setStatus((s) => ({ ...s, message: err.message }));
    } finally {
      setStatus((s) => ({ ...s, uploading: false }));
      e.target.value = '';
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ busy: true, message: '', uploading: false });
    setErrors({});
    const payload = { ...form, publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined };
    try {
      if (isNew) await adminApi.createAnnouncement(payload);
      else await adminApi.updateAnnouncement(id, payload);
      invalidateApi('announcements');
      navigate('/admin/announcements');
    } catch (err) {
      setErrors(err.fields || {});
      setStatus({ busy: false, message: err.message, uploading: false });
    }
  };

  const preview = {
    ...form,
    slug: 'preview',
    publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : new Date().toISOString(),
    location: form.location.name || form.location.address ? form.location : null,
    contact: Object.values(form.contact).some(Boolean) ? form.contact : null,
    link: form.link.url ? form.link : null,
    title: { ...form.title, en: form.title.en || 'Your announcement title' },
    body: { ...form.body, en: form.body.en || 'Your message will appear here…' },
  };

  return (
    <>
      <Seo title={isNew ? 'New announcement' : 'Edit announcement'} noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <h1 id="page-title" className={styles.h1}>
            {isNew ? 'New announcement' : 'Edit announcement'}
          </h1>
          <div className={styles.editor}>
            <form className={styles.form} onSubmit={onSubmit} noValidate>
              <fieldset className={styles.group}>
                <legend>Message</legend>
                <Field label="Title (English)" id={fid('title.en')} error={errors['title.en']} required>
                  <input {...bind('title.en')} maxLength={140} required />
                </Field>
                <Field label="Title (Bengali)" id={fid('title.bn')} hint="Optional — shown under the English title.">
                  <input {...bind('title.bn')} lang="bn" maxLength={140} />
                </Field>
                <Field
                  label="Message (English)"
                  id={fid('body.en')}
                  error={errors['body.en']}
                  hint="Write it the way you would on WhatsApp — line breaks, emoji ❤️ and links all work."
                  required
                >
                  <textarea {...bind('body.en')} rows={8} maxLength={5000} />
                </Field>
                <Field label="Message (Bengali)" id={fid('body.bn')} hint="Optional.">
                  <textarea {...bind('body.bn')} lang="bn" rows={4} maxLength={5000} />
                </Field>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Image or poster</legend>
                {form.image?.src && (
                  <div className={styles.imagePreview}>
                    <img src={form.image.src} alt="" />
                    <button type="button" className={styles.danger} onClick={() => set('image', null)}>
                      Remove image
                    </button>
                  </div>
                )}
                <Field
                  label={form.image?.src ? 'Replace image' : 'Upload image'}
                  id={fid('file')}
                  hint="JPEG, PNG or WebP. Large photos are resized automatically."
                  error={errors['image.src']}
                >
                  <input id={fid('file')} type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage} disabled={status.uploading} />
                </Field>
                {status.uploading && <p className={styles.hint}>Uploading…</p>}
                {form.image?.src && (
                  <Field label="Describe the image" id={fid('alt')} hint="For people using screen readers, e.g. “Durga Puja invitation poster with a UPI QR code”.">
                    <input
                      id={fid('alt')}
                      value={form.image.alt || ''}
                      maxLength={300}
                      onChange={(e) => set('image', { ...form.image, alt: e.target.value })}
                    />
                  </Field>
                )}
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Location (optional)</legend>
                <Field label="Place" id={fid('location.name')}>
                  <input {...bind('location.name')} maxLength={140} />
                </Field>
                <Field label="Address" id={fid('location.address')}>
                  <input {...bind('location.address')} maxLength={300} />
                </Field>
                <Field label="Google Maps link" id={fid('location.mapUrl')} error={errors['location.mapUrl']} hint="Paste the share link from Google Maps.">
                  <input {...bind('location.mapUrl')} type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" />
                </Field>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Contact (optional)</legend>
                <div className={styles.row2}>
                  <Field label="Name" id={fid('contact.name')}>
                    <input {...bind('contact.name')} maxLength={100} />
                  </Field>
                  <Field label="Phone" id={fid('contact.phone')} error={errors['contact.phone']}>
                    <input {...bind('contact.phone')} type="tel" maxLength={20} />
                  </Field>
                  <Field label="WhatsApp number" id={fid('contact.whatsapp')} error={errors['contact.whatsapp']} hint="With country code, e.g. +91 98765 43210">
                    <input {...bind('contact.whatsapp')} type="tel" maxLength={20} />
                  </Field>
                  <Field label="Email" id={fid('contact.email')} error={errors['contact.email']}>
                    <input {...bind('contact.email')} type="email" maxLength={200} />
                  </Field>
                </div>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Button &amp; options</legend>
                <div className={styles.row2}>
                  <Field label="Button label" id={fid('link.label')} hint="e.g. “Puja timings”">
                    <input {...bind('link.label')} maxLength={60} />
                  </Field>
                  <Field label="Button link" id={fid('link.url')} error={errors['link.url']} hint="https://… or a page on this site like /durga-puja">
                    <input {...bind('link.url')} maxLength={500} />
                  </Field>
                </div>
                <label className={styles.check}>
                  <input type="checkbox" checked={form.showDonation} onChange={(e) => set('showDonation', e.target.checked)} />
                  Show the “Offer pronami” (donation) button
                </label>
                <label className={styles.check}>
                  <input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} />
                  Pin to the top
                </label>
                <div className={styles.row2}>
                  <Field label="Status" id={fid('status')}>
                    <select {...bind('status')}>
                      <option value="published">Published</option>
                      <option value="draft">Draft (hidden)</option>
                    </select>
                  </Field>
                  <Field label="Publish date & time" id={fid('publishedAt')} error={errors.publishedAt} hint="Leave empty for now. A future time schedules it.">
                    <input {...bind('publishedAt')} type="datetime-local" />
                  </Field>
                </div>
              </fieldset>

              {status.message && (
                <p className={styles.formError} role="alert">
                  {status.message}
                </p>
              )}
              <div className={styles.formActions}>
                <Button type="submit" size="lg" disabled={status.busy || status.uploading}>
                  {status.busy ? 'Saving…' : isNew ? 'Publish announcement' : 'Save changes'}
                </Button>
                <Button to="/admin/announcements" variant="secondary">
                  Cancel
                </Button>
              </div>
            </form>

            <aside className={styles.preview} aria-label="Live preview">
              <p className={styles.previewLabel}>Live preview</p>
              <AnnouncementCard announcement={preview} preview />
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
