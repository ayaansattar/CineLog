import { posterUrl } from '../api';

export default function Poster({ path, title, className = '' }) {
  const src = posterUrl(path);
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--surface)] text-xs text-[var(--muted)] ${className}`}
      >
        No poster
      </div>
    );
  }
  return <img src={src} alt={title} draggable={false} className={`object-cover ${className}`} loading="lazy" />;
}
