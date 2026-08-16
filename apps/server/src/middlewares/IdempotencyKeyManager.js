import logger from '../utils/logger.js';

/**
 * Middleware to guarantee idempotency in POST/PUT/PATCH requests.
 * Uses an in-memory store (Map) simulating Redis for this local/monolith environment.
 * Implements directive 2: Guarantee absolute idempotency.
 */
class IdempotencyManager {
  constructor() {
    // In distributed production, this should be a Redis client.
    this.cache = new Map();
    this.TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
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
            mensaje: 'Idempotency-Key header is required for write operations',
            codigo: 400,
            documentacion: 'Generate a unique UUID v4 for each distinct operation'
          }
        });
      }

      const compositeKey = `${req.user?.id || 'anon'}:${req.path}:${idempotencyKey}`;

      if (this.cache.has(compositeKey)) {
        const cachedResponse = this.cache.get(compositeKey);
        
        if (cachedResponse.status === 'processing') {
          logger.warn(`[IDEMPOTENCY] Race condition detected for key: ${idempotencyKey}`);
          return res.status(409).json({ error: 'The request is already being processed (Race Condition).' });
        }

        logger.info(`[IDEMPOTENCY] Returning cached response for key: ${idempotencyKey}`);
        return res.status(cachedResponse.statusCode).json(cachedResponse.body);
      }

      // Mark as in process (lock against race conditions)
      this.cache.set(compositeKey, { status: 'processing', timestamp: Date.now() });

      // Intercept res.json and res.send to save the result
      const originalJson = res.json;
      const originalSend = res.send;

      res.json = (body) => {
        this._cacheResult(compositeKey, res.statusCode, body);
        return originalJson.call(res, body);
      };

      res.send = (body) => {
        // We only cache if it is an object, for buffers/strings we depend on the app
        if (typeof body === 'object') {
            this._cacheResult(compositeKey, res.statusCode, body);
        }
        return originalSend.call(res, body);
      };

      next();
    };
  }

  _cacheResult(compositeKey, statusCode, body) {
    // If it is an auto-generated key for concurrency locking, 
    // we delete it when finished to allow sequential requests (e.g., Regenerate).
    if (compositeKey.includes(':concurrent-lock-')) {
      this.cache.delete(compositeKey);
      return;
    }

    // We only cache successful responses or controlled client errors (e.g., validations)
    // We do not cache 500 errors to allow retries.
    if (statusCode < 500) {
      this.cache.set(compositeKey, {
        status: 'done',
        statusCode,
        body,
        timestamp: Date.now()
      });

      // TTL cleanup is handled globally in this._cleanupInterval
    } else {
      this.cache.delete(compositeKey);
    }
  }
}

export const idempotencyManager = new IdempotencyManager();
