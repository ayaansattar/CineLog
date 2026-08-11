import { useEffect, useState } from 'react';
import {
  createEntry,
  deleteEntry,
  getEntries,
  getRecommendations,
  getTmdbDetails,
  searchTmdb,
  updateEntry,
} from './api';
import LibraryView from './components/LibraryView';
import Poster from './components/Poster';
import RecsView from './components/RecsView';

const VIEWS = [
  { id: 'search', label: 'Search' },
  { id: 'library', label: 'Library' },
  { id: 'recs', label: 'Recs' },
];

export default function App() {
  const [view, setView] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addStatus, setAddStatus] = useState('watchlist');
  const [addingId, setAddingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [entries, setEntries] = useState([]);
  const [recs, setRecs] = useState([]);
  const [recsMeta, setRecsMeta] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState('');

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

  async function handleAdd(result, status = addStatus) {
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
        status,
      });
      setMessage(`Added “${details.title}” to ${status}.`);
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

  async function handleStatusChange(id, status) {
    setBusyId(id);
    setMessage('');
    try {
      await updateEntry(id, { status });
      await refreshEntries();
    } catch (err) {
      setMessage(err.message || 'Failed to update entry');
    } finally {
      setBusyId(null);
    }
  }

  async function handleProgressChange(id, progress) {
    setBusyId(id);
    setMessage('');
    try {
      await updateEntry(id, progress);
      await refreshEntries();
    } catch (err) {
      setMessage(err.message || 'Failed to update progress');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRatingChange(id, rating) {
    setBusyId(id);
    setMessage('');
    try {
      await updateEntry(id, { rating });
      await refreshEntries();
    } catch (err) {
      setMessage(err.message || 'Failed to update rating');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    setBusyId(id);
    setMessage('');
    try {
      await deleteEntry(id);
      await refreshEntries();
    } catch (err) {
      setMessage(err.message || 'Failed to remove entry');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAskRecs(askQuery, source = 'auto') {
    setRecsLoading(true);
    setRecsError('');
    setMessage('');
    try {
      const data = await getRecommendations(askQuery, source);
      setRecs(data.recommendations || []);
      setRecsMeta(data.meta || null);
    } catch (err) {
      setRecs([]);
      setRecsMeta(null);
      setRecsError(err.message || 'Recommendation request failed');
    } finally {
      setRecsLoading(false);
    }
  }

  async function handleStartWatchingFromRec(rec) {
    if (!rec.entryId) return;
    setBusyId(rec.entryId);
    setMessage('');
    try {
      await updateEntry(rec.entryId, { status: 'watching' });
      setMessage(`Moved “${rec.title}” to watching.`);
      await refreshEntries();
    } catch (err) {
      setMessage(err.message || 'Failed to update entry');
    } finally {
      setBusyId(null);
    }
  }

  const subtitle =
    view === 'search'
      ? 'Search TMDB and add movies or shows to your library.'
      : view === 'library'
        ? 'Browse watchlist, currently watching, and watched titles.'
        : 'Ask for suggestions — discover new titles, or pick from your watchlist.';

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm tracking-[0.2em] text-[var(--muted)] uppercase">Personal tracker</p>
            <h1 className="font-['Instrument_Serif'] text-5xl tracking-tight text-[var(--text)] sm:text-6xl">
              CineLog
            </h1>
          </div>

          <nav className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`rounded-md px-4 py-2 text-sm transition ${
                  view === item.id
                    ? 'bg-[var(--accent)] text-[#1a1208]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <p className="mt-3 max-w-xl text-[var(--muted)]">{subtitle}</p>
      </header>

      {message && (
        <p className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          {message}
        </p>
      )}

      {view === 'search' && (
        <section>
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
              {['watchlist', 'watching', 'watched'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setAddStatus(status)}
                  className={`rounded-md px-3 py-2 text-sm capitalize transition sm:px-4 ${
                    addStatus === status
                      ? 'bg-[var(--accent)] text-[#1a1208]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

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
                        {busy ? 'Adding…' : `Add to ${addStatus}`}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!query.trim() && entries.length > 0 && (
            <p className="mt-8 text-sm text-[var(--muted)]">
              {entries.length} title{entries.length === 1 ? '' : 's'} in your library — open the Library tab to
              browse.
            </p>
          )}
        </section>
      )}

      {view === 'library' && (
        <LibraryView
          entries={entries}
          onStatusChange={handleStatusChange}
          onProgressChange={handleProgressChange}
          onRatingChange={handleRatingChange}
          onDelete={handleDelete}
          busyId={busyId}
        />
      )}

      {view === 'recs' && (
        <RecsView
          onAsk={handleAskRecs}
          onAdd={(rec) => handleAdd(rec, 'watchlist')}
          onStartWatching={handleStartWatchingFromRec}
          recommendations={recs}
          meta={recsMeta}
          loading={recsLoading}
          error={recsError}
          addingId={addingId}
          busyId={busyId}
        />
      )}
    </div>
  );
}
