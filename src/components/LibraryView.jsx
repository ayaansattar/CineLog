import { useMemo, useState } from 'react';
import Poster from './Poster';
import ProgressEditor, { formatProgressLabel } from './ProgressEditor';

const TABS = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watching', label: 'Watching' },
  { id: 'watched', label: 'Watched' },
];

const STATUS_ACTIONS = {
  watchlist: [
    { status: 'watching', label: 'Start watching' },
    { status: 'watched', label: 'Mark watched' },
  ],
  watching: [
    { status: 'watched', label: 'Mark watched' },
    { status: 'watchlist', label: 'Back to watchlist' },
  ],
  watched: [
    { status: 'watching', label: 'Rewatch' },
    { status: 'watchlist', label: 'Back to watchlist' },
  ],
};

function sortEntries(entries, sortBy) {
  const list = [...entries];
  switch (sortBy) {
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case 'rating':
      return list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title));
    case 'watchedAt':
      return list.sort((a, b) => {
        const aTime = a.watchedAt ? new Date(a.watchedAt).getTime() : 0;
        const bTime = b.watchedAt ? new Date(b.watchedAt).getTime() : 0;
        return bTime - aTime;
      });
    case 'progressUpdatedAt':
      return list.sort((a, b) => {
        const aTime = a.progressUpdatedAt ? new Date(a.progressUpdatedAt).getTime() : 0;
        const bTime = b.progressUpdatedAt ? new Date(b.progressUpdatedAt).getTime() : 0;
        return bTime - aTime;
      });
    case 'addedAt':
    default:
      return list.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  }
}

export default function LibraryView({ entries, onStatusChange, onProgressChange, onDelete, busyId }) {
  const [tab, setTab] = useState('watchlist');
  const [mediaType, setMediaType] = useState('all');
  const [genre, setGenre] = useState('all');
  const [sortBy, setSortBy] = useState('addedAt');

  const counts = useMemo(() => {
    return TABS.reduce((acc, t) => {
      acc[t.id] = entries.filter((e) => e.status === t.id).length;
      return acc;
    }, {});
  }, [entries]);

  const genres = useMemo(() => {
    const set = new Set();
    for (const entry of entries) {
      if (Array.isArray(entry.genres)) {
        for (const g of entry.genres) set.add(g);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries.filter((e) => e.status === tab);
    if (mediaType !== 'all') list = list.filter((e) => e.mediaType === mediaType);
    if (genre !== 'all') {
      list = list.filter((e) => Array.isArray(e.genres) && e.genres.includes(genre));
    }
    const effectiveSort = tab === 'watching' && sortBy === 'addedAt' ? 'progressUpdatedAt' : sortBy;
    return sortEntries(list, effectiveSort);
  }, [entries, tab, mediaType, genre, sortBy]);

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-['Instrument_Serif'] text-3xl sm:text-4xl">Library</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {entries.length} title{entries.length === 1 ? '' : 's'} saved
          </p>
        </div>

        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setSortBy(t.id === 'watching' ? 'progressUpdatedAt' : 'addedAt');
              }}
              className={`rounded-md px-3 py-2 text-sm transition sm:px-4 ${
                tab === t.id
                  ? 'bg-[var(--accent)] text-[#1a1208]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[t.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Type</span>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All</option>
            <option value="movie">Movies</option>
            <option value="tv">TV</option>
          </select>
        </label>

        <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Genre</span>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="addedAt">Date added</option>
            <option value="title">Title</option>
            {tab === 'watching' && <option value="progressUpdatedAt">Recently updated</option>}
            {tab === 'watched' && (
              <>
                <option value="rating">Rating</option>
                <option value="watchedAt">Date watched</option>
              </>
            )}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[var(--muted)]">
          {tab === 'watching'
            ? 'Nothing in progress — move a title here from Watchlist when you start it.'
            : tab === 'watched'
              ? 'No watched titles yet.'
              : 'Watchlist is empty — search TMDB to add something.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((entry) => {
            const busy = busyId === entry.id;
            const progressLabel = formatProgressLabel(entry);
            const showProgressEditor = entry.status === 'watching';

            return (
              <li
                key={entry.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]"
              >
                <div className="relative">
                  <Poster path={entry.posterPath} title={entry.title} className="aspect-[2/3] w-full" />
                  {progressLabel && (
                    <span className="absolute bottom-2 left-2 max-w-[90%] truncate rounded bg-black/75 px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                      {progressLabel}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex-1">
                    <h3 className="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {entry.year ?? '—'} · {entry.mediaType === 'tv' ? 'TV' : 'Movie'}
                      {entry.rating != null ? ` · ${entry.rating}★` : ''}
                    </p>
                  </div>

                  {showProgressEditor && (
                    <ProgressEditor
                      entry={entry}
                      disabled={busy}
                      onSave={(progress) => onProgressChange(entry.id, progress)}
                    />
                  )}

                  <div className="flex flex-col gap-1.5">
                    {(STATUS_ACTIONS[entry.status] || []).map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        disabled={busy}
                        onClick={() => onStatusChange(entry.id, action.status)}
                        className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
                      >
                        {action.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(entry.id)}
                      className="w-full rounded-md px-2 py-1.5 text-xs text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
