const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'We could not reach the server. Please check your connection.');
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const e = payload?.error || {};
    throw new ApiError(res.status, e.code || 'HTTP_ERROR', e.message || 'Something went wrong.', e.fields);
  }
  return payload?.data;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

/** Typed-ish service functions — the only place that knows API paths. */
export const contentApi = {
  site: () => api.get('/site'),
  events: (status) => api.get(status ? `/events?status=${encodeURIComponent(status)}` : '/events'),
  event: (slug) => api.get(`/events/${encodeURIComponent(slug)}`),
  gallery: () => api.get('/gallery'),
  committee: () => api.get('/committee'),
  support: () => api.get('/support'),
};

export const inquiryApi = {
  submit: (payload) => api.post('/inquiries', payload),
};

export const announcementsApi = {
  list: (limit) => api.get(limit ? `/announcements?limit=${limit}` : '/announcements'),
  get: (slug) => api.get(`/announcements/${encodeURIComponent(slug)}`),
};

export const adminApi = {
  login: (username, password) => api.post('/admin/login', { username, password }),
  logout: () => api.post('/admin/logout'),
  me: () => api.get('/admin/me'),
  announcements: () => api.get('/admin/announcements'),
  announcement: (id) => api.get(`/admin/announcements/${encodeURIComponent(id)}`),
  createAnnouncement: (data) => api.post('/admin/announcements', data),
  updateAnnouncement: (id, data) => api.put(`/admin/announcements/${encodeURIComponent(id)}`, data),
  deleteAnnouncement: (id) => api.delete(`/admin/announcements/${encodeURIComponent(id)}`),
  uploadImage: (dataUrl) => api.post('/admin/uploads', { dataUrl }),
};
