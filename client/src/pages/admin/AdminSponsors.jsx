import { useEffect, useId, useRef, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import Ticker from '../../components/ui/Ticker.jsx';
import { sponsorTickerItems } from '../../content/sponsorTicker.js';
import { sponsors as copy } from '../../content/pages.js';
import { invalidateApi } from '../../hooks/useApi.js';
import { adminApi } from '../../services/api.js';
import { AdminBar } from './AdminAnnouncements.jsx';
import { prepareLogo, useAdminSession } from './adminSession.js';
import { Field } from './coupons/formKit.jsx';
import styles from './Admin.module.css';

const EMPTY = { name: '', url: 'https://', logo: null, tile: false, status: 'published' };

export default function AdminSponsors() {
  const session = useAdminSession({ require: true });
  const uid = useId();
  const formRef = useRef(null);
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, { id?: string, form }
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ busy: false, uploading: false, message: '' });

  useEffect(() => {
    if (session.status !== 'authed') return;
    adminApi.sponsors().then(setItems, setLoadError);
  }, [session.status]);

  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session.status !== 'authed') {
    return (
      <div className="container section">
        <LoadingState />
      </div>
    );
  }

  const fid = (name) => `${uid}-${name}`;
  const form = editing?.form;
  const set = (key, value) => setEditing((e) => ({ ...e, form: { ...e.form, [key]: value } }));
  const open = (sponsor) => {
    setErrors({});
    setStatus({ busy: false, uploading: false, message: '' });
    setEditing(sponsor ? { id: sponsor.id, form: { ...EMPTY, ...sponsor } } : { form: EMPTY });
  };
  const changed = () => invalidateApi('sponsors');

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus((s) => ({ ...s, uploading: true, message: '' }));
    try {
      const { dataUrl, width, height } = await prepareLogo(file);
      const { src } = await adminApi.uploadImage(dataUrl);
      set('logo', { src, width, height });
    } catch (err) {
      setStatus((s) => ({ ...s, message: err.message }));
    } finally {
      setStatus((s) => ({ ...s, uploading: false }));
      e.target.value = '';
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ busy: true, uploading: false, message: '' });
    setErrors({});
    try {
      const saved = editing.id ? await adminApi.updateSponsor(editing.id, form) : await adminApi.createSponsor(form);
      setItems((list) => (editing.id ? list.map((s) => (s.id === saved.id ? saved : s)) : [...list, saved]));
      changed();
      setEditing(null);
      setStatus({ busy: false, uploading: false, message: '' });
    } catch (err) {
      setErrors(err.fields || {});
      setStatus({ busy: false, uploading: false, message: err.message });
    }
  };

  const move = async (index, by) => {
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved);
    setItems(next);
    try {
      setItems(await adminApi.reorderSponsors(next.map((s) => s.id)));
      changed();
    } catch (err) {
      setItems(items);
      window.alert(err.message);
    }
  };

  const remove = async (sponsor) => {
    if (!window.confirm(`Remove “${sponsor.name}” from the website? This cannot be undone.`)) return;
    try {
      await adminApi.deleteSponsor(sponsor.id);
      setItems((list) => list.filter((s) => s.id !== sponsor.id));
      if (editing?.id === sponsor.id) setEditing(null);
      changed();
    } catch (err) {
      window.alert(err.message);
    }
  };

  // Preview: the band as visitors will see it, with the sponsor being edited in place (or added at the end).
  const previewList = (() => {
    const list = (items || []).map((s) => (editing?.id === s.id ? { ...s, ...form } : s));
    if (editing && !editing.id && form.logo) list.push({ ...form, id: 'new', name: form.name || 'New sponsor' });
    return list.filter((s) => s.status !== 'hidden' && s.logo?.src);
  })();

  return (
    <>
      <Seo title="Manage sponsors" noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <div className={styles.head}>
            <h1 id="page-title" className={styles.h1}>
              <span lang="bn">সহযোগী</span> Sponsors
            </h1>
            {!editing && (
              <Button onClick={() => open(null)} arrow>
                Add sponsor
              </Button>
            )}
          </div>
          <p className={styles.listSummary}>
            Sponsors appear in the scrolling band at the bottom of the home page and on Get Involved → Sponsorship, in this order.
            Changes reach visitors within a minute or so — no rebuild needed.
          </p>

          {editing && (
            <form ref={formRef} className={`${styles.form} ${styles.sponsorEditor}`} onSubmit={onSubmit} noValidate>
              <fieldset className={styles.group}>
                <legend>{editing.id ? `Edit ${items?.find((s) => s.id === editing.id)?.name || 'sponsor'}` : 'New sponsor'}</legend>
                <div className={styles.row2}>
                  <Field label="Sponsor name" id={fid('name')} error={errors.name} hint="Also read out to screen-reader users." required>
                    <input
                      id={fid('name')}
                      value={form.name}
                      maxLength={120}
                      onChange={(e) => set('name', e.target.value)}
                      aria-invalid={errors.name ? 'true' : undefined}
                      aria-describedby={errors.name ? `${fid('name')}-error` : undefined}
                    />
                  </Field>
                  <Field label="Website" id={fid('url')} error={errors.url} hint="Opens in a new tab when the logo is clicked." required>
                    <input
                      id={fid('url')}
                      type="url"
                      value={form.url}
                      maxLength={500}
                      onChange={(e) => set('url', e.target.value)}
                      aria-invalid={errors.url ? 'true' : undefined}
                      aria-describedby={errors.url ? `${fid('url')}-error` : undefined}
                    />
                  </Field>
                </div>

                {form.logo?.src && (
                  <div className={styles.imagePreview}>
                    <img src={form.logo.src} alt="" className={styles.logoPreview} />
                  </div>
                )}
                <Field
                  label={form.logo?.src ? 'Replace logo' : 'Upload logo'}
                  id={fid('file')}
                  error={errors['logo.src']}
                  hint="JPEG, PNG or WebP. White margins are trimmed and the size is optimised automatically — a clear photo of the logo works."
                  required
                >
                  <input id={fid('file')} type="file" accept="image/jpeg,image/png,image/webp" onChange={onLogo} disabled={status.uploading} />
                </Field>
                {status.uploading && <p className={styles.hint}>Uploading…</p>}

                <label className={styles.check}>
                  <input type="checkbox" checked={form.tile} onChange={(e) => set('tile', e.target.checked)} />
                  The logo has its own background colour (fill the frame edge to edge, no white border)
                </label>
                <label className={styles.check}>
                  <input type="checkbox" checked={form.status !== 'hidden'} onChange={(e) => set('status', e.target.checked ? 'published' : 'hidden')} />
                  Show on the website
                </label>
              </fieldset>

              {status.message && (
                <p className={styles.formError} role="alert">
                  {status.message}
                </p>
              )}
              <div className={styles.formActions}>
                <Button type="submit" disabled={status.busy || status.uploading}>
                  {status.busy ? 'Saving…' : editing.id ? 'Save changes' : 'Add sponsor'}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {loadError && <ErrorState error={loadError} />}
          {!items && !loadError && <LoadingState lines={3} />}
          {items?.length === 0 && <p className="muted">No sponsors yet. The sponsor band is hidden until you add one.</p>}
          {items?.length > 0 && (
            <ul className={styles.list} role="list">
              {items.map((s, i) => (
                <li key={s.id} className={styles.row}>
                  <img src={s.logo?.src} alt="" width="64" height="64" className={`${styles.thumb} ${styles.logoThumb}`} />
                  <div className={styles.rowMain}>
                    <p className={styles.rowTitle}>{s.name}</p>
                    <p className={styles.rowMeta}>
                      {s.status === 'hidden' ? (
                        <span className={`${styles.badge} ${styles.badgeDraft}`}>Hidden</span>
                      ) : (
                        <span className={styles.badge}>On the website</span>
                      )}
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                      </a>
                    </p>
                  </div>
                  <div className={styles.rowActions}>
                    <span className={styles.orderBtns}>
                      <button type="button" className={styles.iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${s.name} up`}>
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => move(i, 1)}
                        disabled={i === items.length - 1}
                        aria-label={`Move ${s.name} down`}
                      >
                        ↓
                      </button>
                    </span>
                    <button type="button" className={`${styles.linkBtn} ${styles.editBtn}`} onClick={() => open(s)}>
                      Edit
                    </button>
                    <button type="button" className={styles.danger} onClick={() => remove(s)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {previewList.length > 0 && (
            <div className={styles.sponsorPreview}>
              <p className={styles.previewLabel}>Preview — the home page band</p>
              <Ticker
                items={sponsorTickerItems(previewList)}
                label={copy.label}
                ariaLabel="Sponsor band preview"
                icon="shankha"
                variant="logos"
                repeat={3}
                allTo="/get-involved#sponsorship"
                allLabel={copy.become.en}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
