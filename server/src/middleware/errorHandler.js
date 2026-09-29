import { config } from '../config.js';

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }

  const upstreamStatus = Number(err?.status || err?.statusCode);
  const status =
    err instanceof HttpError ? err.status : upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 500;
  if (status >= 500 && !(err instanceof HttpError)) console.error('[parbon] unhandled error:', err);
  // Rejected admin saves: which fields (names only, never values), so the host's logs show why.
  if (status === 422 && req.originalUrl?.startsWith('/api/admin') && err instanceof HttpError) {
    const fields = Object.keys(err.details || {}).slice(0, 20).join(',') || 'none';
    console.warn(`[parbon][admin] ${req.method} ${req.originalUrl.split('?')[0].slice(0, 120)} rejected (422) fields=${fields}`);
  }

  const body = {
    error: {
      code: err instanceof HttpError ? err.code : status === 404 ? 'NOT_FOUND' : status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
      message: status >= 500 && config.isProduction ? 'Something went wrong. Please try again later.' : err.message,
    },
  };
  if (err instanceof HttpError && err.details) body.error.fields = err.details;
  res.status(status).json(body);
}
