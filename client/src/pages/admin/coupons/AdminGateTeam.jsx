import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { copyText, formatWhen, whatsappUrl } from '../../../components/coupons/couponUtils.js';
import Icon from '../../../components/motifs/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import Seo from '../../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { adminCouponsApi } from '../../../services/api.js';
import { AdminBar } from '../AdminAnnouncements.jsx';
import { useAdminSession } from '../adminSession.js';
import styles from '../Admin.module.css';
import { CouponsDisabled } from './AdminCouponEvents.jsx';
import { Field } from './formKit.jsx';
import c from './Coupons.module.css';
import g from './GateTeam.module.css';

const usernameFrom = (name) =>
  String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30);
const randomPin = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), (n) => n % 10).join('');
const scannerUrl = () => `${window.location.origin}/scan`;

/** Shown once after creating a volunteer or resetting a PIN — the PIN can't be looked up later. */
function PinReveal({ user, pin, onClose }) {
  const [copied, setCopied] = useState(false);
  const message = `Nomoshkar ${user.name.split(' ')[0]}! 🎟️ You're on the Parbon gate team.\n\nOpen: ${scannerUrl()}\nUsername: ${user.username}\nPIN: ${pin}\n\nPlease keep the PIN to yourself.`;
  return (
    <div className={g.reveal} role="status">
      <div className={g.revealHead}>
        <Icon name="check" size={26} strokeWidth={2} />
        <p>
          <strong>{user.name}</strong> can now scan at the gate. Share these details — the PIN won’t be shown again.
        </p>
      </div>
      <dl className={g.creds}>
        <div>
          <dt>Scanner</dt>
          <dd>{scannerUrl()}</dd>
        </div>
        <div>
          <dt>Username</dt>
          <dd className={g.mono}>{user.username}</dd>
        </div>
        <div>
          <dt>PIN</dt>
          <dd className={`${g.mono} ${g.pin}`}>{pin}</dd>
        </div>
      </dl>
      <div className={c.couponActions}>
        <a className={c.iconAction} href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer">
          <Icon name="whatsapp" size={16} /> Send on WhatsApp
        </a>
        <button
          type="button"
          className={c.iconAction}
          onClick={async () => {
            setCopied(await copyText(message));
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copied' : 'Copy details'}
        </button>
        <button type="button" className={styles.linkBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

function VolunteerForm({ initial, events, onSave, onCancel }) {
  const uid = useId();
  const editing = Boolean(initial);
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    username: initial?.username || '',
    pin: '',
    canMarkPaid: Boolean(initial?.canMarkPaid),
    canUndo: Boolean(initial?.canUndo),
    active: initial?.active !== false,
    eventIds: initial?.eventIds || [],
    limit: Boolean(initial?.eventIds?.length),
  }));
  const [usernameTouched, setUsernameTouched] = useState(editing);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, message: '' });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.limit && !form.eventIds.length) {
      setErrors({ eventIds: 'Pick at least one event, or choose “All events”.' });
      return;
    }
    setState({ busy: true, message: '' });
    try {
      await onSave({
        name: form.name,
        username: form.username,
        canMarkPaid: form.canMarkPaid,
        canUndo: form.canUndo,
        active: form.active,
        eventIds: form.limit ? form.eventIds : [],
        ...(editing ? {} : { pin: form.pin }),
      });
    } catch (err) {
      setErrors(err.fields || {});
      setState({ busy: false, message: err.message });
    }
  };

  return (
    <form className={`${styles.group} ${styles.form}`} onSubmit={submit} noValidate>
      <h3 className={c.h3}>{editing ? `Edit ${initial.name}` : 'Add a gate volunteer'}</h3>
      <div className={styles.row2}>
        <Field label="Name" id={`${uid}-name`} error={errors.name} required>
          <input
            id={`${uid}-name`}
            value={form.name}
            maxLength={100}
            autoComplete="off"
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({ ...f, name, username: usernameTouched ? f.username : usernameFrom(name) }));
            }}
          />
        </Field>
        <Field label="Username" id={`${uid}-username`} error={errors.username} hint="What they type to sign in, e.g. rahul." required>
          <input
            id={`${uid}-username`}
            value={form.username}
            maxLength={30}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => {
              setUsernameTouched(true);
              set('username', e.target.value.toLowerCase());
            }}
          />
        </Field>
        {!editing && (
          <Field label="PIN" id={`${uid}-pin`} error={errors.pin} hint="4–6 digits (6 is safest). Leave empty and we’ll make up a 6-digit one.">
            <div className={g.pinRow}>
              <input
                id={`${uid}-pin`}
                value={form.pin}
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                placeholder="e.g. 4821"
                onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))}
              />
              <button type="button" className={c.iconAction} onClick={() => set('pin', randomPin())}>
                Generate
              </button>
            </div>
          </Field>
        )}
      </div>

      <fieldset className={g.perms}>
        <legend>At the gate they can</legend>
        <label className={styles.check}>
          <input type="checkbox" checked disabled /> Scan coupons and let people in <span className={g.always}>always</span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={form.canMarkPaid} onChange={(e) => set('canMarkPaid', e.target.checked)} /> Take payments (mark “Paid” at the counter)
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={form.canUndo} onChange={(e) => set('canUndo', e.target.checked)} /> Undo a check-in made by mistake
        </label>
      </fieldset>

      <fieldset className={g.perms}>
        <legend>Events</legend>
        <label className={styles.check}>
          <input type="radio" name={`${uid}-limit`} checked={!form.limit} onChange={() => set('limit', false)} /> All events
        </label>
        <label className={styles.check}>
          <input type="radio" name={`${uid}-limit`} checked={form.limit} onChange={() => set('limit', true)} /> Only these events
        </label>
        {form.limit && (
          <div className={g.eventList}>
            {events.map((e) => (
              <label key={e.id} className={styles.check}>
                <input
                  type="checkbox"
                  checked={form.eventIds.includes(e.id)}
                  onChange={(ev) => set('eventIds', ev.target.checked ? [...form.eventIds, e.id] : form.eventIds.filter((id) => id !== e.id))}
                />
                {e.title.en}
              </label>
            ))}
            {!events.length && <p className={styles.hint}>No events yet.</p>}
          </div>
        )}
        {errors.eventIds && <p className={styles.fieldError}>{errors.eventIds}</p>}
      </fieldset>

      {editing && (
        <label className={styles.check}>
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Account is on (untick to stop them signing in)
        </label>
      )}

      {state.message && <p className={styles.formError}>{state.message}</p>}
      <div className={styles.formActions}>
        <Button type="submit" disabled={state.busy}>
          {state.busy ? 'Saving…' : editing ? 'Save' : 'Add volunteer'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function AdminGateTeam() {
  const session = useAdminSession({ require: true });
  const [status, setStatus] = useState(null);
  const [users, setUsers] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null); // null | 'add' | user id being edited
  const [reveal, setReveal] = useState(null);

  const load = () => adminCouponsApi.gateUsers().then(setUsers, setError);

  useEffect(() => {
    if (session.status !== 'authed') return;
    adminCouponsApi.status().then((s) => {
      setStatus(s);
      if (!s.enabled) return;
      adminCouponsApi.gateUsers().then(setUsers, setError);
      adminCouponsApi.events().then(setEvents, () => {});
    }, setError);
  }, [session.status]);

  if (session.status !== 'authed') {
    return (
      <div className="container section">
        <LoadingState />
      </div>
    );
  }

  const eventName = (id) => events.find((e) => e.id === id)?.title.en || 'an event';
  const act = async (fn) => {
    try {
      await fn();
      await load();
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <>
      <Seo title="Gate team" noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <p className={c.crumb}>
            <Link to="/admin/coupons">← Coupons</Link>
          </p>
          <div className={styles.head}>
            <h1 id="page-title" className={styles.h1}>
              <span lang="bn">প্রবেশদ্বার</span> Gate team
            </h1>
            {status?.enabled && !mode && (
              <Button onClick={() => { setReveal(null); setMode('add'); }} arrow>
                Add volunteer
              </Button>
            )}
          </div>
          <p className={`muted ${g.intro}`}>
            Volunteers open <strong>{window.location.host}/scan</strong> on their phone and sign in with a username and PIN. They can only scan coupons at
            the gate — they can’t see the admin area. Website admins can always scan too.
          </p>

          {error && <ErrorState error={error} />}
          {status && !status.enabled && <CouponsDisabled />}
          {reveal && <PinReveal user={reveal.user} pin={reveal.pin} onClose={() => setReveal(null)} />}

          {mode === 'add' && (
            <VolunteerForm
              events={events}
              onCancel={() => setMode(null)}
              onSave={async (data) => {
                const res = await adminCouponsApi.createGateUser(data);
                setMode(null);
                setReveal(res);
                await load();
              }}
            />
          )}

          {status?.enabled && !users && !error && <LoadingState lines={3} />}
          {users?.length === 0 && mode !== 'add' && (
            <div className={c.empty}>
              <p>No gate volunteers yet.</p>
              <p className="muted">Add the people who will check coupons at the entrance and the bhog counter.</p>
            </div>
          )}

          {users?.length > 0 && (
            <ul className={styles.list} role="list">
              {users.map((u) =>
                mode === u.id ? (
                  <li key={u.id}>
                    <VolunteerForm
                      initial={u}
                      events={events}
                      onCancel={() => setMode(null)}
                      onSave={async (data) => {
                        await adminCouponsApi.updateGateUser(u.id, data);
                        setMode(null);
                        await load();
                      }}
                    />
                  </li>
                ) : (
                  <li key={u.id} className={`${styles.row} ${u.active ? '' : g.inactive}`}>
                    <span className={styles.thumb} aria-hidden="true">
                      <Icon name="people" size={26} />
                    </span>
                    <div className={styles.rowMain}>
                      <p className={styles.rowTitle}>
                        {u.name} <span className={g.username}>@{u.username}</span>
                      </p>
                      <p className={styles.rowMeta}>
                        <span className={`${styles.badge} ${u.active ? '' : styles.badgeDraft}`}>{u.active ? 'Active' : 'Off'}</span>
                        {u.locked && <span className={`${styles.badge} ${g.locked}`}>Locked — too many wrong PINs</span>}
                        {u.canMarkPaid && <span className={`${styles.badge} ${styles.badgeDraft}`}>Takes payments</span>}
                        {u.canUndo && <span className={`${styles.badge} ${styles.badgeDraft}`}>Can undo</span>}
                        <span>{u.eventIds.length ? u.eventIds.map(eventName).join(', ') : 'All events'}</span>
                      </p>
                      <p className={styles.rowMeta}>
                        <span>{u.checkIns} checked in</span>
                        <span>Last sign-in: {u.lastLoginAt ? formatWhen(u.lastLoginAt) : 'never'}</span>
                      </p>
                    </div>
                    <div className={styles.rowActions}>
                      <button type="button" className={styles.linkBtn} onClick={() => { setReveal(null); setMode(u.id); }}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() =>
                          window.confirm(`Give ${u.name} a new PIN? Their current PIN stops working and they’re signed out.`) &&
                          act(async () => setReveal(await adminCouponsApi.resetGatePin(u.id)))
                        }
                      >
                        Reset PIN
                      </button>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => act(() => adminCouponsApi.updateGateUser(u.id, { ...u, active: !u.active }))}
                      >
                        {u.active ? 'Turn off' : 'Turn on'}
                      </button>
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => window.confirm(`Remove ${u.name} from the gate team?`) && act(() => adminCouponsApi.deleteGateUser(u.id))}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
