import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';
import logger from '../utils/logger';

export function useAuditLogs(limit = 50) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async () => {
    let retries = 3;
    let delay = 1000;

    setLoading(true);
    setError(null);

    while (retries > 0) {
      try {
        const response = await apiClient.get(`/audit/logs?limit=${limit}`);
        if (response.exito) {
          setLogs(response.data?.logs || []);
          setLoading(false);
          break;
        } else {
          throw new Error(response.error?.mensaje || 'Unknown error');
        }
      } catch (err) {
        if (err.response?.status === 429 && retries > 1) {
          const retryAfter = parseInt(err.response.headers?.['retry-after'] || '0', 10);
          const waitMs = retryAfter > 0 ? retryAfter * 1000 : delay;
          logger.warn('useAuditLogs', `Rate limit exceeded (429). Retrying in ${waitMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          if (!retryAfter) delay *= 2;
          retries--;
        } else {
          logger.error('useAuditLogs', 'Error fetching audit logs', { error: err });
          setError('Could not load audit logs.');
          setLoading(false);
          break;
        }
      }
    }
  }, [limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, fetchLogs };
}
