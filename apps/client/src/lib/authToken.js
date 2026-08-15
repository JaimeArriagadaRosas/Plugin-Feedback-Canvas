import logger from '../utils/logger';

const TOKEN_KEY = 'lti_token';
const SESSION_TOKEN_KEY = 'session_token';

let memoryToken = null;
let memorySessionToken = null;

export const isIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

function safeGetLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    logger.warn('AuthToken', 'localStorage no disponible (posible iframe cross-origin)');
  }
}

export function getToken() {
  return memorySessionToken || memoryToken || safeGetLocalStorage(TOKEN_KEY);
}

export function setToken(token) {
  memoryToken = token;
  safeSetLocalStorage(TOKEN_KEY, token);
}

export function setSessionToken(token) {
  memorySessionToken = token;
  safeSetLocalStorage(SESSION_TOKEN_KEY, token);
}

export function captureTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get(TOKEN_KEY);
  const sessionTokenFromUrl = params.get(SESSION_TOKEN_KEY);

  if (tokenFromUrl) {
    setToken(tokenFromUrl);
    params.delete(TOKEN_KEY);
  }

  if (sessionTokenFromUrl) {
    setSessionToken(sessionTokenFromUrl);
    params.delete(SESSION_TOKEN_KEY);
  }

  if (tokenFromUrl || sessionTokenFromUrl) {
    const newUrl =
      window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, document.title, newUrl);
  }

  if (isIframe && !import.meta.env.DEV && safeGetLocalStorage(TOKEN_KEY) === 'dev-token') {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    logger.info('AuthToken', 'Ejecución en iframe detectada. dev-token eliminado de localStorage.');
  }
}

export async function logout() {
  try {
    await fetch('/api/auth/lti-logout', { method: 'POST', credentials: 'include' });
  } catch (e) {
    logger.warn('AuthToken', '[Auth] Could not notify backend of logout:', { error: e?.message });
  } finally {
    memoryToken = null;
    memorySessionToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
}

export default { isIframe, getToken, setToken, captureTokenFromUrl, logout };