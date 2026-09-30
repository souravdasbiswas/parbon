import styles from './EventHub.module.css';

export default function HubTitle({ id, title, eyebrow, as: H = 'h2', className = '' }) {
  return (
    <div className={`${styles.hubTitle} ${className}`.trim()}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <H id={id} className={styles.titlePair}>
        {title?.bn && <span lang="bn" className={styles.titleBn}>{title.bn}</span>}
        {title?.en && <span className={styles.titleEn}>{title.en}</span>}
      </H>
    </div>
  );
}
