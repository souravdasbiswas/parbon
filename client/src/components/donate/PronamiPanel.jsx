import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { contentApi } from '../../services/api.js';
import Icon from '../motifs/Icon.jsx';
import styles from './PronamiPanel.module.css';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / non-secure contexts.
    const area = Object.assign(document.createElement('textarea'), { value: text });
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/** UPI QR, copyable UPI ID and a "pay with UPI app" deep link. `tone` = light | dark. */
export default function PronamiPanel({ tone = 'light', showIntro = true, headingLevel: H = 'h3' }) {
  const { t } = useLocale();
  const { data } = useApi('support', contentApi.support);
  const [copied, setCopied] = useState(false);
  const donation = data?.donation;
  const upi = donation?.methods?.find((m) => m.type === 'upi');

  if (!donation) return <div className={`${styles.panel} ${styles[tone]} ${styles.placeholder}`} aria-hidden="true" />;

  if (!upi) {
    return (
      <div className={`${styles.panel} ${styles[tone]}`}>
        <p>{t(donation.fallback)}</p>
      </div>
    );
  }

  const onCopy = async () => {
    if (await copyText(upi.upiId)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className={`${styles.panel} ${styles[tone]}`}>
      {showIntro && donation.pronami && (
        <div className={styles.intro}>
          <H className={styles.title}>
            <span lang="bn" className={styles.titleBn}>
              {donation.pronami.title.bn}
            </span>
            <span className={styles.titleEn}>{donation.pronami.title.en}</span>
          </H>
          <p className={styles.text}>{t(donation.pronami.text)}</p>
        </div>
      )}

      <div className={styles.pay}>
        <figure className={styles.qr}>
          <img src={upi.qr} width="176" height="176" alt={`UPI QR code to pay ${upi.payeeName} (${upi.upiId})`} loading="lazy" />
          <figcaption>Scan to pay</figcaption>
        </figure>

        <div className={styles.details}>
          <p className={styles.label}>
            UPI ID <span lang="bn">· ইউপিআই</span>
          </p>
          <p className={styles.upiRow}>
            <code className={styles.upiId}>{upi.upiId}</code>
            <button type="button" className={styles.copy} onClick={onCopy}>
              <Icon name={copied ? 'check' : 'copy'} size={16} />
              <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </p>
          <a className={styles.appLink} href={upi.upiLink}>
            <Icon name="phone" size={16} />
            Pay with a UPI app
          </a>
          <p className={styles.note}>{t(upi.note)}</p>
          {donation.pronami?.thanks && (
            <p lang="bn" className={styles.thanks}>
              {donation.pronami.thanks.bn}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
