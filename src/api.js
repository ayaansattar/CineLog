async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function searchTmdb(query) {
  return request(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
}

export function getTmdbDetails(mediaType, id) {
  return request(`/api/tmdb/details/${mediaType}/${id}`);
}

export function getEntries(status) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/entries${qs}`);
}

export function createEntry(payload) {
  return request('/api/entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function posterUrl(posterPath, size = 'w342') {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}
