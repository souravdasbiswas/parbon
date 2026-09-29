import { createContext, useContext, useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import Icon from '../../components/motifs/Icon.jsx';
import Button from '../../components/ui/Button.jsx';
import EventCard from '../../components/ui/EventCard.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { invalidateApi } from '../../hooks/useApi.js';
import { adminApi } from '../../services/api.js';
import { AdminBar } from './AdminAnnouncements.jsx';
import { prepareImage, useAdminSession } from './adminSession.js';
import { getPath, setPath } from './coupons/formUtils.js';
import styles from './Admin.module.css';
import e from './EventForm.module.css';

// Keep in sync with EVENT_ICONS in server/src/utils/validateEvent.js.
const ICONS = ['dhak', 'shankha', 'lotus', 'bhog', 'lamp', 'music', 'book', 'alpana', 'people', 'sindoor', 'calendar', 'pin', 'megaphone'];
const bi = () => ({ en: '', bn: '' });

const EMPTY = {
  title: bi(),
  category: bi(),
  tagline: bi(),
  slug: '',
  state: 'draft',
  publishedAt: '',
  featured: false,
  dateTba: false,
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  dateLabel: { en: 'Date to be announced', bn: 'তারিখ শীঘ্রই' },
  venue: { name: bi(), spot: bi(), area: bi(), address: bi(), mapUrl: '', geo: '' },
  summary: bi(),
  description: [bi()],
  image: null,
  highlights: [],
  schedule: [],
  scheduleNote: bi(),
};

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Stored event → form state (nulls become empty fields; geo becomes "lat, lng"). */
function fromEvent(ev) {
  const b = (v) => ({ ...bi(), ...(v || {}) });
  return {
    ...EMPTY,
    ...ev,
    title: b(ev.title),
    category: b(ev.category),
    tagline: b(ev.tagline),
    summary: b(ev.summary),
    scheduleNote: b(ev.scheduleNote),
    dateTba: !ev.startDate,
    startDate: ev.startDate || '',
    endDate: ev.endDate || '',
    startTime: ev.startTime || '',
    endTime: ev.endTime || '',
    dateLabel: ev.dateLabel ? b(ev.dateLabel) : EMPTY.dateLabel,
    venue: ev.venue
      ? { name: b(ev.venue.name), spot: b(ev.venue.spot), area: b(ev.venue.area), address: b(ev.venue.address), mapUrl: ev.venue.mapUrl || '', geo: ev.venue.geo ? `${ev.venue.geo.lat}, ${ev.venue.geo.lng}` : '', mapEmbedUrl: ev.venue.mapEmbedUrl || '' }
      : EMPTY.venue,
    description: ev.description?.length ? ev.description.map(b) : [bi()],
    highlights: (ev.highlights || []).map((h) => ({ icon: h.icon || 'lotus', title: b(h.title), text: b(h.text) })),
    schedule: (ev.schedule || []).map((d) => ({ date: d.date || '', day: b(d.day), note: b(d.note), main: Boolean(d.main), items: (d.items || []).map((i) => ({ time: i.time || '', title: b(i.title) })) })),
    publishedAt: toLocalInput(ev.publishedAt),
  };
}

function toPayload(form, state) {
  const { status: _s, id: _i, createdAt: _c, updatedAt: _u, author: _a, ...rest } = form;
  return { ...rest, state: state || form.state, publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : '' };
}

/** Form data → the shape EventCard expects, for the live preview. */
function previewOf(form) {
  const opt = (v) => (v?.en || v?.bn ? v : null);
  return {
    slug: form.slug || 'preview',
    title: { en: form.title.en || 'Event name', bn: form.title.bn },
    category: opt(form.category),
    startDate: form.dateTba ? null : form.startDate || null,
    endDate: form.dateTba ? null : form.endDate || form.startDate || null,
    startTime: form.startTime,
    endTime: form.endTime,
    dateLabel: form.dateLabel,
    venue: form.venue.name.en || form.venue.name.bn ? { name: form.venue.name, spot: opt(form.venue.spot), area: opt(form.venue.area) } : null,
    summary: form.summary,
    image: form.image,
  };
}

function move(list, i, dir) {
  const next = [...list];
  const j = i + dir;
  if (j < 0 || j >= next.length) return next;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const FormKit = createContext(null);

/** English + Bengali inputs for one bilingual field (reads the form helpers from FormKit). */
function Bi({ path, label, required, textarea, rows = 3, hint, max = 200 }) {
  const { bind, errors } = useContext(FormKit);
  return (
    <div className={styles.field}>
      <span className={e.biLabel}>
        {label} {required && <span aria-hidden="true">*</span>}
      </span>
      <div className={e.biRow}>
        {['en', 'bn'].map((lang) =>
          textarea ? (
            <textarea key={lang} {...bind(`${path}.${lang}`)} rows={rows} maxLength={max * 10} lang={lang} aria-label={`${label} (${lang === 'en' ? 'English' : 'Bengali'})`} placeholder={lang === 'en' ? 'English' : 'বাংলা'} />
          ) : (
            <input key={lang} {...bind(`${path}.${lang}`)} maxLength={max} lang={lang} aria-label={`${label} (${lang === 'en' ? 'English' : 'Bengali'})`} placeholder={lang === 'en' ? 'English' : 'বাংলা'} />
          ),
        )}
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
      {errors[`${path}.en`] && <p className={styles.fieldError}>{errors[`${path}.en`]}</p>}
    </div>
  );
}

function ListTools({ onUp, onDown, onRemove, label }) {
  return (
    <div className={e.listTools}>
      <button type="button" onClick={onUp} aria-label={`Move ${label} up`}>
        ↑
      </button>
      <button type="button" onClick={onDown} aria-label={`Move ${label} down`}>
        ↓
      </button>
      <button type="button" className={e.remove} onClick={onRemove} aria-label={`Remove ${label}`}>
        ✕
      </button>
    </div>
  );
}

export default function AdminEventForm() {
  const { id } = useParams();
  const isNew = !id;
  const uid = useId();
  const navigate = useNavigate();
  const session = useAdminSession({ require: true });
  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [saved, setSaved] = useState(null);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ busy: false, message: '', ok: '', uploading: false });
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (isNew || session.status !== 'authed') return;
    adminApi.event(id).then((ev) => {
      setSaved(ev);
      setForm(fromEvent(ev));
    }, setLoadError);
  }, [id, isNew, session.status]);

  if (session.status !== 'authed' || (!form && !loadError)) {
    return (
      <div className="container section">
        <LoadingState lines={6} />
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

  const fid = (path) => `${uid}-${path.replace(/\./g, '-')}`;
  const set = (path, value) => setForm((f) => setPath(f, path, value));
  const bind = (path, extra = {}) => ({
    id: fid(path),
    value: getPath(form, path) ?? '',
    onChange: (ev) => set(path, ev.target.value),
    'aria-invalid': errors[path] ? 'true' : undefined,
    ...extra,
  });
  const err = (path) => errors[path] && <p className={styles.fieldError}>{errors[path]}</p>;
  const published = saved?.state === 'published';
  const live = published && new Date(saved.publishedAt) <= new Date();

  const onImage = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setStatus((s) => ({ ...s, uploading: true, message: '' }));
    try {
      const prepared = await prepareImage(file);
      const up = await adminApi.uploadImage(prepared.dataUrl);
      set('image', { src: up.src, alt: form.image?.alt || '', width: prepared.width, height: prepared.height });
      setStatus((s) => ({ ...s, uploading: false }));
    } catch (error) {
      setStatus((s) => ({ ...s, uploading: false, message: error.message }));
    }
  };

  const save = async (state) => {
    setStatus((s) => ({ ...s, busy: true, message: '', ok: '' }));
    setErrors({});
    try {
      const payload = toPayload(form, state);
      const result = isNew ? await adminApi.createEvent(payload) : await adminApi.updateEvent(id, payload);
      invalidateApi('event');
      setSaved(result);
      setForm(fromEvent(result));
      const msg = result.state === 'published' ? (new Date(result.publishedAt) > new Date() ? 'Saved — it will appear on the website at the scheduled time.' : 'Published — it’s on the website now.') : 'Draft saved — not on the website yet.';
      setStatus((s) => ({ ...s, busy: false, ok: msg }));
      if (isNew) navigate(`/admin/events/${result.id}`, { replace: true });
    } catch (error) {
      setErrors(error.fields || {});
      setStatus((s) => ({ ...s, busy: false, message: error.fields ? 'Please check the highlighted fields.' : error.message }));
    }
  };

  const couponsLink = `/admin/coupons/new?from=${encodeURIComponent(form.slug)}`;

  return (
    <>
      <Seo title={isNew ? 'New event' : `Edit — ${form.title.en}`} noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <p className={e.crumb}>
            <Link to="/admin/events">← All events</Link>
          </p>
          <h1 id="page-title" className={styles.h1}>
            {isNew ? 'New event' : 'Edit event'}
            {saved && <span className={`${styles.badge} ${published ? '' : styles.badgeDraft} ${e.titleBadge}`}>{published ? (live ? 'Published' : 'Scheduled') : 'Draft'}</span>}
          </h1>

          <FormKit.Provider value={{ bind, errors }}>
          <div className={styles.editor}>
            <form className={styles.form} onSubmit={(ev) => { ev.preventDefault(); save(); }} noValidate>
              <fieldset className={styles.group}>
                <legend>Basics</legend>
                <Bi path="title" label="Event name" required max={140} />
                <Bi path="category" label="Category" hint="Optional, e.g. Festival · উৎসব, Gathering · মিলনমেলা." max={60} />
                <Bi path="tagline" label="Short line" hint="Optional, shown under the name." />
                <div className={styles.field}>
                  <label htmlFor={fid('slug')}>Link name</label>
                  <input {...bind('slug')} maxLength={80} disabled={published} placeholder="made from the name" />
                  <p className={styles.hint}>
                    {published ? 'Locked because the event is published (shared links use it).' : `The page will be ${window.location.origin}/events/${form.slug || '…'}.`}
                  </p>
                  {err('slug')}
                </div>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>When</legend>
                <label className={styles.check}>
                  <input type="checkbox" checked={form.dateTba} onChange={(ev) => set('dateTba', ev.target.checked)} /> Date to be announced
                </label>
                {form.dateTba ? (
                  <Bi path="dateLabel" label="What to show instead of a date" hint="e.g. After Durga Puja · Date to be announced" />
                ) : (
                  <div className={styles.row2}>
                    <div className={styles.field}>
                      <label htmlFor={fid('startDate')}>
                        Date (first day) <span aria-hidden="true">*</span>
                      </label>
                      <input type="date" {...bind('startDate')} />
                      {err('startDate')}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor={fid('endDate')}>Last day</label>
                      <input type="date" {...bind('endDate')} min={form.startDate || undefined} />
                      <p className={styles.hint}>Only for events over several days.</p>
                      {err('endDate')}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor={fid('startTime')}>Starts at</label>
                      <input type="time" {...bind('startTime')} />
                      {err('startTime')}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor={fid('endTime')}>Ends at</label>
                      <input type="time" {...bind('endTime')} />
                      {err('endTime')}
                    </div>
                  </div>
                )}
                <p className={styles.hint}>Upcoming and Past follow these dates automatically (India time).</p>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Where</legend>
                <Bi path="venue.name" label="Venue" max={140} />
                <Bi path="venue.spot" label="Spot" hint="Optional, e.g. On the terrace · 5th floor." max={140} />
                <Bi path="venue.area" label="Area" hint="Optional, e.g. Lingampally, Hyderabad." max={140} />
                <Bi path="venue.address" label="Address" max={300} />
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label htmlFor={fid('venue.mapUrl')}>Google Maps link</label>
                    <input type="url" {...bind('venue.mapUrl')} placeholder="https://maps.app.goo.gl/…" />
                    {err('venue.mapUrl')}
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={fid('venue.geo')}>Map pin (latitude, longitude)</label>
                    <input {...bind('venue.geo')} placeholder="17.4829, 78.3202" />
                    <p className={styles.hint}>Optional — shows a map on the event page. In Google Maps, right-click the place to copy it.</p>
                    {err('venue.geo')}
                  </div>
                </div>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>About</legend>
                <Bi path="summary" label="Summary" required textarea rows={3} hint="One or two sentences for the event card." max={40} />
                <div className={styles.field}>
                  <span className={e.biLabel}>Description</span>
                  {form.description.map((_, i) => (
                    <div key={i} className={e.repeat}>
                      <div className={e.biRow}>
                        {['en', 'bn'].map((lang) => (
                          <textarea key={lang} {...bind(`description.${i}.${lang}`)} rows={4} lang={lang} aria-label={`Paragraph ${i + 1} (${lang === 'en' ? 'English' : 'Bengali'})`} placeholder={lang === 'en' ? 'Paragraph (English)' : 'অনুচ্ছেদ (বাংলা)'} />
                        ))}
                      </div>
                      <ListTools
                        label={`paragraph ${i + 1}`}
                        onUp={() => set('description', move(form.description, i, -1))}
                        onDown={() => set('description', move(form.description, i, 1))}
                        onRemove={() => set('description', form.description.filter((__, j) => j !== i))}
                      />
                    </div>
                  ))}
                  <button type="button" className={e.add} onClick={() => set('description', [...form.description, bi()])}>
                    + Add paragraph
                  </button>
                </div>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Cover picture</legend>
                {form.image?.src && (
                  <div className={styles.imagePreview}>
                    <img src={form.image.src} alt="" />
                    <button type="button" className={styles.danger} onClick={() => set('image', null)}>
                      Remove picture
                    </button>
                  </div>
                )}
                <div className={styles.field}>
                  <label htmlFor={fid('imageFile')}>{form.image?.src ? 'Replace picture' : 'Add a picture or poster'}</label>
                  <input id={fid('imageFile')} type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage} disabled={status.uploading} />
                  <p className={styles.hint}>{status.uploading ? 'Uploading…' : 'JPEG, PNG or WebP. Shown on the event page and card, and in WhatsApp link previews.'}</p>
                  {err('image.src')}
                </div>
                {form.image?.src && (
                  <div className={styles.field}>
                    <label htmlFor={fid('image.alt')}>Describe the picture</label>
                    <input {...bind('image.alt')} maxLength={300} placeholder="For people using screen readers" />
                  </div>
                )}
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Highlights (optional)</legend>
                {form.highlights.map((h, i) => (
                  <div key={i} className={e.repeat}>
                    <div className={e.iconPick} role="group" aria-label={`Icon for highlight ${i + 1}`}>
                      {ICONS.map((name) => (
                        <button key={name} type="button" title={name} aria-pressed={h.icon === name} className={h.icon === name ? e.iconOn : ''} onClick={() => set(`highlights.${i}.icon`, name)}>
                          <Icon name={name} size={20} />
                        </button>
                      ))}
                    </div>
                    <Bi path={`highlights.${i}.title`} label="Title" max={80} />
                    <Bi path={`highlights.${i}.text`} label="Text" textarea rows={2} max={30} />
                    {err(`highlights.${i}.title`)}
                    <ListTools
                      label={`highlight ${i + 1}`}
                      onUp={() => set('highlights', move(form.highlights, i, -1))}
                      onDown={() => set('highlights', move(form.highlights, i, 1))}
                      onRemove={() => set('highlights', form.highlights.filter((__, j) => j !== i))}
                    />
                  </div>
                ))}
                <button type="button" className={e.add} onClick={() => set('highlights', [...form.highlights, { icon: 'lotus', title: bi(), text: bi() }])}>
                  + Add highlight
                </button>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Schedule (optional)</legend>
                <p className={styles.hint}>Day by day, e.g. Maha Shashthi → Bodhon 7:00 AM.</p>
                {form.schedule.map((d, i) => (
                  <div key={i} className={`${e.repeat} ${e.day}`}>
                    <div className={styles.row2}>
                      <Bi path={`schedule.${i}.day`} label={`Day ${i + 1}`} max={60} />
                      <div className={styles.field}>
                        <label htmlFor={fid(`schedule.${i}.date`)}>Date</label>
                        <input type="date" {...bind(`schedule.${i}.date`)} />
                        {err(`schedule.${i}.date`)}
                      </div>
                    </div>
                    {err(`schedule.${i}.day`)}
                    <Bi path={`schedule.${i}.note`} label="Note" hint="Optional, one line under the day." max={300} />
                    <label className={styles.check}>
                      <input type="checkbox" checked={d.main} onChange={(ev) => set(`schedule.${i}.main`, ev.target.checked)} /> Main day (highlighted)
                    </label>
                    <div className={e.items}>
                      {d.items.map((it, j) => (
                        <div key={j} className={e.item}>
                          <input {...bind(`schedule.${i}.items.${j}.time`)} placeholder="7:00 AM" aria-label="Time" className={e.time} maxLength={20} />
                          <input {...bind(`schedule.${i}.items.${j}.title.en`)} placeholder="What happens (English)" aria-label="Item (English)" maxLength={140} />
                          <input {...bind(`schedule.${i}.items.${j}.title.bn`)} placeholder="বাংলায়" lang="bn" aria-label="Item (Bengali)" maxLength={140} />
                          <button type="button" className={e.remove} aria-label="Remove item" onClick={() => set(`schedule.${i}.items`, d.items.filter((__, k) => k !== j))}>
                            ✕
                          </button>
                          {errors[`schedule.${i}.items.${j}`] && <p className={styles.fieldError}>{errors[`schedule.${i}.items.${j}`]}</p>}
                        </div>
                      ))}
                      <button type="button" className={e.add} onClick={() => set(`schedule.${i}.items`, [...d.items, { time: '', title: bi() }])}>
                        + Add item
                      </button>
                    </div>
                    <ListTools
                      label={`day ${i + 1}`}
                      onUp={() => set('schedule', move(form.schedule, i, -1))}
                      onDown={() => set('schedule', move(form.schedule, i, 1))}
                      onRemove={() => window.confirm('Remove this day and its items?') && set('schedule', form.schedule.filter((__, j) => j !== i))}
                    />
                  </div>
                ))}
                <button type="button" className={e.add} onClick={() => set('schedule', [...form.schedule, { date: '', day: bi(), note: bi(), main: false, items: [{ time: '', title: bi() }] }])}>
                  + Add day
                </button>
                {form.schedule.length > 0 && <Bi path="scheduleNote" label="Note under the schedule" hint="Optional, e.g. “Timings follow the panjika.”" max={300} />}
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Publishing</legend>
                <label className={styles.check}>
                  <input type="checkbox" checked={form.featured} onChange={(ev) => set('featured', ev.target.checked)} /> Feature this event (bigger card on the Events page)
                </label>
                <div className={styles.field}>
                  <label htmlFor={fid('publishedAt')}>Publish at</label>
                  <input type="datetime-local" {...bind('publishedAt')} />
                  <p className={styles.hint}>Leave empty to publish straight away. A future time schedules it.</p>
                  {err('publishedAt')}
                </div>
              </fieldset>

              {status.message && (
                <p className={styles.formError} role="alert">
                  {status.message}
                </p>
              )}
              {status.ok && (
                <p className={styles.notice} role="status">
                  {status.ok}
                </p>
              )}
              <div className={`${styles.formActions} ${e.actions}`}>
                {published ? (
                  <>
                    <Button type="submit" disabled={status.busy}>
                      {status.busy ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button variant="secondary" onClick={() => save('draft')} disabled={status.busy}>
                      Unpublish
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => save('published')} disabled={status.busy}>
                      {status.busy ? 'Saving…' : form.publishedAt && new Date(form.publishedAt) > new Date() ? 'Schedule' : 'Publish'}
                    </Button>
                    <Button variant="secondary" onClick={() => save('draft')} disabled={status.busy}>
                      Save draft
                    </Button>
                  </>
                )}
                {live && (
                  <Button variant="secondary" href={`/events/${saved.slug}`}>
                    View on site ↗
                  </Button>
                )}
              </div>
              {saved && (
                <div className={e.coupons}>
                  <Icon name="people" size={22} />
                  <p>
                    Want people to register or get entry / food coupons for this event?{' '}
                    <Link to={couponsLink}>Set up registration &amp; coupons →</Link>
                  </p>
                </div>
              )}
            </form>

            <aside className={styles.preview} aria-label="Preview">
              <p className={styles.previewLabel}>Event card preview</p>
              <EventCard event={previewOf(form)} featured={form.featured} headingLevel="p" />
            </aside>
          </div>
          </FormKit.Provider>
        </div>
      </section>
    </>
  );
}
