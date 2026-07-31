import { AsyncLocalStorage } from 'node:async_hooks';

export const tenantContext = new AsyncLocalStorage();

/**
 * Middleware que extrae el identificador del usuario (profesor) del contexto LTI
 * y lo inyecta en el AsyncLocalStorage para aislar las consultas a Base de Datos (RLS).
 */
export const tenantMiddleware = (req, res, next) => {
  const tenantId = req.appIdentity?.canonicalUserId || 'system';
  tenantContext.run(tenantId, () => {
    next();
  });
};
