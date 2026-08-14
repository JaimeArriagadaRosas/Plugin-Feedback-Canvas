import { AsyncLocalStorage } from 'node:async_hooks';

export const tenantContext = new AsyncLocalStorage();

/**
 * Middleware that extracts the user (teacher) identifier from the LTI context
 * and injects it into AsyncLocalStorage to isolate Database queries (RLS).
 */
export const tenantMiddleware = (req, res, next) => {
  const tenantId = req.appIdentity?.canonicalUserId || 'system';
  tenantContext.run(tenantId, () => {
    next();
  });
};
