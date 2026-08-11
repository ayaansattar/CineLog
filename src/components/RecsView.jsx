import { useEffect, useState } from 'react';
import Poster from './Poster';

const TAG_LABELS = {
  matches_taste: 'Matches your taste',
  popular_pick: 'Popular pick',
};

const SOURCE_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'discover', label: 'Discover' },
  { id: 'watchlist', label: 'Watchlist' },
];

const DISCOVER_SUGGESTIONS = [
  'Something like my highest-rated thrillers',
  'A slow-burn mystery I haven’t seen',
  'Funny but smart — not broad comedy',
  'A bingeable TV show for evenings',
];

const WATCHLIST_SUGGESTIONS = [
  'A thriller from my watchlist',
  'Something lighter from my watchlist tonight',
  'A short movie from my watchlist',
  'Pick a TV show from my watchlist',
];

const STORAGE_KEY = 'cinelog-recs-source';

export default function RecsView({
  onAsk,
  onAdd,
  onStartWatching,
  recommendations,
  meta,
  loading,
  error,
  addingId,
  busyId,
}) {
  const [query, setQuery] = useState('');
  const [sourceMode, setSourceMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'auto' || saved === 'discover' || saved === 'watchlist') return saved;
    } catch {
      /* ignore */
    }
    return 'auto';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, sourceMode);
    } catch {
      /* ignore */
    }
  }, [sourceMode]);

  const effectiveSource = meta?.source;
  const fromWatchlist = effectiveSource === 'watchlist';
  const suggestions =
    sourceMode === 'watchlist' ? WATCHLIST_SUGGESTIONS : DISCOVER_SUGGESTIONS;

  function submit(text) {
    const trimmed = (text ?? query).trim();
    if (!trimmed || loading) return;
    onAsk(trimmed, sourceMode);
  }

  return (
    <section>
      <form
        className="mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-[var(--muted)]">Recommendation source</span>
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
            {SOURCE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={loading}
                onClick={() => setSourceMode(option.id)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  sourceMode === option.id
                    ? 'bg-[var(--accent)] text-[#1a1208]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          {sourceMode === 'auto'
            ? 'Auto detects phrases like “from my watchlist”; otherwise discovers new titles via TMDB.'
            : sourceMode === 'watchlist'
              ? 'Gemini will only pick from titles already on your watchlist.'
              : 'Gemini picks from a TMDB candidate pool, excluding titles already in your library.'}
        </p>

        <label className="block">
          <span className="mb-2 block text-sm text-[var(--muted)]">What are you in the mood for?</span>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={
              sourceMode === 'watchlist'
                ? 'e.g. a thriller from my watchlist for tonight'
                : 'e.g. something like Pulp Fiction but funnier'
            }
            className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[#1a1208] transition hover:bg-[var(--accent-dim)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Finding picks…' : 'Get recommendations'}
          </button>
          {suggestions.map((hint) => (
            <button
              key={hint}
              type="button"
              disabled={loading}
              onClick={() => {
                setQuery(hint);
                submit(hint);
              }}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-60"
            >
              {hint}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <p className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {loading && (
        <p className="mb-4 text-sm text-[var(--muted)]">
          {sourceMode === 'watchlist'
            ? 'Ranking titles from your watchlist with Gemini…'
            : sourceMode === 'auto'
              ? 'Detecting source, building a candidate pool, and asking Gemini…'
              : 'Building a TMDB candidate pool and asking Gemini to pick from it…'}
        </p>
      )}

      {!loading && recommendations.length === 0 && !error && (
        <p className="text-sm text-[var(--muted)]">
          Gemini only chooses from a grounded candidate pool — either live TMDB discoveries or your
          watchlist — never invents titles from memory.
        </p>
      )}

      {recommendations.length > 0 && (
        <>
          {meta && (
            <p className="mb-4 text-sm text-[var(--muted)]">
              {fromWatchlist
                ? `Picked from ${meta.candidateCount} watchlist titles.`
                : `Picked from ${meta.candidateCount} candidates using ${meta.seedCount} of your top titles.`}
              {meta.mediaType && meta.mediaType !== 'any'
                ? ` Filtered to ${meta.mediaType === 'tv' ? 'TV' : 'movies'}.`
                : ''}
              {meta.genres?.length
                ? ` Preferring ${meta.genres.join('/').toLowerCase()}.`
                : ''}
              {meta.requestedSource === 'auto' ? ` (auto → ${meta.source})` : ''}
            </p>
          )}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recommendations.map((rec) => {
              const key = rec.entryId
                ? `entry-${rec.entryId}`
                : `${rec.mediaType}-${rec.tmdbId}`;
              const busy = addingId === key || busyId === rec.entryId;
              return (
                <li
                  key={key}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]"
                >
                  <div className="flex gap-3 p-3 sm:block sm:p-0">
                    <Poster
                      path={rec.posterPath}
                      title={rec.title}
                      className="aspect-[2/3] w-20 shrink-0 rounded-lg sm:w-full sm:rounded-none"
                    />
                    <div className="min-w-0 flex-1 space-y-2 sm:p-3">
                      <div>
                        <p className="text-[11px] tracking-wide text-[var(--accent)] uppercase">
                          {TAG_LABELS[rec.tag] || rec.tag}
                        </p>
                        <h2 className="mt-1 line-clamp-2 text-base font-medium leading-snug">
                          {rec.title}
                        </h2>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {rec.year ?? '—'} · {rec.mediaType === 'tv' ? 'TV' : 'Movie'}
                          {rec.genres?.length ? ` · ${rec.genres.slice(0, 2).join(', ')}` : ''}
                        </p>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--muted)]">{rec.reason}</p>
                      {fromWatchlist ? (
                        <button
                          type="button"
                          disabled={busy || !rec.entryId}
                          onClick={() => onStartWatching(rec)}
                          className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[#1a1208] transition hover:bg-[var(--accent-dim)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                          {busy ? 'Updating…' : 'Start watching'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onAdd(rec)}
                          className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[#1a1208] transition hover:bg-[var(--accent-dim)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                          {busy ? 'Adding…' : 'Add to watchlist'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
