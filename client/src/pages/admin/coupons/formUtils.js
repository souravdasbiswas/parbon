/** Nested get/set on plain objects by "a.b" paths, for simple controlled forms. */
export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Immutable set by path; numeric segments update arrays in place (e.g. "schedule.0.items.2.time"). */
export function setPath(obj, path, value) {
  const [head, ...rest] = path.split('.');
  const next = rest.length ? setPath(obj?.[head] ?? (/^\d+$/.test(rest[0]) ? [] : {}), rest.join('.'), value) : value;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[Number(head)] = next;
    return copy;
  }
  return { ...obj, [head]: next };
}

/** Returns a binder: bind('title.en') → props for an input tied to `form` at that path. */
export function makeBinder(form, setForm, errors, idPrefix) {
  return (path, extra = {}) => {
    const id = `${idPrefix}-${path.replace(/\./g, '-')}`;
    const value = getPath(form, path);
    return {
      id,
      value: value ?? '',
      onChange: (e) => setForm((f) => setPath(f, path, e.target.value)),
      'aria-invalid': errors[path] ? 'true' : undefined,
      'aria-describedby': errors[path] ? `${id}-error` : undefined,
      ...extra,
    };
  };
}
