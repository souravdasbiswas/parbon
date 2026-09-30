import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { usePronami } from '../../components/donate/PronamiDialog.jsx';
import Icon from '../../components/motifs/Icon.jsx';
import { contentApi } from '../../services/api.js';
import BottomSheet from './BottomSheet.jsx';
import { useT } from './BiTitle.jsx';
import { sheetCopy } from './copy.js';
import styles from './SponsorSheet.module.css';

/**
 * Sponsor API for v2:
 * - useSponsor().open(eventSlug?) opens /events/:slug?sponsor=1 (or featured event from home).
 * - useSponsor().warmSponsor() injects the script.google.com preconnect.
 * - useSponsor().isOpen is true while the sponsor sheet is visible (the mobile tab bar hides itself).
 * Events without sponsorship.url automatically fall back to the shared Pronami dialog.
 */
const SponsorContext = createContext({ open: () => {}, warmSponsor: () => {}, isOpen: false });

function addScriptPreconnect() {
  if (document.querySelector('link[data-parbon-sponsor-preconnect]')) return;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = 'https://script.google.com';
  link.setAttribute('data-parbon-sponsor-preconnect', '1');
  document.head.append(link);
}

function sponsorSlugFrom(pathname) {
  const match = pathname.match(/^\/events\/([a-z0-9-]+)\/?$/);
  return match?.[1] || null;
}

function removeSponsorSearch(location, navigate) {
  const params = new URLSearchParams(location.search);
  if (!params.has('sponsor')) return;
  params.delete('sponsor');
  const search = params.toString();
  navigate(`${location.pathname}${search ? `?${search}` : ''}${location.hash}`, { replace: true });
}

async function getSponsorEvent(slug) {
  if (slug) return contentApi.event(slug);
  const featured = await contentApi.featuredEvent();
  return featured?.data || null;
}

function openExternalSponsor(url) {
  const win = window.open(url, '_blank');
  if (win) win.opener = null;
  return Boolean(win);
}

function SponsorFrame({ event, onClose }) {
  const { t } = useT();
  const [loadedUrl, setLoadedUrl] = useState('');
  const url = event?.sponsorship?.url;
  const externalOnly = event?.sponsorship?.embeddable === false;

  if (!url) return null;

  const loaded = loadedUrl === url;
  const title = (
    <span className={styles.sheetTitle}>
      <span lang="bn">পুজোয় পাশে থাকুন</span>
      <span>Sponsor {event.title?.en || 'Parbon'}</span>
    </span>
  );

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={title}
      historyKey="sponsor"
      className={styles.sheet}
      contentClassName={styles.content}
      footer={
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.external}>
          {t(sheetCopy.openExternal)}
        </a>
      }
    >
      <div className={styles.frameWrap}>
        {/* "Secure" pill over the sponsor page, hidden for now. Uncomment this and .secure in SponsorSheet.module.css to bring it back.
        <p className={styles.secure}>
          <Icon name="check" size={16} />
          {t(sheetCopy.secure)}
        </p>
        */}
        {externalOnly ? (
          <div className={styles.externalFallback}>
            <Icon name="lamp" size={40} />
            <p>{t(event.sponsorship?.appeal) || t(sheetCopy.secure)}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className={styles.externalButton}>
              {t(sheetCopy.openSecure)}
            </a>
          </div>
        ) : (
          <>
            {!loaded && (
              <div className={styles.skeleton} role="status" aria-live="polite">
                <Icon name="lamp" size={32} />
                <span>{t(sheetCopy.loading)}</span>
              </div>
            )}
            <iframe
              className={styles.iframe}
              src={url}
              title={`Sponsor ${event.title?.en || 'Parbon'}`}
              allow="payment; clipboard-write; web-share"
              onLoad={() => setLoadedUrl(url)}
            />
          </>
        )}
      </div>
    </BottomSheet>
  );
}

export function SponsorProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pronami = usePronami();
  const [event, setEvent] = useState(null);
  const [isResolving, setResolving] = useState(false);

  const warmSponsor = useCallback(() => addScriptPreconnect(), []);

  const close = useCallback(() => {
    setEvent(null);
    removeSponsorSearch(location, navigate);
  }, [location, navigate]);

  const open = useCallback(
    (eventSlug) => {
      warmSponsor();
      const target = eventSlug ? `/events/${encodeURIComponent(eventSlug)}?sponsor=1` : '/?sponsor=1';
      navigate(target);
    },
    [navigate, warmSponsor],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('sponsor')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is the external system controlling this sheet.
      setEvent(null);
      return undefined;
    }

    let active = true;
    const slug = sponsorSlugFrom(location.pathname);
    setResolving(true);
    getSponsorEvent(slug)
      .then((next) => {
        if (!active) return;
        if (next?.sponsorship?.url) {
          if (next.sponsorship.embeddable === false && openExternalSponsor(next.sponsorship.url)) {
            setEvent(null);
            removeSponsorSearch(location, navigate);
          } else {
            if (next.sponsorship.embeddable !== false) warmSponsor();
            setEvent(next);
          }
        } else {
          setEvent(null);
          removeSponsorSearch(location, navigate);
          pronami.open();
        }
      })
      .catch(() => {
        if (!active) return;
        setEvent(null);
        removeSponsorSearch(location, navigate);
        pronami.open();
      })
      .finally(() => {
        if (active) setResolving(false);
      });

    return () => {
      active = false;
    };
  }, [location, navigate, pronami, warmSponsor]);

  const value = useMemo(() => ({ open, warmSponsor, isOpen: Boolean(event) || isResolving }), [event, isResolving, open, warmSponsor]);

  return (
    <SponsorContext value={value}>
      {children}
      {event?.sponsorship?.url && <SponsorFrame event={event} onClose={close} />}
    </SponsorContext>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSponsor = () => useContext(SponsorContext);
