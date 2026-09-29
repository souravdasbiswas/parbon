/** Nested get/set on plain objects by "a.b" paths, for simple controlled forms. */
export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

export function setPath(obj, path, value) {
  const [head, ...rest] = path.split('.');
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath(obj?.[head] || {}, rest.join('.'), value) };
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
