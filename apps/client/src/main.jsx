/**
 * main.jsx — Frontend entry point.
 *
 * Single responsibility: capture the startup LTI token, import global
 * styles and mount the app inside the ErrorBoundary.
 *
 * The logic that used to live here was moved to dedicated modules:
 *   - Logger .................. lib/logger.js
 *   - Token LTI / iframe ...... lib/authToken.js
 *   - HTTP token injection .... api/apiClient.js (interceptor, no longer monkey-patch)
 *   - Router and providers .... app/App.jsx
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

logger.info('Main', 'LTI token captured. Mounting React application.', {
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
