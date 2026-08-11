import { useEffect, useRef, useState } from 'react';
import { getTmdbDetails } from '../api';
import Poster from './Poster';

/**
 * Poster with hover overlay for TMDB overview; fetches details if overview/genres missing.
 */
export default function PosterWithSummary({
  path,
  title,
  overview = '',
  genres = null,
  mediaType,
  tmdbId,
  entryId = null,
  onDetailsLoaded,
  badge = null,
  footerBadge = null,
  className = 'aspect-[2/3] w-full',
}) {
  const [text, setText] = useState(overview || '');
  const [genreList, setGenreList] = useState(() =>
    Array.isArray(genres) ? genres : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requested = useRef(false);

  useEffect(() => {
    setText(overview || '');
  }, [overview]);

  useEffect(() => {
    setGenreList(Array.isArray(genres) ? genres : []);
  }, [genres]);

  async function ensureDetails() {
    const needsOverview = !String(text || '').trim();
    const needsGenres = genreList.length === 0;
    if (!needsOverview && !needsGenres) return;
    if (!tmdbId || !mediaType || requested.current) return;

    requested.current = true;
    setLoading(true);
    setError('');
    try {
      const details = await getTmdbDetails(mediaType, tmdbId);
      const nextOverview = details.overview || '';
      const nextGenres = Array.isArray(details.genres) ? details.genres : [];
      if (nextOverview) setText(nextOverview);
      if (nextGenres.length) setGenreList(nextGenres);
      onDetailsLoaded?.({
        entryId,
        tmdbId,
        mediaType,
        overview: nextOverview,
        genres: nextGenres,
      });
    } catch (err) {
      setError(err.message || 'Could not load summary');
      requested.current = false;
    } finally {
      setLoading(false);
    }
  }

  const summary = String(text || '').trim();

  return (
    <div className="group relative" onMouseEnter={ensureDetails} onFocus={ensureDetails}>
      <Poster path={path} title={title} className={className} />
      {badge}
      {footerBadge}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/85 to-black/20 p-3 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="max-h-[70%] overflow-y-auto pointer-events-auto">
          {loading && !summary ? (
            <p className="text-[11px] text-[var(--muted)]">Loading summary…</p>
          ) : error && !summary ? (
            <p className="text-[11px] text-[var(--danger)]">{error}</p>
          ) : summary ? (
            <p className="text-[11px] leading-relaxed text-[var(--text)]">{summary}</p>
          ) : (
            <p className="text-[11px] text-[var(--muted)]">No summary available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function GenreLine({ genres, className = '' }) {
  const list = Array.isArray(genres) ? genres.filter(Boolean) : [];
  if (!list.length) return null;
  return (
    <p className={`line-clamp-2 text-[11px] text-[var(--muted)] ${className}`}>
      {list.slice(0, 3).join(' · ')}
      {list.length > 3 ? '…' : ''}
    </p>
  );
}
