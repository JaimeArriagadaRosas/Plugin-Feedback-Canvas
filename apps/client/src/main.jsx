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

import '@/tokens/theme.css';
import './styles/global.css';
import './styles/mixins.css';
import { captureTokenFromUrl, getToken, setSessionToken, isIframe } from '@/lib/authToken';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import App from './app/App';
import ErrorBoundary from './app/ErrorBoundary';
import logger, { setLoggerContextProvider } from './utils/logger';

captureTokenFromUrl();



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
