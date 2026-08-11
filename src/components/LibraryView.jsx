import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import Poster from './Poster';
import PosterWithSummary, { GenreLine } from './PosterWithSummary';
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

function sortBySectionOrder(entries, sortBy) {
  const secondary = sortEntries(entries, sortBy);
  return secondary.sort((a, b) => {
    const ao = a.sectionOrder ?? 0;
    const bo = b.sectionOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return 0;
  });
}

function entryDragId(id) {
  return `entry:${id}`;
}

function parseEntryDragId(id) {
  const raw = String(id || '');
  return raw.startsWith('entry:') ? raw.slice(6) : null;
}

function headingDragId(id) {
  return `heading:${id}`;
}

function parseHeadingDragId(id) {
  const raw = String(id || '');
  return raw.startsWith('heading:') ? raw.slice(8) : null;
}

function containerDropId(sectionId) {
  return sectionId ? `drop-section:${sectionId}` : 'drop-section:unsorted';
}

function parseContainerDropId(id) {
  const raw = String(id || '');
  if (!raw.startsWith('drop-section:')) return undefined;
  const key = raw.slice('drop-section:'.length);
  return key === 'unsorted' ? null : key;
}

function beforeDropId(entryId) {
  return `drop-before:${entryId}`;
}

function parseBeforeDropId(id) {
  const raw = String(id || '');
  return raw.startsWith('drop-before:') ? raw.slice('drop-before:'.length) : null;
}

function stopDragInterference(e) {
  e.stopPropagation();
}

