const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request(path, { method = 'GET', body, signal, raw = false } = {}) {
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
  return raw ? payload : payload?.data;
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
  featuredEvent: () => api.get('/events/featured', { raw: true }),
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
  ticker: () => api.get('/announcements?ticker=1'),
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
  responses: (params, options) => api.get(`/admin/responses?${new URLSearchParams(params)}`, options),
  /** Plain URL so the browser downloads the file with the admin cookie. */
  responsesCsvUrl: (params) => `${BASE_URL}/api/admin/responses/export.csv?${new URLSearchParams(params)}`,
  storage: () => api.get('/admin/storage'),
  events: () => api.get('/admin/events'),
  event: (id) => api.get(`/admin/events/${encodeURIComponent(id)}`),
  createEvent: (data) => api.post('/admin/events', data),
  updateEvent: (id, data) => api.put(`/admin/events/${encodeURIComponent(id)}`, data),
  deleteEvent: (id) => api.delete(`/admin/events/${encodeURIComponent(id)}`),
};

const enc = encodeURIComponent;

export const couponsApi = {
  status: () => api.get('/coupons/status'),
  openEvents: (linked) => api.get(linked ? `/coupons/events?linked=${enc(linked)}` : '/coupons/events'),
  event: (slug) => api.get(`/coupons/events/${enc(slug)}`),
  register: (slug, payload) => api.post(`/coupons/events/${enc(slug)}/register`, payload),
  coupon: (token) => api.get(`/coupons/c/${enc(token)}`),
};

export const adminCouponsApi = {
  status: () => api.get('/admin/coupons/status'),
  events: () => api.get('/admin/coupons/events'),
  event: (id) => api.get(`/admin/coupons/events/${enc(id)}`),
  createEvent: (data) => api.post('/admin/coupons/events', data),
  updateEvent: (id, data) => api.put(`/admin/coupons/events/${enc(id)}`, data),
  deleteEvent: (id) => api.delete(`/admin/coupons/events/${enc(id)}`),
  createType: (eventId, data) => api.post(`/admin/coupons/events/${enc(eventId)}/types`, data),
  updateType: (id, data) => api.put(`/admin/coupons/types/${enc(id)}`, data),
  saveDesign: (id, design) => api.put(`/admin/coupons/types/${enc(id)}/design`, design),
  deleteType: (id) => api.delete(`/admin/coupons/types/${enc(id)}`),
  registrations: (eventId) => api.get(`/admin/coupons/events/${enc(eventId)}/registrations`),
  addRegistration: (eventId, data) => api.post(`/admin/coupons/events/${enc(eventId)}/registrations`, data),
  setPayment: (id, status, note) => api.put(`/admin/coupons/registrations/${enc(id)}/payment`, { status, note }),
  cancelRegistration: (id, reason) => api.post(`/admin/coupons/registrations/${enc(id)}/cancel`, { reason }),
  resend: (id) => api.post(`/admin/coupons/registrations/${enc(id)}/resend`),
  cancelCoupon: (id, reason) => api.post(`/admin/coupons/coupons/${enc(id)}/cancel`, { reason }),
  reissueCoupon: (id) => api.post(`/admin/coupons/coupons/${enc(id)}/reissue`),
  csvUrl: (eventId) => `${BASE_URL}/api/admin/coupons/events/${enc(eventId)}/export.csv`,
  gateUsers: () => api.get('/admin/coupons/gate-users'),
  createGateUser: (data) => api.post('/admin/coupons/gate-users', data),
  updateGateUser: (id, data) => api.put(`/admin/coupons/gate-users/${enc(id)}`, data),
  resetGatePin: (id, pin) => api.post(`/admin/coupons/gate-users/${enc(id)}/reset-pin`, { pin }),
  deleteGateUser: (id) => api.delete(`/admin/coupons/gate-users/${enc(id)}`),
};

export const scanApi = {
  login: (username, pin) => api.post('/admin/scan/login', { username, pin }),
  logout: () => api.post('/admin/scan/logout'),
  me: () => api.get('/admin/scan/me'),
  events: () => api.get('/admin/scan/events'),
  stats: (eventId) => api.get(`/admin/scan/events/${enc(eventId)}/stats`),
  lookup: (eventId, input) => api.post('/admin/scan/lookup', { eventId, input }),
  checkIn: (eventId, couponId, count) => api.post('/admin/scan/checkin', { eventId, couponId, count }),
  undo: (eventId, checkinId) => api.post('/admin/scan/undo', { eventId, checkinId }),
  markPaid: (eventId, couponId) => api.post('/admin/scan/mark-paid', { eventId, couponId }),
};
