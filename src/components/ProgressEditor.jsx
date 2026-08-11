import { useEffect, useState } from 'react';

function formatProgressLabel(entry) {
  if (entry.mediaType === 'tv') {
    const s = entry.currentSeason;
    const e = entry.currentEpisode;
    if (s == null && e == null) return null;
    return `S${s ?? '?'}E${e ?? '?'}`;
  }
  if (entry.progressMark) return entry.progressMark;
  return null;
}

export { formatProgressLabel };

export default function ProgressEditor({ entry, disabled, onSave }) {
  const [season, setSeason] = useState(entry.currentSeason ?? 1);
  const [episode, setEpisode] = useState(entry.currentEpisode ?? 1);
  const [mark, setMark] = useState(entry.progressMark ?? '');

  useEffect(() => {
    setSeason(entry.currentSeason ?? 1);
    setEpisode(entry.currentEpisode ?? 1);
    setMark(entry.progressMark ?? '');
  }, [entry.id, entry.currentSeason, entry.currentEpisode, entry.progressMark]);

  if (entry.mediaType === 'tv') {
    return (
      <div className="space-y-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2">
        <div className="flex items-center gap-1.5">
          <label className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-[var(--muted)]">
            S
            <input
              type="number"
              min={1}
              value={season}
              disabled={disabled}
              onChange={(e) => setSeason(Number(e.target.value) || 1)}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-[var(--muted)]">
            E
            <input
              type="number"
              min={1}
              value={episode}
              disabled={disabled}
              onChange={(e) => setEpisode(Number(e.target.value) || 1)}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSave({ currentSeason: season, currentEpisode: episode })}
            className="flex-1 rounded border border-[var(--border)] px-2 py-1 text-[11px] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onSave({
                currentSeason: season,
                currentEpisode: Number(episode) + 1,
              })
            }
            className="flex-1 rounded bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-[#1a1208] hover:bg-[var(--accent-dim)] disabled:opacity-60"
          >
            Next ep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2">
      <input
        type="text"
        value={mark}
        disabled={disabled}
        onChange={(e) => setMark(e.target.value)}
        placeholder="Left at 1:23:45…"
        className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSave({ progressMark: mark.trim() || null })}
        className="w-full rounded bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-[#1a1208] hover:bg-[var(--accent-dim)] disabled:opacity-60"
      >
        Save mark
      </button>
    </div>
  );
}
