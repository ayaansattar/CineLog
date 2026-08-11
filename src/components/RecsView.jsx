import { useState } from 'react';
import Poster from './Poster';

const TAG_LABELS = {
  matches_taste: 'Matches your taste',
  popular_pick: 'Popular pick',
};

const SUGGESTIONS = [
  'Something like my highest-rated thrillers',
  'A slow-burn mystery I haven’t seen',
  'Funny but smart — not broad comedy',
  'A bingeable TV show for evenings',
];

export default function RecsView({ onAsk, onAdd, recommendations, meta, loading, error, addingId }) {
  const [query, setQuery] = useState('');

  function submit(text) {
    const trimmed = (text ?? query).trim();
    if (!trimmed || loading) return;
    onAsk(trimmed);
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
        <label className="block">
          <span className="mb-2 block text-sm text-[var(--muted)]">What are you in the mood for?</span>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. something like Pulp Fiction but funnier"
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
          {SUGGESTIONS.map((hint) => (
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
          Building a TMDB candidate pool and asking Claude to pick from it…
        </p>
      )}

      {!loading && recommendations.length === 0 && !error && (
        <p className="text-sm text-[var(--muted)]">
          Recommendations are chosen only from a live TMDB candidate pool (similar titles to your
          highest-rated watches, plus trending). Nothing is invented from memory.
        </p>
      )}

      {recommendations.length > 0 && (
        <>
          {meta && (
            <p className="mb-4 text-sm text-[var(--muted)]">
              Picked from {meta.candidateCount} candidates using {meta.seedCount} of your top titles.
            </p>
          )}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec) => {
              const key = `${rec.mediaType}-${rec.tmdbId}`;
              const busy = addingId === key;
              return (
                <li
                  key={key}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]"
                >
                  <div className="flex gap-3 p-3 sm:block sm:p-0">
                    <Poster
                      path={rec.posterPath}
                      title={rec.title}
                      className="aspect-[2/3] w-24 shrink-0 rounded-lg sm:w-full sm:rounded-none"
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
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onAdd(rec)}
                        className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[#1a1208] transition hover:bg-[var(--accent-dim)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        {busy ? 'Adding…' : 'Add to watchlist'}
                      </button>
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
