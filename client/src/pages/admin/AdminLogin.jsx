import { useState } from 'react';
import { Navigate } from 'react-router';
import Button from '../../components/ui/Button.jsx';
import Logo from '../../components/ui/Logo.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { LoadingState } from '../../components/ui/States.jsx';
import { adminApi } from '../../services/api.js';
import { useAdminSession } from './adminSession.js';
import styles from './Admin.module.css';

export default function AdminLogin() {
  const session = useAdminSession();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session.status === 'loading') {
    return (
      <div className="container section">
        <LoadingState />
      </div>
    );
  }
  if (session.status === 'authed') return <Navigate to="/admin/announcements" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminApi.login(form.username, form.password);
      await session.refresh();
    } catch (err) {
      setError(err.message || 'Could not sign in.');
      setForm((f) => ({ ...f, password: '' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`section ${styles.loginWrap}`} aria-labelledby="page-title">
      <Seo title="Admin sign in" noindex />
      <form className={styles.loginCard} onSubmit={onSubmit}>
        <Logo width={72} alt="" className={styles.loginLogo} />
        <h1 id="page-title" className={styles.loginTitle}>
          <span lang="bn">সমিতির দপ্তর</span>
          <span>Committee sign in</span>
        </h1>
        <div className={styles.field}>
          <label htmlFor="admin-user">Username</label>
          <input
            id="admin-user"
            autoComplete="username"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-pass">Password</label>
          <input
            id="admin-pass"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </section>
  );
}
