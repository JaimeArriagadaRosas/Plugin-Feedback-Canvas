import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../views/context/AuthContext';
import logger from '../utils/logger';

export function useLogger() {
  const { role, user } = useAuth();
  const location = useLocation();

  const logClick = useCallback((actionName, payload = {}) => {
    logger.info('CLICK', actionName, {
      route: location.pathname,
      role: role || 'guest',
      user: user || 'anon',
      ...payload,
    });
  }, [location.pathname, role, user]);

  const logAction = useCallback((stage, payload = {}) => {
    logger.info('ACTION', stage, {
      route: location.pathname,
      role: role || 'guest',
      user: user || 'anon',
      ...payload,
    });
  }, [location.pathname, role, user]);

  const logError = useCallback((context, error) => {
    logger.error('ERROR', context, {
      route: location.pathname,
      role: role || 'guest',
      user: user || 'anon',
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
  }, [location.pathname, role, user]);

  return { logClick, logAction, logError };
}