function EntryCard({
  entry,
  sectionId,
  sections,
  canEdit,
  canDrag,
  busy,
  onStatusChange,
  onProgressChange,
  onRatingChange,
  onDelete,
  onSectionChange,
  onDetailsLoaded,
}) {
  const progressLabel = entry.status === 'watching' ? formatProgressLabel(entry) : null;
  const showProgressEditor = canEdit && entry.status === 'watching';
  const editDisabled = busy || !canEdit;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: entryDragId(entry.id),
    disabled: !canDrag || busy,
    data: { type: 'entry', entryId: entry.id, sectionId },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: beforeDropId(entry.id),
    disabled: !canDrag,
    data: { type: 'before', entryId: entry.id, sectionId },
  });

  return (
    <li
      ref={canDrag ? setDropRef : undefined}
      className={`relative flex flex-col overflow-hidden rounded-xl border bg-[var(--bg-elevated)] ${
        isDragging ? 'opacity-30' : ''
      } ${isOver ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : 'border-[var(--border)]'}`}
    >
      {canDrag && !busy && (
        <button
          ref={setDragRef}
          type="button"
          className="absolute top-2 right-2 z-20 cursor-grab rounded-md border border-[var(--border)] bg-black/75 px-2 py-1 text-[11px] leading-none text-[var(--text)] active:cursor-grabbing"
          aria-label={`Drag ${entry.title}`}
          {...listeners}
          {...attributes}
        >
          ⋮⋮
        </button>
      )}

      <PosterWithSummary
        path={entry.posterPath}
        title={entry.title}
        overview={entry.overview}
        genres={entry.genres}
        mediaType={entry.mediaType}
        tmdbId={entry.tmdbId}
        entryId={entry.id}
        onDetailsLoaded={onDetailsLoaded}
        footerBadge={
          progressLabel ? (
            <span className="absolute bottom-2 left-2 z-[1] max-w-[90%] truncate rounded bg-black/75 px-2 py-0.5 text-[11px] font-medium text-[var(--accent)] group-hover:opacity-0">
              {progressLabel}
            </span>
          ) : null
        }
      />

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {entry.year ?? '—'} · {entry.mediaType === 'tv' ? 'TV' : 'Movie'}
          </p>
          <GenreLine genres={entry.genres} className="mt-1" />
          <div className="mt-2" onPointerDown={stopDragInterference}>
            <StarRating
              value={entry.rating}
              disabled={editDisabled}
              onChange={(rating) => onRatingChange(entry.id, rating)}
            />
          </div>
        </div>

        {showProgressEditor && (
          <div onPointerDown={stopDragInterference}>
            <ProgressEditor
              entry={entry}
              disabled={editDisabled}
              onSave={(progress) => onProgressChange(entry.id, progress)}
            />
          </div>
        )}

        {canEdit ? (
          <div className="flex flex-col gap-1.5" onPointerDown={stopDragInterference}>
            {canDrag && (
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Heading
                </span>
                <select
                  value={entry.sectionId || ''}
                  disabled={editDisabled}
                  onChange={(e) => onSectionChange(entry.id, e.target.value || null)}
                  className="relative z-20 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
                >
                  <option value="">No heading</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
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

function SectionBlock({
  sectionId,
  title,
  section,
  entries,
  sections,
  canEdit,
  canDrag,
  editing,
  editingName,
  setEditingName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteHeading,
  busyId,
  onStatusChange,
  onProgressChange,
  onRatingChange,
  onDelete,
  onSectionChange,
  onDetailsLoaded,
}) {
  const { attributes, listeners, setNodeRef: setHeadingDragRef, isDragging } = useDraggable({
    id: section ? headingDragId(section.id) : 'heading:noop',
    disabled: !canDrag || !section,
    data: { type: 'heading', sectionId: section?.id ?? null },
  });

  const { setNodeRef: setSectionDropRef, isOver: isOverSection } = useDroppable({
    id: containerDropId(sectionId),
    disabled: !canDrag,
    data: { type: 'section', sectionId },
  });

  return (
    <div
      ref={canDrag ? setSectionDropRef : undefined}
      className={`rounded-xl transition ${
        canDrag && isOverSection ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : ''
      }`}
    >
      {title != null && (
        <div
          className={`mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-2 ${
            isDragging ? 'opacity-40' : ''
          }`}
        >
          {editing && section ? (
            <form
              className="flex flex-1 flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onSaveEdit();
              }}
              onPointerDown={stopDragInterference}
            >
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                className="min-w-[10rem] flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 font-['Instrument_Serif'] text-2xl text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <button type="submit" className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[#1a1208]">
                Save
              </button>
              <button type="button" onClick={onCancelEdit} className="text-xs text-[var(--muted)] hover:text-[var(--text)]">
                Cancel
              </button>
            </form>
          ) : (
            <>
              {canDrag && section && (
                <button
                  ref={setHeadingDragRef}
                  type="button"
                  className="cursor-grab rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] active:cursor-grabbing"
                  aria-label={`Drag heading ${section.name}`}
                  {...listeners}
                  {...attributes}
                >
                  ⋮⋮
                </button>
              )}
              <h3 className="font-['Instrument_Serif'] text-2xl tracking-tight text-[var(--text)] sm:text-3xl">
                {title}
              </h3>
              <span className="text-sm tabular-nums text-[var(--muted)]">{entries.length}</span>
              {canDrag && section && (
                <div className="ml-auto flex items-center gap-2" onPointerDown={stopDragInterference}>
                  <button
                    type="button"
                    onClick={onStartEdit}
                    className="text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteHeading}
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

      {entries.length === 0 ? (
        <p
          className={`rounded-lg border border-dashed px-4 py-8 text-center text-sm ${
            canDrag && isOverSection
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--muted)]'
          }`}
        >
          {canDrag ? 'Drop titles here' : 'No titles here'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              sectionId={sectionId}
              sections={sections}
              canEdit={canEdit}
              canDrag={canDrag}
              busy={busyId === entry.id}
              onStatusChange={onStatusChange}
              onProgressChange={onProgressChange}
              onRatingChange={onRatingChange}
              onDelete={onDelete}
              onSectionChange={onSectionChange}
              onDetailsLoaded={onDetailsLoaded}
            />
          ))}
        </ul>
      )}
    </div>
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
  onReorderEntries,
  onDetailsLoaded,
  busyId,
}) {
  const [tab, setTab] = useState('watchlist');
  const [mediaType, setMediaType] = useState('movie');
  const [genre, setGenre] = useState('all');
  const [headingFilter, setHeadingFilter] = useState('all');
  const [sortBy, setSortBy] = useState('addedAt');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [newHeading, setNewHeading] = useState('');
  const [addingHeading, setAddingHeading] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [active, setActive] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
  );

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

  const effectiveSort = tab === 'watching' && sortBy === 'addedAt' ? 'progressUpdatedAt' : sortBy;
  const canDrag = canEdit && tab !== 'watched';
  const mediaSections = useMemo(
    () => sections.filter((s) => s.mediaType === mediaType),
    [sections, mediaType],
  );

  const filtered = useMemo(() => {
    let list = entries.filter((e) => e.status === tab && e.mediaType === mediaType);
    if (genre !== 'all') {
      list = list.filter((e) => Array.isArray(e.genres) && e.genres.includes(genre));
    }
    if (tab !== 'watched') {
      if (headingFilter === 'unsorted') {
        list = list.filter((e) => !e.sectionId || !mediaSections.some((s) => s.id === e.sectionId));
      } else if (headingFilter !== 'all') {
        list = list.filter((e) => e.sectionId === headingFilter);
      }
    }
    const q = libraryQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const title = String(e.title || '').toLowerCase();
        const year = e.year != null ? String(e.year) : '';
        const genreText = Array.isArray(e.genres) ? e.genres.join(' ').toLowerCase() : '';
        return title.includes(q) || year.includes(q) || genreText.includes(q);
      });
    }
    // Watched is filter/browse only — ignore manual section order and use chosen sort.
    if (tab === 'watched') return sortEntries(list, effectiveSort);
    return sortBySectionOrder(list, effectiveSort);
  }, [entries, tab, mediaType, genre, headingFilter, mediaSections, libraryQuery, effectiveSort]);

  const groups = useMemo(() => {
    if (tab === 'watched') {
      return [
        {
          key: 'watched-flat',
          section: null,
          title: null,
          sectionId: null,
          entries: filtered,
        },
      ];
    }

    const byId = new Map(mediaSections.map((s) => [s.id, []]));
    const unsorted = [];
    const searching = Boolean(libraryQuery.trim());
    const filteringHeadings = headingFilter !== 'all';

    for (const entry of filtered) {
      if (entry.sectionId && byId.has(entry.sectionId)) {
        byId.get(entry.sectionId).push(entry);
      } else {
        unsorted.push(entry);
      }
    }

    const ordered = mediaSections
      .map((section) => ({
        key: section.id,
        section,
        title: section.name,
        sectionId: section.id,
        entries: sortBySectionOrder(byId.get(section.id) || [], effectiveSort),
      }))
      .filter((group) => group.entries.length > 0 || (canDrag && !searching && !filteringHeadings));

    if (unsorted.length > 0 || (canDrag && mediaSections.length > 0 && !searching && !filteringHeadings)) {
      ordered.push({
        key: 'unsorted',
        section: null,
        title: mediaSections.length ? 'Unsorted' : null,
        sectionId: null,
        entries: sortBySectionOrder(unsorted, effectiveSort),
      });
    }

    return ordered;
  }, [filtered, mediaSections, canDrag, libraryQuery, headingFilter, effectiveSort, tab]);

  async function reorderEntry(movingId, targetSectionId, beforeEntryId = null) {
    const allInSection = entries
      .filter((e) => (e.sectionId || null) === targetSectionId && e.id !== movingId)
      .sort(
        (a, b) =>
          (a.sectionOrder ?? 0) - (b.sectionOrder ?? 0) || a.title.localeCompare(b.title),
      )
      .map((e) => e.id);

    let next;
    if (beforeEntryId && allInSection.includes(beforeEntryId)) {
      next = [...allInSection];
      next.splice(next.indexOf(beforeEntryId), 0, movingId);
    } else {
      next = [...allInSection, movingId];
    }

    await onReorderEntries(targetSectionId, next);
  }

  async function handleDragEnd(event) {
    const { active: drag, over } = event;
    setActive(null);
    if (!over || !canDrag) return;

    const dragType = drag.data.current?.type;

    if (dragType === 'heading') {
      const movingSectionId = drag.data.current.sectionId;
      const overSectionId =
        over.data.current?.type === 'heading' || over.data.current?.type === 'section'
          ? over.data.current.sectionId
          : parseHeadingDragId(over.id) || parseContainerDropId(over.id);

      if (!movingSectionId || typeof overSectionId !== 'string') return;
      if (movingSectionId === overSectionId) return;

      const ids = mediaSections.map((s) => s.id);
      const from = ids.indexOf(movingSectionId);
      const to = ids.indexOf(overSectionId);
      if (from < 0 || to < 0 || from === to) return;
      const next = [...ids];
      next.splice(from, 1);
      next.splice(to, 0, movingSectionId);
      await onReorderSections(next, mediaType);
      return;
    }

    if (dragType === 'entry') {
      const movingId = drag.data.current.entryId || parseEntryDragId(drag.id);
      if (!movingId) return;

      let targetSectionId = drag.data.current.sectionId ?? null;
      let beforeId = null;

      if (over.data.current?.type === 'before') {
        targetSectionId = over.data.current.sectionId ?? null;
        beforeId = over.data.current.entryId;
        if (beforeId === movingId) return;
      } else if (over.data.current?.type === 'section' || over.data.current?.type === 'heading') {
        targetSectionId = over.data.current.sectionId ?? null;
      } else {
        const fromBefore = parseBeforeDropId(over.id);
        const fromSection = parseContainerDropId(over.id);
        if (fromBefore) {
          const target = entries.find((e) => e.id === fromBefore);
          if (!target) return;
          targetSectionId = target.sectionId || null;
          beforeId = fromBefore;
        } else if (fromSection !== undefined) {
          targetSectionId = fromSection;
        }
      }

      await reorderEntry(movingId, targetSectionId, beforeId);
    }
  }

  async function submitHeading(e) {
    e.preventDefault();
    const name = newHeading.trim();
    if (!name || addingHeading) return;
    setAddingHeading(true);
    try {
      await onCreateSection(name, mediaType);
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

  const overlayEntry =
    active?.type === 'entry' ? entries.find((e) => e.id === active.entryId) : null;
  const overlayHeading =
    active?.type === 'heading' ? mediaSections.find((s) => s.id === active.sectionId) : null;

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-['Instrument_Serif'] text-3xl sm:text-4xl">Library</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {entries.length} title{entries.length === 1 ? '' : 's'} saved
            {canDrag
              ? ' · Change heading in the dropdown, or drag with the ⋮⋮ handle'
              : tab === 'watched'
                ? ' · Browse with search and filters'
                : ''}
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
                setHeadingFilter('all');
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
              setHeadingFilter('all');
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

        {tab !== 'watched' && (
          <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Heading</span>
            <select
              value={headingFilter}
              onChange={(e) => setHeadingFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All headings</option>
              <option value="unsorted">Unsorted</option>
              {mediaSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

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

      {canDrag && (
        <form onSubmit={submitHeading} className="mb-6 flex flex-wrap items-center gap-2">
          <input
            value={newHeading}
            onChange={(e) => setNewHeading(e.target.value)}
            placeholder={
              mediaType === 'tv'
                ? 'New TV heading (e.g. Comfort rewatches)'
                : 'New movie heading (e.g. Comfort watches)'
            }
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event) => {
            if (!canDrag) return;
            const type = event.active.data.current?.type;
            if (type === 'entry') {
              setActive({ type: 'entry', entryId: event.active.data.current.entryId });
            } else if (type === 'heading') {
              setActive({ type: 'heading', sectionId: event.active.data.current.sectionId });
            }
          }}
          onDragCancel={() => setActive(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-10">
            {groups.map((group) => (
              <SectionBlock
                key={group.key}
                sectionId={group.sectionId}
                title={group.title}
                section={group.section}
                entries={group.entries}
                sections={mediaSections}
                canEdit={canEdit}
                canDrag={canDrag}
                editing={Boolean(canDrag && group.section && editingSectionId === group.section.id)}
                editingName={editingName}
                setEditingName={setEditingName}
                onStartEdit={() => {
                  setEditingSectionId(group.section.id);
                  setEditingName(group.section.name);
                }}
                onSaveEdit={() => saveRename(group.section.id)}
                onCancelEdit={() => setEditingSectionId(null)}
                onDeleteHeading={() => {
                  if (
                    window.confirm(
                      `Delete heading “${group.section.name}”? Titles stay in your library under Unsorted.`,
                    )
                  ) {
                    onDeleteSection(group.section.id);
                  }
                }}
                busyId={busyId}
                onStatusChange={onStatusChange}
                onProgressChange={onProgressChange}
                onRatingChange={onRatingChange}
                onDelete={onDelete}
                onSectionChange={onSectionChange}
                onDetailsLoaded={onDetailsLoaded}
              />
            ))}
          </div>

          {canDrag && (
            <DragOverlay dropAnimation={null}>
              {overlayEntry ? (
                <div className="w-36 overflow-hidden rounded-xl border border-[var(--accent)] bg-[var(--bg-elevated)] shadow-xl">
                  <Poster path={overlayEntry.posterPath} title={overlayEntry.title} className="aspect-[2/3] w-full" />
                  <p className="line-clamp-2 p-2 text-xs font-medium">{overlayEntry.title}</p>
                </div>
              ) : overlayHeading ? (
                <div className="rounded-lg border border-[var(--accent)] bg-[var(--bg-elevated)] px-4 py-2 font-['Instrument_Serif'] text-xl shadow-xl">
                  {overlayHeading.name}
                </div>
              ) : null}
            </DragOverlay>
          )}
        </DndContext>
      )}
    </section>
  );
}
