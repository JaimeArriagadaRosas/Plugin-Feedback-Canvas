import { useCallback } from 'react';
import { useLogger } from './useLogger';

export function useButtonLogger() {
  const { logClick, logError } = useLogger();

  return useCallback((actionName, originalHandler) => {
    return async (event) => {
      logClick(actionName);
      try {
        if (typeof originalHandler === 'function') {
          await originalHandler(event);
        }
      } catch (error) {
        logError(`BUTTON_HANDLER_FAILED: ${actionName}`, error);
        throw error;
      }
    };
  }, [logClick, logError]);
}
