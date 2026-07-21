/**
 * Cliente HTTP centralizado del frontend.
 *
 * Unifica las llamadas `fetch` dispersas en los componentes de `src/vista/`,
 * centralizando la base `/api`, el manejo de JSON y errores, y —vía
 * interceptor— la inyección del token LTI y las credenciales. Esto sustituye
 * al antiguo monkey-patch global de `window.fetch` en main.jsx.
 */
import { getToken } from '../lib/authToken';

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
  if (!isDev) return;
  const ts = new Date().toISOString();
  const prefix = `%c[${ts}] [${level.toUpperCase()}] [ApiClient]`;
  const style = `color: ${level === 'error' ? '#c0392b' : level === 'warn' ? '#b58900' : '#0770a3'}; font-weight: bold;`;
  if (payload !== undefined && payload !== null) {
    console.groupCollapsed(`${prefix} %c${message}`, style, 'color: inherit;');
    console.log(payload);
    console.groupEnd();
  } else {
    console.log(`${prefix} %c${message}`, style, 'color: inherit;');
  }
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

async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const pathForTimeout = path.startsWith('http') ? new URL(path).pathname : path;
  const isLongTimeout = pathForTimeout === '/courses' || pathForTimeout === '/config/me';
  const timeoutMs = options.timeout || (isLongTimeout ? 30000 : 15000);

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

  const t0 = Date.now();
  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    const duration = Date.now() - t0;
    const category = classifyError(null, networkError);
    logApi('error', `${method} ${url} FALLO (${duration}ms)`, {
      requestId,
      category,
      status: networkError.status || null,
      message: networkError.message,
      duration
    });
    throw new ApiError(
      `Error de red al llamar a ${url}: ${networkError.message}`,
      networkError.status || 0,
      { category, requestId },
      category
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  const duration = Date.now() - t0;

  if (!response.ok) {
    const category = classifyError(response.status, null);
    const message =
      (data &&
        (data.error?.mensaje ||
          data.mensaje ||
          (typeof data.error === 'string' ? data.error : null) ||
          data.message)) ||
      `Petición a ${url} falló con estado ${response.status}`;
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
