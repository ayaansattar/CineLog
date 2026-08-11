import { useEffect, useState } from 'react';
import { createEntry, getEntries, getTmdbDetails, posterUrl, searchTmdb } from './api';

function Poster({ path, title, className = '' }) {
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
  return <img src={src} alt={title} className={`object-cover ${className}`} loading="lazy" />;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addStatus, setAddStatus] = useState('watchlist');
  const [addingId, setAddingId] = useState(null);
  const [message, setMessage] = useState('');
  const [entries, setEntries] = useState([]);

  async function refreshEntries() {
    try {
      const data = await getEntries();
      setEntries(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    refreshEntries();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchError('');
      setSearching(false);
      return;
    }

    const handle = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const data = await searchTmdb(trimmed);
        setResults(data.results || []);
      } catch (err) {
        setResults([]);
        setSearchError(err.message || 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [query]);

  async function handleAdd(result) {
    const key = `${result.mediaType}-${result.tmdbId}`;
    setAddingId(key);
    setMessage('');
    try {
      const details = await getTmdbDetails(result.mediaType, result.tmdbId);
      await createEntry({
        tmdbId: details.tmdbId,
        title: details.title,
        year: details.year,
        mediaType: details.mediaType,
        posterPath: details.posterPath,
        genres: details.genres,
        status: addStatus,
      });
      setMessage(`Added “${details.title}” to ${addStatus}.`);
      await refreshEntries();
    } catch (err) {
      if (err.status === 409) {
        setMessage(`“${result.title}” is already in your library.`);
      } else {
        setMessage(err.message || 'Failed to add title');
      }
    } finally {
      setAddingId(null);
    }
  }

  const recent = entries.slice(0, 12);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="mb-2 text-sm tracking-[0.2em] text-[var(--muted)] uppercase">Personal tracker</p>
        <h1 className="font-['Instrument_Serif'] text-5xl tracking-tight text-[var(--text)] sm:text-6xl">
          CineLog
        </h1>
        <p className="mt-3 max-w-xl text-[var(--muted)]">
          Search TMDB and add movies or shows to your watchlist or watched log.
        </p>
      </header>

      <section className="mb-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block flex-1">
            <span className="mb-2 block text-sm text-[var(--muted)]">Search TMDB</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pulp Fiction, Breaking Bad…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
              autoComplete="off"
            />
          </label>

          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
            {['watchlist', 'watched'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setAddStatus(status)}
                className={`rounded-md px-4 py-2 text-sm capitalize transition ${
                  addStatus === status
                    ? 'bg-[var(--accent)] text-[#1a1208]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                Add as {status}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
            {message}
          </p>
        )}
        {searchError && (
          <p className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
            {searchError}
          </p>
        )}
        {searching && <p className="mb-4 text-sm text-[var(--muted)]">Searching…</p>}

        {!searching && query.trim() && results.length === 0 && !searchError && (
          <p className="mb-4 text-sm text-[var(--muted)]">No movie or TV results.</p>
        )}

        {results.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((result) => {
              const key = `${result.mediaType}-${result.tmdbId}`;
              const busy = addingId === key;
              return (
                <li
                  key={key}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]"
                >
                  <Poster path={result.posterPath} title={result.title} className="aspect-[2/3] w-full" />
                  <div className="space-y-2 p-3">
                    <div>
                      <h2 className="line-clamp-2 text-sm font-medium leading-snug">{result.title}</h2>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {result.year ?? '—'} · {result.mediaType === 'tv' ? 'TV' : 'Movie'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAdd(result)}
                      className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[#1a1208] transition hover:bg-[var(--accent-dim)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-['Instrument_Serif'] text-3xl">Your library</h2>
          <span className="text-sm text-[var(--muted)]">{entries.length} titles</span>
        </div>

        {recent.length === 0 ? (
          <p className="text-[var(--muted)]">Nothing saved yet — search above to add your first title.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {recent.map((entry) => (
              <li key={entry.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                <Poster path={entry.posterPath} title={entry.title} className="aspect-[2/3] w-full" />
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-medium">{entry.title}</h3>
                  <p className="mt-1 text-xs capitalize text-[var(--muted)]">
                    {entry.year ?? '—'} · {entry.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
