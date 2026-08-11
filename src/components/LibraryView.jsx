import { useMemo, useState } from 'react';
import Poster from './Poster';
import ProgressEditor, { formatProgressLabel } from './ProgressEditor';
import StarRating from './StarRating';

const STATUS_TABS = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watching', label: 'Watching' },
  { id: 'watched', label: 'Watched' },
];

const MEDIA_TABS = [
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV' },
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

const ENTRY_MIME = 'application/x-cinelog-entry';
const SECTION_MIME = 'application/x-cinelog-section';

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

function hasMime(types, mime) {
  return Array.from(types || []).includes(mime);
}

function EntryCard({
  entry,
  sections,
  canEdit,
  busy,
  dragging,
  onStatusChange,
  onProgressChange,
  onRatingChange,
  onDelete,
  onSectionChange,
  onDragStart,
  onDragEnd,
}) {
  const progressLabel = entry.status === 'watching' ? formatProgressLabel(entry) : null;
  const showProgressEditor = canEdit && entry.status === 'watching';
  const editDisabled = busy || !canEdit;

  return (
    <li
      draggable={canEdit && !busy}
      onDragStart={(e) => onDragStart(e, entry.id)}
      onDragEnd={onDragEnd}
      className={`flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] ${
        canEdit ? 'cursor-grab active:cursor-grabbing' : ''
      } ${dragging ? 'opacity-40' : ''}`}
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
          </p>
          <div className="mt-2">
            <StarRating
              value={entry.rating}
              disabled={editDisabled}
              onChange={(rating) => onRatingChange(entry.id, rating)}
            />
          </div>
        </div>

        {showProgressEditor && (
          <ProgressEditor
            entry={entry}
            disabled={editDisabled}
            onSave={(progress) => onProgressChange(entry.id, progress)}
          />
        )}

        {canEdit ? (
          <div className="flex flex-col gap-1.5">
            <label className="block">
              <span className="sr-only">Heading</span>
              <select
                value={entry.sectionId || ''}
                disabled={editDisabled}
                onChange={(e) => onSectionChange(entry.id, e.target.value || null)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
              >
                <option value="">No heading</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
            {(STATUS_ACTIONS[entry.status] || []).map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={editDisabled}
                onClick={() => onStatusChange(entry.id, action.status)}
                className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
              >
                {action.label}
              </button>
            ))}
            <button
              type="button"
              disabled={editDisabled}
              onClick={() => onDelete(entry.id)}
              className="w-full rounded-md px-2 py-1.5 text-xs text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--muted)]">Log in to edit</p>
        )}
      </div>
    </li>
  );
}

