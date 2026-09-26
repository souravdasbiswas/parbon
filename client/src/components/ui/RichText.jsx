const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/**
 * Renders plain text the way a chat app does: paragraphs on blank lines,
 * line breaks preserved, and http(s) links made clickable. No HTML is ever injected.
 */
export default function RichText({ text, className, linkClassName }) {
  if (!text) return null;
  const paragraphs = String(text).split(/\n{2,}/);
  return (
    <div className={className}>
      {paragraphs.map((para, i) => (
        <p key={i}>
          {para.split(URL_RE).map((part, j) =>
            j % 2 === 1 ? (
              <a key={j} href={part} target="_blank" rel="noopener noreferrer nofollow" className={linkClassName}>
                {part.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              part
            ),
          )}
        </p>
      ))}
    </div>
  );
}
