import { AsyncLocalStorage } from 'node:async_hooks';

export const tenantContext = new AsyncLocalStorage();

/**
 * Middleware que extrae el identificador del usuario (profesor) del contexto LTI
 * y lo inyecta en el AsyncLocalStorage para aislar las consultas a Base de Datos (RLS).
 */
export const tenantMiddleware = (req, res, next) => {
  // El contexto LTI normalmente lo setea AuthLTI13Handler.js o similares
  const ltiUser = req.ltiContext?.user || req.user?.sub || null;
  
  if (ltiUser) {
    tenantContext.run(ltiUser, () => {
      next();
    });
  } else {
    // Si no hay usuario LTI identificado, se ejecuta sin contexto de tenant
    next();
  }
};
