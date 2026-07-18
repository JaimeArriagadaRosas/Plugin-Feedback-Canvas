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

async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Interceptor de autenticación: inyecta el token LTI si existe.
  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    method: options.method || 'GET',
    credentials: 'include',
    ...options,
    headers
  };

  if (config.body !== undefined && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new Error(`Error de red al llamar a ${url}: ${networkError.message}`);
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

  if (!response.ok) {
    const message =
      (data &&
        (data.error?.mensaje ||
          data.mensaje ||
          (typeof data.error === 'string' ? data.error : null) ||
          data.message)) ||
      `Petición a ${url} falló con estado ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  get: (path, options) => apiFetch(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiFetch(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => apiFetch(path, { ...options, method: 'PUT', body }),
  del: (path, options) => apiFetch(path, { ...options, method: 'DELETE' })
};

export { apiFetch };
