import { QueryClient } from '@tanstack/react-query';
import logger from '../utils/logger';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error?.status || error?.response?.status;
        // Política Fail-Fast: Rechazar promesas inmediatamente para 401 y 403
        if (status === 401 || status === 403 || status === 400) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex, error) => {
        const status = error?.status || error?.response?.status;
        const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
        if (status === 429) {
          // Exponential Backoff + Jitter para errores 429 (Too Many Requests)
          const jitter = Math.random() * 1000;
          return baseDelay + jitter;
        }
        return baseDelay;
      },
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
    mutations: {
      retry: (failureCount, error) => {
        const status = error?.status || error?.response?.status;
        if (status >= 400 && status < 500) return false;
        return failureCount < 1;
      }
    }
  },
});
