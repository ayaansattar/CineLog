export default function FloatingBar({
  visible,
  view,
  views,
  onViewChange,
  query,
  onQueryChange,
}) {
  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 transition duration-300 ease-out ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none -translate-y-full opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <div className="border-b border-[var(--border)] bg-[var(--bg)]/90 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-6 lg:px-8">
          <nav className="flex shrink-0 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs transition sm:px-4 sm:text-sm ${
                  view === item.id
                    ? 'bg-[var(--accent)] text-[#1a1208]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => {
              if (view !== 'search') onViewChange('search');
            }}
            placeholder="Search TMDB…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
