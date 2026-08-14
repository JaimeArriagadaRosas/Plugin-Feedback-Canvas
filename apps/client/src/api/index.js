/**
 * Centralized frontend HTTP client.
 *
 * Unifies scattered `fetch` calls in `src/views/` components,
 * centralizing the `/api` base, JSON parsing, error handling, and —via
 * interceptor— LTI token and credentials injection. This replaces
 * the old global `window.fetch` monkey-patch in main.jsx.
 */
import { getToken } from '../lib/authToken';
import logger from '../utils/logger';

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const BASE = '/api';
const isDev = import.meta.env.DEV;

function classifyError(status, error) {
  if (status === 401) return 'auth';
  if (status === 403) return 'permission';
  if (status === 408 || status === 429) return 'timeout';
  if (status >= 500) return 'server';
  if (error) {
    if (error.name === 'AbortError') return 'timeout';
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) return 'network';
  }
  return 'unknown';
}

function logApi(level, message, payload) {
  logger[level]('ApiClient', message, payload);
}

export class ApiError extends Error {
  constructor(message, status, payload = null, category = 'unknown') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.category = category;
  }
}

function handleTokenRefresh(response, data) {
  if (response.status === 401 && data?.error?.requireOAuth && data?.error?.oauthUrl) {
    logApi('warn', `Session requires OAuth. Redirecting to ${data.error.oauthUrl}`);
    if (typeof window !== 'undefined') {
      window.location.href = data.error.oauthUrl;
    }
    return new Promise(() => {});
  }
  return null;
}

async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'PluginFeedbackApp/1.0',
    ...(options.headers || {})
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = generateUUID();
  }

  const pathForTimeout = path.startsWith('http') ? new URL(path).pathname : path;
  const isLongTimeout = pathForTimeout === '/courses' || pathForTimeout === '/config/me' || pathForTimeout.includes('/history');
  const isExtraLongTimeout = pathForTimeout.includes('/generate') || pathForTimeout.includes('/generate-all');
  const timeoutMs = options.timeout || (isExtraLongTimeout ? 60000 : (isLongTimeout ? 30000 : 15000));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort());
    }
  }

  logApi('debug', `${method} ${url}`, {
    requestId,
    tokenPresent: !!token,
    hasAuthHeader: !!headers.Authorization,
    timeoutMs,
    path: pathForTimeout
  });

  const config = {
    method: options.method || 'GET',
    credentials: 'include',
    ...options,
    headers,
    signal: controller.signal
  };

  if (config.body !== undefined && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  let response;
  let data = null;
  const t0 = Date.now();
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    const duration = Date.now() - t0;
    const category = classifyError(null, networkError);
    logApi('error', `${method} ${url} FAILED (${duration}ms)`, {
      requestId,
      category,
      status: networkError.status || null,
      message: networkError.message,
      duration
    });
    clearTimeout(timeoutId);
    throw new ApiError(
      `Network error calling ${url}: ${networkError.message}`,
      networkError.status || 0,
      { category, requestId },
      category
    );
  }
  clearTimeout(timeoutId);

  if (options.responseType === 'blob') {
    data = await response.blob();
  } else if (options.responseType === 'arraybuffer') {
    data = await response.arrayBuffer();
  } else {
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
  }

  const duration = Date.now() - t0;

  if (!response.ok) {
    const category = classifyError(response.status, null);
    
    const refreshResult = handleTokenRefresh(response, data);
    if (refreshResult) return refreshResult;

    const message =
      (data &&
        (data.error?.mensaje ||
          data.mensaje ||
          (typeof data.error === 'string' ? data.error : null) ||
          data.message)) ||
      `Request to ${url} failed with status ${response.status}`;
    logApi('error', `${method} ${url} -> ${response.status} (${duration}ms)`, {
      requestId,
      category,
      status: response.status,
      message,
      apiMessage: data?.error?.mensaje || data?.mensaje || null,
      duration
    });
    throw new ApiError(message, response.status, { ...(data?.error || data), category, requestId }, category);
  }

  logApi('info', `${method} ${url} -> ${response.status} (${duration}ms)`, {
    requestId,
    category: 'success',
    status: response.status,
    duration,
    dataKeys: data && typeof data === 'object' ? Object.keys(data) : null
  });

  return data;
}

export const api = {
  get: (path, options) => apiFetch(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiFetch(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => apiFetch(path, { ...options, method: 'PUT', body }),
  del: (path, options) => apiFetch(path, { ...options, method: 'DELETE' })
};

export { apiFetch };
