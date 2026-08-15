import { QueryClient } from '@tanstack/react-query';
import logger from '../utils/logger';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error?.status || error?.response?.status;
        // Fail-Fast Policy: Reject promises immediately for 401 and 403
        if (status === 401 || status === 403 || status === 400) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex, error) => {
        const status = error?.status || error?.response?.status;
        const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
        if (status === 429) {
          // Exponential Backoff + Jitter for 429 errors (Too Many Requests)
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
