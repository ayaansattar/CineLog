function parseGenres(genres) {
  if (!genres) return null;
  if (Array.isArray(genres)) return genres;
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeEntry(entry) {
  if (!entry) return entry;
  return {
    ...entry,
    genres: parseGenres(entry.genres),
  };
}

export function serializeEntries(entries) {
  return entries.map(serializeEntry);
}

export function storeGenres(genres) {
  if (!genres) return null;
  if (typeof genres === 'string') return genres;
  return JSON.stringify(genres);
}
