import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { PAYMENT_LABELS, rupees } from '../../components/coupons/couponUtils.js';
import Icon from '../../components/motifs/Icon.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { scanApi } from '../../services/api.js';
import styles from './Scanner.module.css';

const EVENT_KEY = 'parbon.scan.event';
const VERDICT = {
  ok: { tone: 'ok', title: 'Valid — let them in' },
  used: { tone: 'warn', title: 'Already used' },
  cancelled: { tone: 'bad', title: 'Cancelled' },
  replaced: { tone: 'bad', title: 'Old coupon' },
  wrong_event: { tone: 'bad', title: 'Wrong event' },
  expired: { tone: 'bad', title: 'Event over' },
};

let audio;
function feedback(good) {
  try {
    navigator.vibrate?.(good ? 80 : [120, 80, 120]);
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = good ? 880 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (good ? 0.12 : 0.35));
  } catch {
    // Sound and vibration are nice-to-haves.
  }
}

/** Camera QR reader: native BarcodeDetector where available (Android Chrome), jsQR elsewhere (iPhone). */
function useQrCamera(onRead) {
  const videoRef = useRef(null);
  const [state, setState] = useState({ on: false, error: '' });
  const stream = useRef(null);
  const paused = useRef(false);
  const readRef = useRef(onRead);
  useEffect(() => {
    readRef.current = onRead;
  }, [onRead]);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setState((s) => ({ ...s, on: false }));
  }, []);

  const start = useCallback(async () => {
    if (stream.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ on: false, error: 'This browser can’t use the camera here. Type the code below instead.' });
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      stream.current = media;
      const video = videoRef.current;
      video.srcObject = media;
      await video.play();
      setState({ on: true, error: '' });

      let detector = null;
      if ('BarcodeDetector' in window) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }
      const jsQR = detector ? null : (await import('jsqr')).default;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tick = async () => {
        if (!stream.current) return;
        if (!paused.current && video.readyState >= 2) {
          try {
            let text = '';
            if (detector) {
              const codes = await detector.detect(video);
              text = codes[0]?.rawValue || '';
            } else {
              const w = Math.min(640, video.videoWidth);
              const h = Math.round((video.videoHeight / video.videoWidth) * w);
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
              text = found?.data || '';
            }
            if (text) {
              paused.current = true;
              readRef.current(text);
            }
          } catch {
            // A bad frame — try the next one.
          }
        }
        setTimeout(tick, detector ? 120 : 180);
      };
      tick();
    } catch (error) {
      setState({
        on: false,
        error: error.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the browser settings, or type the code below.' : 'Could not start the camera. Type the code below instead.',
      });
    }
  }, []);

  useEffect(() => stop, [stop]);

  const resume = useCallback(() => {
    paused.current = false;
  }, []);
  const pause = useCallback(() => {
    paused.current = true;
  }, []);

  return { videoRef, cameraOn: state.on, cameraError: state.error, start, stop, resume, pause };
}

const USER_KEY = 'parbon.scan.username';

function Login({ onDone, note }) {
  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY) || '');
  const [pin, setPin] = useState('');
  const [state, setState] = useState({ busy: false, message: '' });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, message: '' });
    try {
      await scanApi.login(username.trim(), pin);
      localStorage.setItem(USER_KEY, username.trim().toLowerCase());
      onDone();
    } catch (err) {
      setPin('');
      setState({ busy: false, message: err.message });
    }
  };
  return (
    <form className={styles.login} onSubmit={submit}>
      <img src="/brand/logo-160.png" alt="" width="96" height="113" className={styles.logo} />
      <h1>
        <span lang="bn">প্রবেশদ্বার</span> Gate scanner
      </h1>
      {note && !state.message && <p className={styles.err}>{note}</p>}
      <label htmlFor="scan-user">Username</label>
      <input
        id="scan-user"
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase())}
        className={styles.userInput}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={!username}
      />
      <label htmlFor="scan-pin">PIN</label>
      <input
        id="scan-pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        className={styles.pin}
        autoFocus={Boolean(username)}
      />
      {state.message && (
        <p className={styles.err} role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={state.busy || pin.length < 4 || username.trim().length < 3}>
        {state.busy ? 'Checking…' : 'Start scanning'}
      </button>
      <p className={styles.muted}>
        Don’t have a username? Ask the committee admin to add you to the gate team.
        <br />
        Committee admin? <Link to="/admin">Sign in here</Link> and come back.
      </p>
    </form>
  );
}

