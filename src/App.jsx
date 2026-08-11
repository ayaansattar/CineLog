import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  createEntry,
  createSection,
  deleteEntry,
  deleteSection,
  getAuthStatus,
  getEntries,
  getRecommendations,
  getSections,
  getTmdbDetails,
  login,
  logout,
  searchTmdb,
  updateEntry,
  updateSection,
  reorderSections,
  reorderEntries,
} from './api';
import AuthBar from './components/AuthBar';
import FloatingBar from './components/FloatingBar';
import LibraryView from './components/LibraryView';
import Poster from './components/Poster';
import RecsView from './components/RecsView';

const VIEWS = [
  { id: 'search', label: 'Search' },
  { id: 'library', label: 'Library' },
  { id: 'recs', label: 'Recs' },
];

const EMPTY_SCROLL = { search: 0, library: 0, recs: 0 };

export default function App() {
  const [view, setView] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [entries, setEntries] = useState([]);
  const [sections, setSections] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState('');
  const [recs, setRecs] = useState([]);
  const [recsMeta, setRecsMeta] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [showFloatingBar, setShowFloatingBar] = useState(false);
  const headerRef = useRef(null);
  const scrollByViewRef = useRef({ ...EMPTY_SCROLL });

  function changeView(next) {
    if (next === view) return;
    scrollByViewRef.current[view] = window.scrollY;
    setView(next);
  }

  async function refreshAuth() {
    try {
      const data = await getAuthStatus();
      setAuthenticated(Boolean(data.authenticated));
      setAuthConfigured(data.configured !== false);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    refreshAuth();
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingBar(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '-8px 0px 0px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, scrollByViewRef.current[view] ?? 0);
  }, [view]);

  useEffect(() => {
    if (!message) return undefined;
    const id = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(id);
  }, [message]);

  async function refreshEntries({ quiet } = {}) {
    if (!quiet) {
      setEntriesLoading(true);
      setEntriesError('');
    }
    try {
      const [data, sectionData] = await Promise.all([getEntries(), getSections()]);
      setEntries(Array.isArray(data) ? data : []);
      setSections(Array.isArray(sectionData) ? sectionData : []);
      setEntriesError('');
    } catch (err) {
      console.error(err);
      setEntriesError(err.message || 'Failed to load library');
    } finally {
      if (!quiet) setEntriesLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setEntriesLoading(true);
      setEntriesError('');
      try {
        // Free hosts often sleep; retry once after a short wait.
        try {
          const [data, sectionData] = await Promise.all([getEntries(), getSections()]);
          if (!cancelled) {
            setEntries(Array.isArray(data) ? data : []);
            setSections(Array.isArray(sectionData) ? sectionData : []);
          }
        } catch (firstErr) {
          await new Promise((r) => setTimeout(r, 1500));
          const [data, sectionData] = await Promise.all([getEntries(), getSections()]);
          if (!cancelled) {
            setEntries(Array.isArray(data) ? data : []);
            setSections(Array.isArray(sectionData) ? sectionData : []);
          }
        }
        if (!cancelled) setEntriesError('');
      } catch (err) {
        console.error(err);
        if (!cancelled) setEntriesError(err.message || 'Failed to load library');
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
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

  async function handleAdd(result, status = 'watchlist') {
    if (!authenticated) {
      setMessage('Log in to add titles.');
      return;
    }
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
      await refreshEntries({ quiet: true });
    } catch (err) {
      if (err.status === 409) {
        setMessage(`“${result.title}” is already in your library.`);
      } else if (err.status === 401) {
        setAuthenticated(false);
        setMessage('Session expired — log in again.');
      } else {
        setMessage(err.message || 'Failed to add title');
      }
    } finally {
      setAddingId(null);
    }
  }

  async function handleStatusChange(id, status) {
    if (!authenticated) {
      setMessage('Log in to change status.');
      return;
    }
    setBusyId(id);
    setMessage('');
    try {
      await updateEntry(id, { status });
      await refreshEntries({ quiet: true });
    } catch (err) {
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to update entry');
    } finally {
      setBusyId(null);
    }
  }

  async function handleProgressChange(id, progress) {
    if (!authenticated) {
      setMessage('Log in to update progress.');
      return;
    }
    setBusyId(id);
    setMessage('');
    try {
      await updateEntry(id, progress);
      await refreshEntries({ quiet: true });
    } catch (err) {
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to update progress');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRatingChange(id, rating) {
    if (!authenticated) {
      setMessage('Log in to rate titles.');
      return;
    }
    setBusyId(id);
    setMessage('');
    try {
      await updateEntry(id, { rating });
      await refreshEntries({ quiet: true });
    } catch (err) {
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to update rating');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!authenticated) {
      setMessage('Log in to remove titles.');
      return;
    }
    setBusyId(id);
    setMessage('');
    try {
      await deleteEntry(id);
      await refreshEntries({ quiet: true });
    } catch (err) {
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to remove entry');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSectionChange(id, sectionId) {
    if (!authenticated) {
      setMessage('Log in to move titles.');
      return;
    }
    setMessage('');
    const snapshot = entries;
    const maxOrder = Math.max(
      -1,
      ...entries
        .filter((e) => (e.sectionId || null) === (sectionId || null) && e.id !== id)
        .map((e) => e.sectionOrder ?? 0),
    );
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, sectionId, sectionOrder: maxOrder + 1 } : entry,
      ),
    );
    try {
      await updateEntry(id, { sectionId });
    } catch (err) {
      setEntries(snapshot);
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to update heading');
    }
  }

  async function handleCreateSection(name) {
    if (!authenticated) {
      setMessage('Log in to add headings.');
      throw new Error('Login required');
    }
    try {
      const created = await createSection(name);
      setSections((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setMessage(`Added heading “${name}”.`);
    } catch (err) {
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to add heading');
      throw err;
    }
  }

  async function handleRenameSection(id, name) {
    if (!authenticated) {
      setMessage('Log in to rename headings.');
      return;
    }
    const snapshot = sections;
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    try {
      const updated = await updateSection(id, { name });
      setSections((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      setSections(snapshot);
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to rename heading');
    }
  }

  async function handleDeleteSection(id) {
    if (!authenticated) {
      setMessage('Log in to delete headings.');
      return;
    }
    const snapshotEntries = entries;
    const snapshotSections = sections;
    setSections((prev) => prev.filter((s) => s.id !== id));
    setEntries((prev) =>
      prev.map((e) => (e.sectionId === id ? { ...e, sectionId: null } : e)),
    );
    try {
      await deleteSection(id);
      setMessage('Heading deleted. Titles moved to Unsorted.');
    } catch (err) {
      setEntries(snapshotEntries);
      setSections(snapshotSections);
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to delete heading');
    }
  }

  async function handleReorderSections(ids) {
    if (!authenticated) {
      setMessage('Log in to reorder headings.');
      return;
    }
    const snapshot = sections;
    const byId = new Map(sections.map((s) => [s.id, s]));
    setSections(
      ids.map((id, sortOrder) => ({
        ...byId.get(id),
        id,
        sortOrder,
      })).filter((s) => s.name != null),
    );
    try {
      const next = await reorderSections(ids);
      setSections(Array.isArray(next) ? next : []);
    } catch (err) {
      setSections(snapshot);
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to reorder headings');
    }
  }

  async function handleReorderEntries(sectionId, ids) {
    if (!authenticated) {
      setMessage('Log in to reorder titles.');
      return;
    }
    const snapshot = entries;
    const order = new Map(ids.map((id, index) => [id, index]));
    setEntries((prev) =>
      prev.map((entry) => {
        if (!order.has(entry.id)) return entry;
        return {
          ...entry,
          sectionId,
          sectionOrder: order.get(entry.id),
        };
      }),
    );
    try {
      await reorderEntries(sectionId, ids);
    } catch (err) {
      setEntries(snapshot);
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to reorder titles');
    }
  }

  async function handleAskRecs(askQuery, source = 'auto') {
    if (!authenticated) {
      setRecsError('Log in to get recommendations.');
      return;
    }
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
      if (err.status === 401) setAuthenticated(false);
      setRecsError(err.message || 'Recommendation request failed');
    } finally {
      setRecsLoading(false);
    }
  }

  async function handleStartWatchingFromRec(rec) {
    if (!rec.entryId) return;
    if (!authenticated) {
      setMessage('Log in to update titles.');
      return;
    }
    setBusyId(rec.entryId);
    setMessage('');
    try {
      await updateEntry(rec.entryId, { status: 'watching' });
      setMessage(`Moved “${rec.title}” to watching.`);
      await refreshEntries({ quiet: true });
    } catch (err) {
      if (err.status === 401) setAuthenticated(false);
      setMessage(err.message || 'Failed to update entry');
    } finally {
      setBusyId(null);
    }
  }

  async function handleLogin(password) {
    await login(password);
    setAuthenticated(true);
    setMessage('Logged in — you can edit your library.');
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      console.error(err);
    }
    setAuthenticated(false);
    setMessage('Logged out. Browsing stays public; edits require login.');
  }

  const subtitle =
    view === 'search'
      ? 'Search TMDB and add movies or shows to your library.'
      : view === 'library'
        ? 'Browse watchlist, currently watching, and watched titles.'
        : 'Ask for suggestions — discover new titles, or pick from your watchlist.';

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <FloatingBar
        visible={showFloatingBar}
        view={view}
        views={VIEWS}
        onViewChange={changeView}
        query={query}
        onQueryChange={(value) => {
          setQuery(value);
          if (view !== 'search') changeView('search');
        }}
      />

      <header ref={headerRef} className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm tracking-[0.2em] text-[var(--muted)] uppercase">Personal tracker</p>
            <h1 className="font-['Instrument_Serif'] text-5xl tracking-tight text-[var(--text)] sm:text-6xl">
              CineLog
            </h1>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <AuthBar
              authenticated={authenticated}
              configured={authConfigured}
              onLogin={handleLogin}
              onLogout={handleLogout}
            />
            <nav className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeView(item.id)}
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
        </div>
        <p className="mt-3 max-w-xl text-[var(--muted)]">{subtitle}</p>
        {!authenticated && authConfigured && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Browsing is public. Log in to add, edit, rate, or ask for recs.
          </p>
        )}
      </header>

      {message && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 pointer-events-none"
        >
          <div className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <p className="flex-1">{message}</p>
            <button
              type="button"
              onClick={() => setMessage('')}
              className="shrink-0 text-[var(--muted)] transition hover:text-[var(--text)]"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {entriesLoading && (
        <p className="mb-6 text-sm text-[var(--muted)]">Loading your library from the database…</p>
      )}

      {entriesError && !entriesLoading && (
        <div className="mb-6 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3">
          <p className="text-sm text-[var(--danger)]">{entriesError}</p>
          <button
            type="button"
            onClick={() => refreshEntries()}
            className="mt-2 rounded-md border border-[var(--danger)]/40 px-3 py-1.5 text-xs text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
          >
            Retry
          </button>
        </div>
      )}

      <section className={view === 'search' ? undefined : 'hidden'} aria-hidden={view !== 'search'}>
          <div className="mb-4">
            <label className="block">
              <span className="mb-2 block text-sm text-[var(--muted)]">Search TMDB</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pulp Fiction, Breaking Bad…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
                autoComplete="off"
              />
            </label>
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
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {results.map((result) => {
                const key = `${result.mediaType}-${result.tmdbId}`;
                const busy = addingId === key;
                const editDisabled = busy || !authenticated;
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
                      {!authenticated ? (
                        <p className="text-[11px] text-[var(--muted)]">Log in to add</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {[
                            {
                              status: 'watchlist',
                              label: 'Watchlist',
                              className:
                                'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--text)]',
                            },
                            {
                              status: 'watching',
                              label: 'Watching',
                              className:
                                'border-[var(--accent)]/50 bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25',
                            },
                            {
                              status: 'watched',
                              label: 'Watched',
                              className:
                                'border-[var(--success)]/50 bg-[var(--success)]/15 text-[var(--success)] hover:bg-[var(--success)]/25',
                            },
                          ].map((action) => (
                            <button
                              key={action.status}
                              type="button"
                              disabled={editDisabled}
                              onClick={() => handleAdd(result, action.status)}
                              className={`w-full rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-60 ${action.className}`}
                            >
                              {busy ? 'Adding…' : action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!query.trim() && !entriesLoading && entries.length > 0 && (
            <p className="mt-8 text-sm text-[var(--muted)]">
              {entries.length} title{entries.length === 1 ? '' : 's'} in your library — open the Library tab to
              browse.
            </p>
          )}
          {!query.trim() && !entriesLoading && !entriesError && entries.length === 0 && (
            <p className="mt-8 text-sm text-[var(--muted)]">Your library is empty — search TMDB to add something.</p>
          )}
        </section>

      <div className={view === 'library' ? undefined : 'hidden'} aria-hidden={view !== 'library'}>
        <LibraryView
          entries={entries}
          sections={sections}
          canEdit={authenticated}
          onStatusChange={handleStatusChange}
          onProgressChange={handleProgressChange}
          onRatingChange={handleRatingChange}
          onDelete={handleDelete}
          onSectionChange={handleSectionChange}
          onCreateSection={handleCreateSection}
          onRenameSection={handleRenameSection}
          onDeleteSection={handleDeleteSection}
          onReorderSections={handleReorderSections}
          onReorderEntries={handleReorderEntries}
          busyId={busyId}
        />
      </div>

      <div className={view === 'recs' ? undefined : 'hidden'} aria-hidden={view !== 'recs'}>
        <RecsView
          canEdit={authenticated}
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
      </div>
    </div>
  );
}
