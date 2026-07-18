const TOKEN_KEY = 'lti_token';

let memoryToken = null;

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
    console.warn('localStorage no disponible (posible iframe cross-origin)');
  }
}

export function getToken() {
  return memoryToken || safeGetLocalStorage(TOKEN_KEY);
}

export function setToken(token) {
  memoryToken = token;
  safeSetLocalStorage(TOKEN_KEY, token);
}

export function captureTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get(TOKEN_KEY);

  if (tokenFromUrl) {
    setToken(tokenFromUrl);
    params.delete(TOKEN_KEY);
    const newUrl =
      window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, document.title, newUrl);
    console.info('Token LTI capturado desde URL.');
  }

  if (isIframe && safeGetLocalStorage(TOKEN_KEY) === 'dev-token') {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    console.info('Ejecución en iframe detectada. dev-token eliminado de localStorage.');
  }
}

export async function logout() {
  try {
    await fetch('/api/auth/lti-logout', { method: 'POST', credentials: 'include' });
  } catch (e) {
    console.warn('[Auth] No se pudo notificar logout al backend:', e?.message);
  } finally {
    memoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
}

export default { isIframe, getToken, setToken, captureTokenFromUrl, logout };