export default function Scanner() {
  const [me, setMe] = useState(undefined);
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(() => localStorage.getItem(EVENT_KEY) || '');
  const [stats, setStats] = useState(null);
  const [result, setResult] = useState(null);
  const [admitted, setAdmitted] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [count, setCount] = useState(1);
  const [history, setHistory] = useState([]);
  const [note, setNote] = useState('');

  const checkSession = useCallback(() => {
    scanApi.me().then(setMe, () => setMe(null));
  }, []);
  useEffect(checkSession, [checkSession]);

  useEffect(() => {
    if (!me) return;
    scanApi.events().then((list) => {
      setEvents(list);
      if (list.length === 1) setEventId(list[0].id);
      else if (!list.some((e) => e.id === localStorage.getItem(EVENT_KEY))) setEventId('');
    }, (err) => setError(err.message));
  }, [me]);

  useEffect(() => {
    if (eventId) localStorage.setItem(EVENT_KEY, eventId);
  }, [eventId]);

  const refreshStats = useCallback(() => {
    if (eventId) scanApi.stats(eventId).then(setStats, () => {});
  }, [eventId]);
  useEffect(() => {
    refreshStats();
    const timer = setInterval(refreshStats, 20000);
    return () => clearInterval(timer);
  }, [refreshStats]);

  // A 401 mid-shift means the admin turned the account off or reset the PIN: back to sign-in.
  const fail = useCallback((err) => {
    if (err.status === 401) {
      setMe(null);
      setNote('You were signed out — your account was changed by the admin. Please sign in again.');
    } else setError(err.message);
  }, []);

  const lookup = useCallback(
    async (input) => {
      setBusy(true);
      setError('');
      setAdmitted(null);
      try {
        const found = await scanApi.lookup(eventId, input);
        setResult(found);
        setCount(1);
        feedback(found.verdict === 'ok');
      } catch (err) {
        setResult(null);
        fail(err);
        feedback(false);
      } finally {
        setBusy(false);
      }
    },
    [eventId, fail],
  );

  const { videoRef, cameraOn, cameraError, start: startCamera, stop: stopCamera, resume, pause } = useQrCamera(lookup);
  const event = events?.find((e) => e.id === eventId);

  useEffect(() => {
    if (event && me) startCamera();
    return stopCamera;
    // Start once per chosen event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, me]);

  const next = () => {
    setResult(null);
    setAdmitted(null);
    setError('');
    setCode('');
    resume();
  };

  const admit = async (n) => {
    setBusy(true);
    try {
      const updated = await scanApi.checkIn(eventId, result.coupon.id, n);
      setResult(updated);
      setAdmitted({ count: n, checkinId: updated.checkins[0]?.id });
      setHistory((h) => [{ at: new Date(), name: updated.registration.name, what: `${updated.coupon.type.name.en} ×${n}`, ok: true }, ...h].slice(0, 12));
      feedback(true);
      refreshStats();
    } catch (err) {
      fail(err);
      feedback(false);
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    setBusy(true);
    try {
      const updated = await scanApi.undo(eventId, admitted.checkinId);
      setResult(updated);
      setCount(1);
      setAdmitted(null);
      setHistory((h) => [{ at: new Date(), name: updated.registration.name, what: 'Undone', ok: false }, ...h].slice(0, 12));
      refreshStats();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    if (!window.confirm(`Collected ${rupees(result.registration.amountDue)} from ${result.registration.name}?`)) return;
    setBusy(true);
    try {
      setResult(await scanApi.markPaid(eventId, result.coupon.id));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    stopCamera();
    if (me?.role === 'gate') await scanApi.logout().catch(() => {});
    setNote('');
    setMe(null);
  };

  if (me === undefined) return <div className={styles.shell} aria-busy="true" />;

  if (!me) {
    return (
      <div className={styles.shell}>
        <Seo title="Gate scanner" noindex />
        <Login onDone={checkSession} note={note} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className={styles.shell}>
        <Seo title="Gate scanner" noindex />
        <div className={styles.picker}>
          <h1>Which event are you scanning?</h1>
          {error && <p className={styles.err}>{error}</p>}
          {events?.length === 0 && (
            <p className={styles.muted}>
              {me.role === 'gate' ? 'There are no running events you can scan for. Please ask the admin.' : 'No events are running right now.'}
            </p>
          )}
          {events?.map((e) => (
            <button key={e.id} type="button" className={styles.eventBtn} onClick={() => setEventId(e.id)}>
              <strong>{e.title.en}</strong>
              <span>{new Date(e.startsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}</span>
            </button>
          ))}
          <button type="button" className={styles.ghost} onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const v = result ? VERDICT[result.verdict] : null;
  const payDue = result && ['to_verify', 'pledged', 'rejected'].includes(result.registration.paymentStatus) && result.registration.amountDue > 0;
  const food = result?.coupon.type.kind === 'food';
  const verb = (n) => (food ? `Serve ${n}` : `Let ${n} in`);
  const title = admitted ? `${admitted.count} ${food ? 'served' : 'admitted'}` : result?.verdict === 'ok' && food ? 'Valid — serve them' : v?.title;
  // A check-in that just used up the coupon is still a success at the gate.
  const tone = admitted ? 'ok' : v?.tone;

  return (
    <div className={styles.shell}>
      <Seo title={`Scanner — ${event.title.en}`} noindex />
      <header className={styles.top}>
        <div>
          <p className={styles.eventName}>{event.title.en}</p>
          <p className={styles.stats}>
            {stats && (
              <>
                <strong>{stats.checkedIn}</strong> in · {stats.issued} issued ·{' '}
              </>
            )}
            {me.name}
          </p>
        </div>
        <div className={styles.topActions}>
          {events.length > 1 && (
            <button type="button" className={styles.ghost} onClick={() => setEventId('')}>
              Change
            </button>
          )}
          {me.role === 'admin' && (
            <Link to="/admin/coupons" className={styles.ghost}>
              Admin
            </Link>
          )}
          <button type="button" className={styles.ghost} onClick={signOut}>
            Exit
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.cameraBox} hidden={Boolean(result)}>
          <video ref={videoRef} className={styles.video} playsInline muted aria-label="Camera view" />
          {cameraOn && <div className={styles.frame} aria-hidden="true" />}
          {!cameraOn && (
            <div className={styles.cameraOff}>
              {cameraError ? <p>{cameraError}</p> : <p>Starting camera…</p>}
              <button type="button" className={styles.primary} onClick={startCamera}>
                Start camera
              </button>
            </div>
          )}
          {busy && <div className={styles.busy}>Checking…</div>}
        </div>

        {error && !result && (
          <div className={`${styles.result} ${styles.tone_bad}`} role="alert">
            <p className={styles.verdict}>
              <Icon name="close" size={28} strokeWidth={2.5} /> {error}
            </p>
            <button type="button" className={styles.primary} onClick={next}>
              Scan again
            </button>
          </div>
        )}

        {result && (
          <div className={`${styles.result} ${styles[`tone_${tone}`]}`} role="status">
            <p className={styles.verdict}>
              <Icon name={tone === 'ok' ? 'check' : 'close'} size={30} strokeWidth={2.5} /> {title}
            </p>
            {!admitted && result.verdict !== 'ok' && <p className={styles.reason}>{result.message}</p>}
            <div className={styles.who}>
              <p className={styles.name}>{result.registration.name}</p>
              <p>
                {result.coupon.type.name.en} ×{result.coupon.quantity} · <code>{result.coupon.code}</code>
              </p>
              <p className={styles.remaining}>
                {result.coupon.remaining > 0
                  ? `${result.coupon.remaining} of ${result.coupon.quantity} ${food ? 'still to serve' : 'can still enter'}`
                  : `All ${result.coupon.quantity} ${food ? 'used' : 'are in'}`}
              </p>
              <p className={`${styles.payBadge} ${payDue ? styles.payDue : ''}`}>
                {PAYMENT_LABELS[result.registration.paymentStatus]}
                {result.registration.amountDue > 0 && ` · ${rupees(result.registration.amountDue)}`}
                {result.registration.txnRef && ` · Txn ${result.registration.txnRef}`}
              </p>
            </div>

            {error && <p className={styles.err}>{error}</p>}

            {result.verdict === 'ok' && !admitted && (
              <div className={styles.admitBox}>
                {payDue && me.canMarkPaid && (
                  <button type="button" className={styles.payBtn} onClick={markPaid} disabled={busy}>
                    Collected {rupees(result.registration.amountDue)} — mark paid
                  </button>
                )}
                {payDue && !me.canMarkPaid && <p className={styles.reason}>Payment still due — please send them to the payment counter.</p>}
                <button type="button" className={styles.admitAll} onClick={() => admit(result.coupon.remaining)} disabled={busy}>
                  {verb(result.coupon.remaining)}
                </button>
                {result.coupon.remaining > 1 && (
                  <div className={styles.partial}>
                    <span>Only some now?</span>
                    <div className={styles.stepper}>
                      <button type="button" onClick={() => setCount((n) => Math.max(1, n - 1))} aria-label="Fewer">
                        −
                      </button>
                      <output aria-live="polite">{count}</output>
                      <button type="button" onClick={() => setCount((n) => Math.min(result.coupon.remaining - 1, n + 1))} aria-label="More">
                        +
                      </button>
                    </div>
                    <button type="button" className={styles.secondary} onClick={() => admit(count)} disabled={busy}>
                      {verb(count)}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className={styles.resultActions}>
              <button type="button" className={styles.primary} onClick={next}>
                Scan next
              </button>
              {admitted?.checkinId && me.canUndo && (
                <button type="button" className={styles.secondary} onClick={undo} disabled={busy}>
                  Undo
                </button>
              )}
            </div>
          </div>
        )}

        <form
          className={styles.manual}
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) {
              pause();
              lookup(code);
            }
          }}
        >
          <label htmlFor="scan-code">Or type the code</label>
          <div className={styles.manualRow}>
            <input
              id="scan-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD-2345"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
            />
            <button type="submit" className={styles.secondary} disabled={busy || !code.trim()}>
              Check
            </button>
          </div>
        </form>

        {history.length > 0 && (
          <section className={styles.history} aria-label="Recent check-ins">
            <h2>Recent</h2>
            <ul>
              {history.map((h, i) => (
                <li key={i}>
                  <span>{h.at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                  <strong>{h.name}</strong>
                  <span className={h.ok ? styles.hOk : styles.hUndo}>{h.what}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
