import logger from '../utils/logger.js';

/**
 * Middleware para garantizar idempotencia en peticiones POST/PUT/PATCH.
 * Utiliza un store en memoria (Map) simulando Redis para este entorno local/monolito.
 * Implementa la directiva 2: Garantizar absoluta idempotencia.
 */
class IdempotencyManager {
  constructor() {
    // En producción distribuida, esto debería ser un cliente Redis.
    this.cache = new Map();
    this.TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.cache.clear();
  }

  middleware() {
    return async (req, res, next) => {
      if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
        return next();
      }

      const publicPaths = [
        '/lti/callback', 
        '/lti/login', 
        '/lti/authorize_redirect', 
        '/webhooks/canvas', 
        '/oauth2/canvas/login', 
        '/oauth2/canvas/callback'
      ];
      if (publicPaths.some(p => req.path.endsWith(p) || req.path.includes(p))) {
        return next();
      }

      const idempotencyKey = req.headers['idempotency-key'];
      if (!idempotencyKey) {
        return res.status(400).json({
          exito: false,
          error: {
            mensaje: 'Se requiere la cabecera Idempotency-Key para operaciones de escritura',
            codigo: 400,
            documentacion: 'Genere un UUID v4 único por cada operación distinta'
          }
        });
      }

      const compositeKey = `${req.user?.id || 'anon'}:${req.path}:${idempotencyKey}`;

      if (this.cache.has(compositeKey)) {
        const cachedResponse = this.cache.get(compositeKey);
        
        if (cachedResponse.status === 'processing') {
          logger.warn(`[IDEMPOTENCY] Conflicto de carrera detectado (Race Condition) para key: ${idempotencyKey}`);
          return res.status(409).json({ error: 'La petición ya se está procesando (Race Condition).' });
        }

        logger.info(`[IDEMPOTENCY] Devolviendo respuesta cacheada para key: ${idempotencyKey}`);
        return res.status(cachedResponse.statusCode).json(cachedResponse.body);
      }

      // Marcar como en proceso (bloqueo contra race conditions)
      this.cache.set(compositeKey, { status: 'processing', timestamp: Date.now() });

      // Interceptar res.json y res.send para guardar el resultado
      const originalJson = res.json;
      const originalSend = res.send;

      res.json = (body) => {
        this._cacheResult(compositeKey, res.statusCode, body);
        return originalJson.call(res, body);
      };

      res.send = (body) => {
        // Solo cacheamos si es objeto, para buffers/strings dependemos de la app
        if (typeof body === 'object') {
            this._cacheResult(compositeKey, res.statusCode, body);
        }
        return originalSend.call(res, body);
      };

      next();
    };
  }

  _cacheResult(compositeKey, statusCode, body) {
    // Si es una llave auto-generada para bloqueo de concurrencia, 
    // la borramos al terminar para permitir peticiones secuenciales (ej. Regenerar).
    if (compositeKey.includes(':concurrent-lock-')) {
      this.cache.delete(compositeKey);
      return;
    }

    // Solo cacheamos respuestas exitosas o errores del cliente controlados (ej. validaciones)
    // No cacheamos errores 500 para permitir reintentos.
    if (statusCode < 500) {
      this.cache.set(compositeKey, {
        status: 'done',
        statusCode,
        body,
        timestamp: Date.now()
      });

      // TTL cleanup se maneja globalmente en this._cleanupInterval
    } else {
      this.cache.delete(compositeKey);
    }
  }
}

export const idempotencyManager = new IdempotencyManager();
