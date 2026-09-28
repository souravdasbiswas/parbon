import { useEffect, useMemo, useState } from 'react';
import Icon from '../../components/motifs/Icon.jsx';
import Button from '../../components/ui/Button.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { adminApi } from '../../services/api.js';
import { AdminBar } from './AdminAnnouncements.jsx';
import { useAdminSession } from './adminSession.js';
import styles from './Admin.module.css';

const TYPES = [
  { value: 'volunteer', label: 'Volunteering' },
  { value: 'membership', label: 'Membership' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'performance', label: 'Performance' },
  { value: 'general', label: 'General' },
];

const COLUMNS = [
  { key: 'createdAt', label: 'Received', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'phone', label: 'Phone', sortable: true },
  { key: 'message', label: 'Message' },
  { key: 'id', label: 'Ref ID' },
  { key: 'ip', label: 'IP address', sortable: true },
  { key: 'userAgent', label: 'Browser' },
];

const PAGE_SIZES = [25, 50, 100];

const istFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : istFormat.format(d);
};

/** "Chrome · Android" from a user-agent string; the full string is shown on hover. */
function browserSummary(ua) {
  if (!ua) return '';
  const browser =
    [
      [/Edg\//, 'Edge'],
      [/OPR\/|Opera/, 'Opera'],
      [/SamsungBrowser/, 'Samsung Internet'],
      [/Chrome\/|CriOS/, 'Chrome'],
      [/Firefox\/|FxiOS/, 'Firefox'],
      [/Safari\//, 'Safari'],
    ].find(([re]) => re.test(ua))?.[1] || 'Other';
  const os =
    [
      [/Android/, 'Android'],
      [/iPhone|iPad|iPod/, 'iOS'],
      [/Windows/, 'Windows'],
      [/Mac OS X|Macintosh/, 'macOS'],
      [/Linux/, 'Linux'],
    ].find(([re]) => re.test(ua))?.[1] || '';
  return os ? `${browser} · ${os}` : browser;
}

const whatsappDigits = (phone) => phone.replace(/\D/g, '');

function SortHeader({ column, sort, dir, onSort }) {
  if (!column.sortable) return <th scope="col">{column.label}</th>;
  const active = sort === column.key;
  return (
    <th scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={styles.sortBtn} onClick={() => onSort(column.key)}>
        {column.label}
        <span aria-hidden="true" className={active ? styles.sortActive : styles.sortIdle}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}

export default function AdminResponses() {
  const session = useAdminSession({ require: true });
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [dir, setDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [result, setResult] = useState(null); // { key, data } | { key, error }
  const [expanded, setExpanded] = useState(() => new Set());
  const [copied, setCopied] = useState('');

  const params = useMemo(() => {
    const p = { sort, dir };
    if (type) p.type = type;
    if (q) p.q = q;
    return p;
  }, [type, q, sort, dir]);
  const key = JSON.stringify(params);

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (session.status !== 'authed') return;
    const controller = new AbortController();
    adminApi.responses(params, { signal: controller.signal }).then(
      (data) => setResult({ key, data }),
      (error) => error.name !== 'AbortError' && setResult({ key, error }),
    );
    return () => controller.abort();
  }, [session.status, params, key]);

  if (session.status !== 'authed') {
    return (
      <div className="container section">
        <LoadingState />
      </div>
    );
  }

  const data = result?.data;
  const loading = result?.key !== key;
  const items = data?.items || [];
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const visible = items.slice(start, start + pageSize);

  const onSort = (column) => {
    if (column === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(column);
      setDir(column === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(1);
  };
  const chooseType = (value) => {
    setType(value);
    setPage(1);
  };
  const toggle = (id) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const copy = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? '' : c)), 1500);
    } catch {
      window.prompt('Copy the reference ID:', id);
    }
  };

  const chips = [{ value: '', label: 'All', count: data?.counts.all }, ...TYPES.map((t) => ({ ...t, count: data?.counts[t.value] }))];

  return (
    <>
      <Seo title="Form responses" noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <div className={styles.head}>
            <div>
              <h1 id="page-title" className={styles.h1}>
                <span lang="bn">সাড়া</span> Responses
              </h1>
              {data && (
                <p className={styles.summary}>
                  {data.total} {data.total === 1 ? 'response' : 'responses'}
                  {data.lastReceivedAt && <> · last received {when(data.lastReceivedAt)}</>}
                </p>
              )}
            </div>
            <Button href={adminApi.responsesCsvUrl(params)} variant="secondary" download>
              ⤓ Export CSV{items.length ? ` (${items.length})` : ''}
            </Button>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.chips} role="group" aria-label="Filter by type">
              {chips.map((c) => (
                <button
                  key={c.value || 'all'}
                  type="button"
                  className={`${styles.chip} ${type === c.value ? styles.chipActive : ''}`}
                  aria-pressed={type === c.value}
                  onClick={() => chooseType(c.value)}
                >
                  {c.label}
                  {c.count != null && <span className={styles.chipCount}>{c.count}</span>}
                </button>
              ))}
            </div>
            <div className={styles.toolbarRow}>
              <label className={styles.search}>
                <span className="visually-hidden">Search responses</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, phone or message…"
                  maxLength={200}
                />
              </label>
              <label className={styles.pageSize}>
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {data?.skipped > 0 && (
            <p className={styles.notice} role="note">
              {data.skipped} damaged {data.skipped === 1 ? 'line was' : 'lines were'} skipped in the responses file.
            </p>
          )}

          {result?.error && <ErrorState error={result.error} />}
          {!data && !result?.error && <LoadingState lines={5} />}

          {data && items.length === 0 && (
            <p className="muted">{data.total === 0 ? 'No responses yet.' : 'No responses match these filters.'}</p>
          )}

          {items.length > 0 && (
            <>
              <div className={`${styles.tableWrap} ${loading ? styles.tableLoading : ''}`} aria-busy={loading}>
                <table className={styles.table}>
                  <caption className="visually-hidden">
                    Form responses, sorted by {COLUMNS.find((c) => c.key === sort)?.label} ({dir === 'asc' ? 'ascending' : 'descending'})
                  </caption>
                  <thead>
                    <tr>
                      {COLUMNS.map((c) => (
                        <SortHeader key={c.key} column={c} sort={sort} dir={dir} onSort={onSort} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => {
                      const open = expanded.has(r.id);
                      const long = r.message.length > 120 || r.message.includes('\n');
                      return (
                        <tr key={r.id}>
                          <td className={styles.nowrap}>
                            <time dateTime={r.createdAt}>{when(r.createdAt)}</time>
                          </td>
                          <td>
                            <span className={`${styles.typeBadge} ${styles[`type_${r.type}`] || ''}`}>{r.typeLabel}</span>
                          </td>
                          <td className={styles.strong}>{r.name}</td>
                          <td>{r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : '—'}</td>
                          <td className={styles.nowrap}>
                            {r.phone ? (
                              <>
                                <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a>
                                <a
                                  href={`https://wa.me/${whatsappDigits(r.phone)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.wa}
                                  aria-label={`WhatsApp ${r.name}`}
                                  title="WhatsApp"
                                >
                                  <Icon name="whatsapp" size={16} />
                                </a>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className={styles.messageCell}>
                            <p className={open ? styles.messageOpen : styles.message}>{r.message}</p>
                            {long && (
                              <button type="button" className={styles.linkBtn} onClick={() => toggle(r.id)} aria-expanded={open}>
                                {open ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </td>
                          <td className={styles.nowrap}>
                            <code title={r.id}>{r.id.slice(0, 8)}</code>
                            <button type="button" className={styles.iconBtn} onClick={() => copy(r.id)} aria-label={`Copy reference ID ${r.id}`}>
                              <Icon name={copied === r.id ? 'check' : 'copy'} size={15} />
                            </button>
                          </td>
                          <td className={styles.nowrap}>{r.ip || '—'}</td>
                          <td className={styles.nowrap} title={r.userAgent}>
                            {browserSummary(r.userAgent) || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <nav className={styles.pager} aria-label="Pages">
                <p>
                  Showing {start + 1}–{Math.min(start + pageSize, items.length)} of {items.length}
                </p>
                <div className={styles.pagerBtns}>
                  <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1}>
                    ‹ Prev
                  </button>
                  <span aria-current="page">
                    Page {current} of {pages}
                  </span>
                  <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages}>
                    Next ›
                  </button>
                </div>
              </nav>
            </>
          )}
        </div>
      </section>
    </>
  );
}