export default function LibraryView({
  entries,
  sections = [],
  canEdit = false,
  onStatusChange,
  onProgressChange,
  onRatingChange,
  onDelete,
  onSectionChange,
  onCreateSection,
  onRenameSection,
  onDeleteSection,
  onReorderSections,
  busyId,
}) {
  const [tab, setTab] = useState('watchlist');
  const [mediaType, setMediaType] = useState('movie');
  const [genre, setGenre] = useState('all');
  const [sortBy, setSortBy] = useState('addedAt');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [newHeading, setNewHeading] = useState('');
  const [addingHeading, setAddingHeading] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [dragKind, setDragKind] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const counts = useMemo(() => {
    return STATUS_TABS.reduce((acc, t) => {
      acc[t.id] = entries.filter((e) => e.status === t.id).length;
      return acc;
    }, {});
  }, [entries]);

  const mediaCounts = useMemo(() => {
    return MEDIA_TABS.reduce((acc, t) => {
      acc[t.id] = entries.filter((e) => e.status === tab && e.mediaType === t.id).length;
      return acc;
    }, {});
  }, [entries, tab]);

  const genres = useMemo(() => {
    const set = new Set();
    for (const entry of entries) {
      if (entry.status !== tab || entry.mediaType !== mediaType) continue;
      if (Array.isArray(entry.genres)) {
        for (const g of entry.genres) set.add(g);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [entries, tab, mediaType]);

  const filtered = useMemo(() => {
    let list = entries.filter((e) => e.status === tab && e.mediaType === mediaType);
    if (genre !== 'all') {
      list = list.filter((e) => Array.isArray(e.genres) && e.genres.includes(genre));
    }
    const q = libraryQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const title = String(e.title || '').toLowerCase();
        const year = e.year != null ? String(e.year) : '';
        const genres = Array.isArray(e.genres) ? e.genres.join(' ').toLowerCase() : '';
        return title.includes(q) || year.includes(q) || genres.includes(q);
      });
    }
    const effectiveSort = tab === 'watching' && sortBy === 'addedAt' ? 'progressUpdatedAt' : sortBy;
    return sortEntries(list, effectiveSort);
  }, [entries, tab, mediaType, genre, sortBy, libraryQuery]);

  const groups = useMemo(() => {
    const byId = new Map(sections.map((s) => [s.id, []]));
    const unsorted = [];
    const searching = Boolean(libraryQuery.trim());

    for (const entry of filtered) {
      if (entry.sectionId && byId.has(entry.sectionId)) {
        byId.get(entry.sectionId).push(entry);
      } else {
        unsorted.push(entry);
      }
    }

    const ordered = sections
      .map((section) => ({
        key: section.id,
        section,
        title: section.name,
        entries: byId.get(section.id) || [],
      }))
      .filter((group) => group.entries.length > 0 || (canEdit && !searching));

    const showUnsorted =
      unsorted.length > 0 || (canEdit && sections.length > 0 && !searching);
    if (showUnsorted) {
      ordered.push({
        key: 'unsorted',
        section: null,
        title: sections.length ? 'Unsorted' : null,
        entries: unsorted,
      });
    }

    return ordered;
  }, [filtered, sections, canEdit, libraryQuery]);

  function clearDrag() {
    setDragKind(null);
    setDragId(null);
    setDropTarget(null);
  }

  function handleEntryDragStart(e, entryId) {
    e.dataTransfer.setData(ENTRY_MIME, entryId);
    e.dataTransfer.setData('text/plain', `entry:${entryId}`);
    e.dataTransfer.effectAllowed = 'move';
    setDragKind('entry');
    setDragId(entryId);
  }

  function handleSectionDragStart(e, sectionId) {
    e.dataTransfer.setData(SECTION_MIME, sectionId);
    e.dataTransfer.setData('text/plain', `section:${sectionId}`);
    e.dataTransfer.effectAllowed = 'move';
    setDragKind('section');
    setDragId(sectionId);
  }

  function allowEntryDrop(e) {
    if (dragKind === 'entry' || hasMime(e.dataTransfer.types, ENTRY_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      return true;
    }
    return false;
  }

  function allowSectionDrop(e) {
    if (dragKind === 'section' || hasMime(e.dataTransfer.types, SECTION_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      return true;
    }
    return false;
  }

  async function dropEntryOn(targetKey, entryId = dragId) {
    if (!entryId) return;
    const sectionId = targetKey === 'unsorted' ? null : targetKey;
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) {
      clearDrag();
      return;
    }
    const current = entry.sectionId || null;
    if (current === sectionId) {
      clearDrag();
      return;
    }
    await onSectionChange(entryId, sectionId);
    clearDrag();
  }

  async function dropSectionBefore(targetSectionId, movingId = dragId) {
    if (!movingId || !targetSectionId || movingId === targetSectionId) {
      clearDrag();
      return;
    }
    const ids = sections.map((s) => s.id);
    const from = ids.indexOf(movingId);
    const to = ids.indexOf(targetSectionId);
    if (from < 0 || to < 0) {
      clearDrag();
      return;
    }
    const next = [...ids];
    next.splice(from, 1);
    const insertAt = next.indexOf(targetSectionId);
    next.splice(insertAt, 0, movingId);
    await onReorderSections(next);
    clearDrag();
  }

  async function submitHeading(e) {
    e.preventDefault();
    const name = newHeading.trim();
    if (!name || addingHeading) return;
    setAddingHeading(true);
    try {
      await onCreateSection(name);
      setNewHeading('');
    } finally {
      setAddingHeading(false);
    }
  }

  async function saveRename(sectionId) {
    const name = editingName.trim();
    if (!name) {
      setEditingSectionId(null);
      return;
    }
    await onRenameSection(sectionId, name);
    setEditingSectionId(null);
  }

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-['Instrument_Serif'] text-3xl sm:text-4xl">Library</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {entries.length} title{entries.length === 1 ? '' : 's'} saved
            {canEdit ? ' · Drag titles onto headings; drag headings to reorder' : ''}
          </p>
        </div>

        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setGenre('all');
                if (t.id === 'watching') setSortBy('progressUpdatedAt');
                else if (t.id === 'watched') setSortBy('rating');
                else setSortBy('addedAt');
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

      <div className="mb-4 flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1 sm:max-w-xs">
        {MEDIA_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setMediaType(t.id);
              setGenre('all');
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm transition ${
              mediaType === t.id
                ? 'bg-[var(--surface)] text-[var(--text)] ring-1 ring-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
            <span className="ml-1.5 tabular-nums opacity-70">{mediaCounts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <label className="flex min-w-[14rem] flex-[2] flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Search library</span>
          <input
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
            placeholder="Title, year, or genre…"
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            autoComplete="off"
          />
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

      {canEdit && (
        <form onSubmit={submitHeading} className="mb-6 flex flex-wrap items-center gap-2">
          <input
            value={newHeading}
            onChange={(e) => setNewHeading(e.target.value)}
            placeholder="New heading (e.g. Comfort watches)"
            className="min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={addingHeading || !newHeading.trim()}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[#1a1208] transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
          >
            {addingHeading ? 'Adding…' : 'Add heading'}
          </button>
        </form>
      )}

      {filtered.length === 0 && groups.every((g) => g.entries.length === 0) ? (
        <p className="text-[var(--muted)]">
          {libraryQuery.trim()
            ? `No ${mediaType === 'tv' ? 'TV shows' : 'movies'} match “${libraryQuery.trim()}” in this view.`
            : tab === 'watching'
              ? `Nothing in progress for ${mediaType === 'tv' ? 'TV' : 'movies'} — move a title here from Watchlist when you start it.`
              : tab === 'watched'
                ? `No watched ${mediaType === 'tv' ? 'TV shows' : 'movies'} yet.`
                : `No ${mediaType === 'tv' ? 'TV shows' : 'movies'} on your watchlist — search TMDB to add something.`}
        </p>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => {
            const groupDropKey = group.section ? group.section.id : 'unsorted';
            const entryDropActive = dragKind === 'entry' && dropTarget === groupDropKey;
            const sectionDropActive =
              dragKind === 'section' && group.section && dropTarget === group.section.id;

            return (
              <div
                key={group.key}
                onDragOver={(e) => {
                  if (allowEntryDrop(e)) setDropTarget(groupDropKey);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setDropTarget((current) => (current === groupDropKey ? null : current));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const entryId = e.dataTransfer.getData(ENTRY_MIME) || (dragKind === 'entry' ? dragId : '');
                  if (entryId) {
                    dropEntryOn(groupDropKey, entryId);
                  }
                }}
                className={`rounded-xl transition ${
                  entryDropActive ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : ''
                }`}
              >
                {group.title != null && (
                  <div
                    draggable={canEdit && Boolean(group.section)}
                    onDragStart={
                      group.section
                        ? (e) => {
                            // Don't start section drag from rename/delete controls
                            if (e.target.closest('button, input, form')) {
                              e.preventDefault();
                              return;
                            }
                            handleSectionDragStart(e, group.section.id);
                          }
                        : undefined
                    }
                    onDragEnd={clearDrag}
                    onDragOver={(e) => {
                      if (group.section && allowSectionDrop(e)) {
                        setDropTarget(group.section.id);
                      } else {
                        allowEntryDrop(e);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const sectionId =
                        e.dataTransfer.getData(SECTION_MIME) || (dragKind === 'section' ? dragId : '');
                      if (group.section && sectionId) {
                        dropSectionBefore(group.section.id, sectionId);
                        return;
                      }
                      const entryId =
                        e.dataTransfer.getData(ENTRY_MIME) || (dragKind === 'entry' ? dragId : '');
                      if (entryId) {
                        dropEntryOn(groupDropKey, entryId);
                      }
                    }}
                    className={`mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-2 ${
                      group.section && canEdit ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${sectionDropActive ? 'border-[var(--accent)] bg-[var(--accent)]/10' : ''}`}
                  >
                    {editingSectionId === group.section?.id ? (
                      <form
                        className="flex flex-1 flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveRename(group.section.id);
                        }}
                      >
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                          className="min-w-[10rem] flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 font-['Instrument_Serif'] text-2xl text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[#1a1208]"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSectionId(null)}
                          className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <h3 className="font-['Instrument_Serif'] text-2xl tracking-tight text-[var(--text)] sm:text-3xl">
                          {group.title}
                        </h3>
                        <span className="text-sm tabular-nums text-[var(--muted)]">{group.entries.length}</span>
                        {canEdit && group.section && (
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSectionId(group.section.id);
                                setEditingName(group.section.name);
                              }}
                              className="text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete heading “${group.section.name}”? Titles stay in your library under Unsorted.`,
                                  )
                                ) {
                                  onDeleteSection(group.section.id);
                                }
                              }}
                              className="text-xs text-[var(--danger)] transition hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {group.entries.length === 0 ? (
                  <p
                    className={`rounded-lg border border-dashed px-4 py-6 text-center text-sm text-[var(--muted)] ${
                      entryDropActive ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)]'
                    }`}
                  >
                    Drop titles here
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {group.entries.map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        sections={sections}
                        canEdit={canEdit}
                        busy={busyId === entry.id}
                        dragging={dragKind === 'entry' && dragId === entry.id}
                        onStatusChange={onStatusChange}
                        onProgressChange={onProgressChange}
                        onRatingChange={onRatingChange}
                        onDelete={onDelete}
                        onSectionChange={onSectionChange}
                        onDragStart={handleEntryDragStart}
                        onDragEnd={clearDrag}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
