import { useEffect, useState } from 'react';
import Poster from './Poster';

const TAG_LABELS = {
  matches_taste: 'Matches your taste',
  popular_pick: 'Popular pick',
};

const SOURCE_OPTIONS = [
  {
    id: 'auto',
    label: 'Auto',
    hint: 'Picks Discover or Watchlist from your wording',
  },
  {
    id: 'discover',
    label: 'Discover',
    hint: 'New titles from TMDB, not already in your library',
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    hint: 'Only titles you already saved',
  },
];

const DISCOVER_SUGGESTIONS = [
  'Something like my highest-rated thrillers',
  'A slow-burn mystery I haven’t seen',
  'Funny but smart — not broad comedy',
  'A bingeable TV show for evenings',
];

const WATCHLIST_SUGGESTIONS = [
  'Action movies from my watchlist',
  'Something lighter from my watchlist tonight',
  'A short movie from my watchlist',
  'Pick a TV show from my watchlist',
];

const STORAGE_KEY = 'cinelog-recs-source';

function SkeletonCard() {
  return (
    <li className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex gap-3 p-3 sm:block sm:p-0">
        <div className="recs-skeleton aspect-[2/3] w-20 shrink-0 rounded-lg sm:w-full sm:rounded-none" />
        <div className="min-w-0 flex-1 space-y-2 sm:p-3">
          <div className="recs-skeleton h-3 w-24 rounded" />
          <div className="recs-skeleton h-4 w-4/5 max-w-[12rem] rounded" />
          <div className="recs-skeleton h-3 w-28 rounded" />
          <div className="recs-skeleton h-10 w-full rounded" />
          <div className="recs-skeleton h-8 w-28 rounded" />
        </div>
      </div>
    </li>
  );
}

function MetaChip({ children }) {
  return (
    <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--muted)]">
      {children}
    </span>
  );
}

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
  const [lastQuery, setLastQuery] = useState('');
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

  const fromWatchlist = meta?.source === 'watchlist';
  const suggestions =
    sourceMode === 'watchlist' ? WATCHLIST_SUGGESTIONS : DISCOVER_SUGGESTIONS;
  const activeSource = SOURCE_OPTIONS.find((o) => o.id === sourceMode);
  const showEmpty = !loading && recommendations.length === 0 && !error;
  const showResults = recommendations.length > 0;

  function submit(text) {
    const trimmed = (text ?? query).trim();
    if (!trimmed || loading) return;
    setLastQuery(trimmed);
    onAsk(trimmed, sourceMode);
  }

  return (
    <section>
      <form
        className="mb-8"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Source</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{activeSource?.hint}</p>
            </div>
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
              {SOURCE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={loading}
                  title={option.hint}
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

          <label className="block">
            <span className="mb-2 block text-sm text-[var(--muted)]">What are you in the mood for?</span>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={loading}
              placeholder={
                sourceMode === 'watchlist'
                  ? 'e.g. action movies from my watchlist'
                  : 'e.g. something like Pulp Fiction but funnier'
              }
              className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] disabled:opacity-70"
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted)]">
              Tip: say “movie” / “TV” or a genre like “thriller” to narrow results.
            </p>
            <p className="shrink-0 text-xs text-[var(--muted)]">{query.length}/500</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
        <div className="mb-6 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3">
          <p className="text-sm font-medium text-[var(--danger)]">Couldn’t get recommendations</p>
          <p className="mt-1 text-sm text-[var(--danger)]/90">{error}</p>
          {lastQuery && (
            <button
              type="button"
              disabled={loading}
              onClick={() => submit(lastQuery)}
              className="mt-3 rounded-md border border-[var(--danger)]/40 px-3 py-1.5 text-xs text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-60"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="mb-4" aria-live="polite" aria-busy="true">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
              <span className="recs-spinner" aria-hidden="true" />
              {sourceMode === 'watchlist'
                ? 'Ranking titles from your watchlist…'
                : sourceMode === 'auto'
                  ? 'Reading your request and building a candidate pool…'
                  : 'Building a TMDB candidate pool and ranking with Gemini…'}
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </ul>
        </div>
      )}

      {showEmpty && (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/60 px-5 py-8 text-center">
          <p className="font-['Instrument_Serif'] text-2xl text-[var(--text)]">Ask for something to watch</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            Gemini only chooses from a grounded list — TMDB discoveries or your watchlist — and never
            invents titles from memory.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {suggestions.slice(0, 2).map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => {
                  setQuery(hint);
                  submit(hint);
                }}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}

      {showResults && !loading && (
        <div className="recs-fade-in">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-[var(--text)]">
                {recommendations.length} recommendation{recommendations.length === 1 ? '' : 's'}
                {lastQuery ? (
                  <>
                    {' '}
                    for <span className="text-[var(--muted)]">“{lastQuery}”</span>
                  </>
                ) : null}
              </p>
              {meta && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <MetaChip>
                    {fromWatchlist ? 'From watchlist' : 'Discover'}
                    {meta.requestedSource === 'auto' ? ' · auto' : ''}
                  </MetaChip>
                  {meta.mediaType && meta.mediaType !== 'any' && (
                    <MetaChip>{meta.mediaType === 'tv' ? 'TV only' : 'Movies only'}</MetaChip>
                  )}
                  {meta.genres?.length > 0 && (
                    <MetaChip>
                      {meta.genreFiltered ? 'Genre' : 'Prefers'} {meta.genres.join('/')}
                    </MetaChip>
                  )}
                  <MetaChip>
                    {fromWatchlist
                      ? `${meta.candidateCount} watchlist titles`
                      : `${meta.candidateCount} candidates · ${meta.seedCount} seeds`}
                  </MetaChip>
                </div>
              )}
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recommendations.map((rec) => {
              const key = rec.entryId
                ? `entry-${rec.entryId}`
                : `${rec.mediaType}-${rec.tmdbId}`;
              const busy = addingId === key || busyId === rec.entryId;
              return (
                <li
                  key={key}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] transition hover:border-[var(--accent)]/40"
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
        </div>
      )}
    </section>
  );
}
