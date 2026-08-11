async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
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

export function getAuthStatus() {
  return request('/api/auth/me');
}

export function login(password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function logout() {
  return request('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });
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

export function updateEntry(id, payload) {
  return request(`/api/entries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function reorderEntries(sectionId, ids) {
  return request('/api/entries/reorder', {
    method: 'PUT',
    body: JSON.stringify({ sectionId, ids }),
  });
}

export function deleteEntry(id) {
  return request(`/api/entries/${id}`, {
    method: 'DELETE',
  });
}

export function getRecommendations(query, source = 'auto') {
  return request('/api/recs', {
    method: 'POST',
    body: JSON.stringify({ query, source }),
  });
}

export function getSections(mediaType) {
  const qs = mediaType ? `?mediaType=${encodeURIComponent(mediaType)}` : '';
  return request(`/api/sections${qs}`);
}

export function createSection(name, mediaType) {
  return request('/api/sections', {
    method: 'POST',
    body: JSON.stringify({ name, mediaType }),
  });
}

export function updateSection(id, payload) {
  return request(`/api/sections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function reorderSections(ids, mediaType) {
  return request('/api/sections/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids, mediaType }),
  });
}

export function deleteSection(id) {
  return request(`/api/sections/${id}`, {
    method: 'DELETE',
  });
}

export function posterUrl(posterPath, size = 'w342') {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}
