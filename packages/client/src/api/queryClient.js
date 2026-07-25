import { QueryClient } from '@tanstack/react-query';
import logger from '../utils/logger';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error?.status || error?.response?.status;
        // En entorno de iframes LTI (Canvas LMS), los fallos 401 pueden ser transitorios por bloqueo de cookies/ITP.
        // Permitimos 1 reintento con backoff para revalidar la sesión antes de declarar el error.
        if (status === 400 || status === 403) return false;
        if (status === 401) return failureCount < 1;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
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
