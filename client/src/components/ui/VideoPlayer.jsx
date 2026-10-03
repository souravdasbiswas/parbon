import { useState } from 'react';
import styles from './VideoPlayer.module.css';

/**
 * A video that waits behind its poster until it is clicked, then plays right there with sound
 * (the click is the user gesture browsers need). Nothing is downloaded before the click.
 */
export default function VideoPlayer({ src, poster, width, height, label, duration, className = '', posterPosition }) {
  const [playing, setPlaying] = useState(false);
  const ratio = width > 0 && height > 0 ? `${width} / ${height}` : '16 / 9';

  return (
    <div className={`${styles.player} ${className}`} style={{ aspectRatio: ratio }}>
      {playing ? (
        <video src={src} poster={poster || undefined} controls autoPlay playsInline preload="auto" aria-label={label} />
      ) : (
        <button type="button" className={styles.start} onClick={() => setPlaying(true)}>
          {poster && <img src={poster} alt="" width={width || undefined} height={height || undefined} loading="lazy" decoding="async" style={posterPosition ? { objectPosition: posterPosition } : undefined} />}
          <span className={styles.play} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
          {duration && <span className={styles.duration}>{duration}</span>}
          <span className="visually-hidden">Play video: {label}</span>
        </button>
      )}
    </div>
  );
}
