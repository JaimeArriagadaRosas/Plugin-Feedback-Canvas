/**
 * main.jsx — Punto de entrada del frontend.
 *
 * Responsabilidad única: capturar el token LTI de arranque, importar los
 * estilos globales y montar la app dentro del ErrorBoundary.
 *
 * La lógica que antes vivía aquí se movió a módulos dedicados:
 *   - Logger .................. lib/logger.js
 *   - Token LTI / iframe ...... lib/authToken.js
 *   - Inyección de token HTTP . api/apiClient.js (interceptor, ya no monkey-patch)
 *   - Router y providers ...... app/App.jsx
 *   - ErrorBoundary ........... app/ErrorBoundary.jsx
 */
import ReactDOM from 'react-dom/client';

import 'shared/tokens/theme.css';
import './styles/global.css';
import './styles/mixins.css';
import { captureTokenFromUrl, getToken, setSessionToken, isIframe } from 'shared/lib/authToken';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import App from './app/App';
import ErrorBoundary from './app/ErrorBoundary';
import logger, { setLoggerContextProvider } from './utils/logger';

captureTokenFromUrl();

if (!getToken()) {
  try {
    const match = document.cookie.match(/(?:^|; )lti-token=([^;]+)/);
    if (match) {
      const cookieToken = decodeURIComponent(match[1]);
      if (cookieToken) {
        import('shared/lib/authToken').then(({ setToken }) => setToken(cookieToken));
        logger.info('Main', 'Token LTI recuperado desde cookie ltit-token.');
      }
    }
  } catch {
    // Cookie no accesible (cross-origin o bloqueada)
  }
}

if (!getToken()) {
  try {
    const match = document.cookie.match(/(?:^|; )session-token=([^;]+)/);
    if (match) {
      const cookieToken = decodeURIComponent(match[1]);
      if (cookieToken) {
        import('shared/lib/authToken').then(({ setSessionToken }) => setSessionToken(cookieToken));
        logger.info('Main', 'Session token recuperado desde cookie.');
      }
    }
  } catch {
    // Cookie no accesible (cross-origin o bloqueada)
  }
}

setLoggerContextProvider(() => ({
  route: window.location.pathname,
  ltiTokenPresent: !!getToken(),
  isIframe,
  timestampISO: new Date().toISOString()
}));

logger.info('Main', 'Token LTI capturado. Montando aplicación React.', {
  tokenPresent: !!getToken(),
  isIframe
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>
);
