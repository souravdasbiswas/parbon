import { useId, useState } from 'react';
import { Link } from 'react-router';
import CouponArt from '../../../components/coupons/CouponArt.jsx';
import { rupees } from '../../../components/coupons/couponUtils.js';
import { sampleFieldData } from '../../../components/coupons/designSpec.js';
import { designOrTemplate, templateFor } from '../../../components/coupons/templates.js';
import Button from '../../../components/ui/Button.jsx';
import { adminCouponsApi } from '../../../services/api.js';
import styles from '../Admin.module.css';
import { Field } from './formKit.jsx';
import { makeBinder } from './formUtils.js';
import c from './Coupons.module.css';

const KINDS = { entry: 'Entry pass', food: 'Food / bhog coupon', other: 'Other' };
const EMPTY = { name: { en: '', bn: '' }, description: { en: '', bn: '' }, kind: 'entry', price: 0, quota: '', maxPerRegistration: 10, active: true, sortOrder: 0 };

function TypeForm({ initial, onSubmit, onCancel, submitLabel }) {
  const uid = useId();
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial, name: { ...EMPTY.name, ...initial?.name }, description: { ...EMPTY.description, ...initial?.description }, quota: initial?.quota ?? '' }));
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, message: '' });
  const bind = makeBinder(form, setForm, errors, uid);

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, message: '' });
    try {
      const { id: _id, eventId: _eventId, stats: _stats, design: _design, ...rest } = form;
      await onSubmit({
        ...rest,
        price: Number(form.price) || 0,
        quota: form.quota === '' ? null : Number(form.quota),
        maxPerRegistration: Number(form.maxPerRegistration) || 10,
        sortOrder: Number(form.sortOrder) || 0,
      });
      setErrors({});
      setState({ busy: false, message: '' });
    } catch (err) {
      setErrors(err.fields || {});
      setState({ busy: false, message: err.message });
    }
  };

  return (
    <form className={`${styles.form} ${c.typeForm}`} onSubmit={submit} noValidate>
      <div className={styles.row2}>
        <Field label="Name (English)" id={bind('name.en').id} error={errors['name.en']} required>
          <input {...bind('name.en')} maxLength={80} placeholder="Entry pass" required />
        </Field>
        <Field label="Name (Bengali)" id={bind('name.bn').id}>
          <input {...bind('name.bn')} maxLength={80} lang="bn" placeholder="প্রবেশপত্র" />
        </Field>
        <Field label="Kind" id={bind('kind').id} hint="Entry passes decide who counts as “in” on the attendee list.">
          <select {...bind('kind')}>
            {Object.entries(KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price per coupon (₹)" id={bind('price').id} error={errors.price} hint="0 for free.">
          <input type="number" min="0" inputMode="numeric" {...bind('price')} />
        </Field>
        <Field label="How many of this type" id={bind('quota').id} error={errors.quota} hint="Leave empty to share the event’s total.">
          <input type="number" min="1" inputMode="numeric" {...bind('quota')} placeholder="No separate limit" />
        </Field>
        <Field label="Most per registration" id={bind('maxPerRegistration').id} error={errors.maxPerRegistration}>
          <input type="number" min="1" max="100" inputMode="numeric" {...bind('maxPerRegistration')} />
        </Field>
      </div>
      <Field label="Short description" id={bind('description.en').id} hint="Optional, shown on the registration form — e.g. “Includes Ashtami bhog”.">
        <input {...bind('description.en')} maxLength={300} />
      </Field>
      <div className={c.inlineRow}>
        <label className={styles.check}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Available for registration
        </label>
        <label className={c.orderField}>
          Order <input type="number" min="0" max="1000" {...bind('sortOrder')} />
        </label>
      </div>
      {state.message && <p className={styles.formError}>{state.message}</p>}
      <div className={styles.formActions}>
        <Button type="submit" disabled={state.busy}>
          {state.busy ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default function CouponTypesPanel({ event, onChange }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(event.types.length === 0);

  const create = async (data) => {
    // New types start from the ready-made design for their kind.
    await adminCouponsApi.createType(event.id, { ...data, design: templateFor(data.kind) });
    setAdding(false);
    onChange();
  };
  const update = (type) => async (data) => {
    await adminCouponsApi.updateType(type.id, data);
    setEditing(null);
    onChange();
  };
  const remove = async (type) => {
    if (!window.confirm(`Delete “${type.name.en}”?`)) return;
    try {
      await adminCouponsApi.deleteType(type.id);
      onChange();
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <div className={c.panel}>
      <p className="muted">
        Each person picks how many of each coupon they want. One coupon is issued per type, e.g. <em>Entry pass ×4</em> with one QR code that lets 4
        people in.
      </p>
      <ul className={c.typeGrid} role="list">
        {event.types.map((type) => (
          <li key={type.id} className={`${c.typeCard} ${type.active ? '' : c.inactive}`}>
            <div className={c.preview} style={{ width: designOrTemplate(type).height > designOrTemplate(type).width ? '58%' : '100%' }}>
              <CouponArt design={designOrTemplate(type)} data={sampleFieldData(event, type)} label={`${type.name.en} coupon preview`} />
            </div>
            {editing === type.id ? (
              <TypeForm initial={type} onSubmit={update(type)} onCancel={() => setEditing(null)} submitLabel="Save" />
            ) : (
              <div className={c.typeInfo}>
                <p className={c.typeName}>
                  {type.name.en} {type.name.bn && <span lang="bn">· {type.name.bn}</span>}
                </p>
                <p className={styles.rowMeta}>
                  <span className={styles.badge}>{KINDS[type.kind]}</span>
                  {!type.active && <span className={`${styles.badge} ${styles.badgeDraft}`}>Hidden</span>}
                  <span>{type.price ? rupees(type.price) : 'Free'}</span>
                  <span>
                    {type.stats.issued} issued{type.quota ? ` of ${type.quota}` : ''} · {type.stats.checkedIn} used
                  </span>
                </p>
                <div className={c.typeActions}>
                  <Button to={`/admin/coupons/${event.id}/types/${type.id}/design`} size="sm" arrow>
                    Design coupon
                  </Button>
                  <button type="button" className={styles.linkBtn} onClick={() => setEditing(type.id)}>
                    Edit details
                  </button>
                  <button type="button" className={styles.danger} onClick={() => remove(type)}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <div className={styles.group}>
          <h3 className={c.h3}>Add a coupon type</h3>
          <TypeForm onSubmit={create} onCancel={event.types.length ? () => setAdding(false) : null} submitLabel="Add coupon type" />
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + Add coupon type
        </Button>
      )}
      {event.types.length > 0 && (
        <p className={styles.hint}>
          Tip: open the <Link to={`/register/${event.slug}`}>registration page</Link> to see what people will see.
        </p>
      )}
    </div>
  );
}
