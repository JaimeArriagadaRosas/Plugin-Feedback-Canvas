import logger from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';
import { Agent } from 'undici';
import { getLocalCaBuffer } from '../../local/TLSConfigurator.js';
import { getCanvasEnv } from '../../config/index.js';

import { CircuitBreaker } from '../../utils/CircuitBreaker.js';

const canvasCircuitBreaker = new CircuitBreaker(0.5, 30000, 30000, 10);

export function getCanvasCircuitBreaker() {
  return canvasCircuitBreaker;
}

export default class CanvasClient {
  constructor(canvasBaseUrl, canvasHost) {
    this.canvasBaseUrl = canvasBaseUrl || getCanvasEnv('CANVAS_BASE_URL', 'VITE_CANVAS_BASE_URL') || 'https://canvas.instructure.com';
    this.canvasHost = canvasHost || 'canvas.local';
    
    const caBuffer = getLocalCaBuffer();
    if (caBuffer && process.env.NODE_ENV !== 'test') {
      this.dispatcher = new Agent({
        connect: { ca: caBuffer }
      });
      logger.info('[CANVAS-API] Usando custom dispatcher con certificado mkcert para fetch.');
    } else {
      this.dispatcher = undefined;
    }
  }

  async apiFetch(endpoint, token, options = {}) {
    return this._baseFetch(`${this.canvasBaseUrl}/api/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...options.headers
      }
    });
  }

  async oauthFetch(endpoint, options = {}) {
    return this._baseFetch(`${this.canvasBaseUrl}/login/oauth2${endpoint}`, options);
  }

  async rawFetch(fullUrl, options = {}) {
    return this._baseFetch(fullUrl, options);
  }

  async _baseFetch(url, options = {}) {
    const maxRetries = options.maxRetries ?? 5;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      if (!canvasCircuitBreaker.canAttempt()) {
        const err = new Error('Canvas API temporalmente no disponible (circuito abierto).');
        err.isTransient = true;
        err.isCircuitOpen = true;
        logger.warn('[CANVAS-API] Solicitud bloqueada por circuit breaker.');
        throw err;
      }

      const timeoutMs = options.timeoutMs ?? 45000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const method = options.method || 'GET';

      const isJsonRequest = method !== 'GET' && method !== 'HEAD' && !options.body?.constructor?.name?.includes('FormData') && !options.body?.constructor?.name?.includes('URLSearchParams');

      try {
        const response = await fetch(url, {
          ...options,
          method,
          signal: controller.signal,
          dispatcher: this.dispatcher,
          headers: {
            'Host': url.includes('localhost') ? this.canvasHost : undefined,
            ...(isJsonRequest ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
          }
        });

        clearTimeout(timer);

        if (response.status === 403 && response.headers.get('x-rate-limit-remaining') === '0') {
          const resetTime = response.headers.get('x-rate-limit-reset') || 'desconocido';
          logger.error(`[CANVAS-API] Rate limit agotado (403). Reset en: ${resetTime}s. Abortando (fail-fast).`);
          throw new AppError(`Canvas API rate limit agotado. Reintente en ${resetTime} segundos.`, 429, {
            retryAfter: parseInt(resetTime, 10) || 60,
            isRateLimit: true
          }, response.headers);
        }
        
        if (response.status === 401 || response.status === 403) {
          const text = await response.text().catch(() => 'no body');
          logger.warn(`[CANVAS-API] Acceso denegado (${response.status}) en la URL: ${url}. Body: ${text}`);
          const { ApiError } = await import('../../utils/errors.js');
          throw new ApiError(`Acceso denegado a Canvas API: ${response.status}`, response.status);
        }

        if (!response.ok) {
          if (response.status === 429) {
            const err = new AppError(`Canvas API rate limit (429) excedido`, 429, { isTransient: true }, response.headers);
            canvasCircuitBreaker.recordFailure();
            throw err;
          }
          if ([500, 502, 503, 504].includes(response.status)) {
            const err = new Error(`Canvas API error [${response.status}]: ${response.statusText}`);
            err.isTransient = true;
            canvasCircuitBreaker.recordFailure();
            throw err;
          }
          // No registramos fallo en el Circuit Breaker para errores del cliente (4xx)
          if (options.returnFullResponse) {
             return response;
          }
          throw new Error(`Canvas API error [${response.status}]: ${response.statusText}`);
        }
        
        canvasCircuitBreaker.recordSuccess();
        // El estado global se consulta via canvasCircuitBreaker.state

        if (options.returnFullResponse) {
          return response;
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timer);
        if (error.statusCode === 401 || error.statusCode === 403) {
          // No registramos fallo por ser error esperado (sesión expirada o revocado)
          throw error;
        }
        if (error.name === 'AbortError' || error.message.includes('fetch failed') || error.isTransient) {
          canvasCircuitBreaker.recordFailure();
          attempt++;
          if (attempt >= maxRetries) {
            // global.canvasState = 'ERROR'; // CircuitBreaker ya lo maneja
            throw error;
          }
          const delay = Math.pow(2, attempt) * 2000; 
          logger.warn(`[CANVAS-API] Esperando respuesta de Canvas... el servidor parece estar sobrecargado (Reintento en ${delay/1000}s)`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw error;
      }
    }
  }

  getNextLink(linkHeader) {
    if (!linkHeader) return null;
    const matches = linkHeader.match(/<([^>]+)>\s*;\s*rel="next"/i);
    return matches ? matches[1] : null;
  }
}
