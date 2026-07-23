import logger from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';
import { Agent } from 'undici';
import { getLocalCaBuffer } from '../../orchestration/TLSConfigurator_local.js';
import { getCanvasEnv } from '../../config/index.js';

class CircuitBreaker {
  constructor(threshold = 0.5, windowMs = 30000, openDurationMs = 30000) {
    this.threshold = threshold;
    this.windowMs = windowMs;
    this.openDurationMs = openDurationMs;
    this.failures = [];
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
    this.openedAt = null;
  }

  _clean() {
    const cutoff = Date.now() - this.windowMs;
    this.failures = this.failures.filter(t => t > cutoff);
  }

  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = [];
      this.openedAt = null;
      logger.info('[CircuitBreaker] Canvas API recuperada. Estado: CLOSED');
    }
  }

  recordFailure() {
    this.failures.push(Date.now());
    this._clean();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      logger.warn('[CircuitBreaker] Canvas API sigue fallando. Estado: OPEN');
      return;
    }

    if (this.state === 'CLOSED' && this.failures.length >= 3) {
      const ratio = this.failures.length / (this.failures.length + 1); // simplificado: al menos 3 fallos en ventana
      if (ratio >= this.threshold) {
        this.state = 'OPEN';
        this.openedAt = Date.now();
        logger.warn(`[CircuitBreaker] Canvas API degradada (${Math.round(ratio * 100)}% fallos en ${this.windowMs}ms). Estado: OPEN`);
      }
    }
  }

  canAttempt() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (this.openedAt && Date.now() - this.openedAt > this.openDurationMs) {
        this.state = 'HALF_OPEN';
        logger.info('[CircuitBreaker] Pasando a estado HALF_OPEN. Probando Canvas API...');
        return true;
      }
      return false;
    }
    if (this.state === 'HALF_OPEN') return true;
    return true;
  }
}

const canvasCircuitBreaker = new CircuitBreaker(0.5, 30000, 30000);

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
          const resetTime = parseInt(response.headers.get('x-rate-limit-reset') || '10', 10);
          logger.warn(`[CANVAS-API] Rate limit superado. Reintentando en ${resetTime}s...`);
          await new Promise(r => setTimeout(r, Math.min(resetTime * 1000, 10000)));
          attempt++;
          continue;
        }
        
        if (response.status === 401) {
          logger.warn(`[CANVAS-API] Token revocado/inválido o expirado (401) en la URL: ${url}`);
          throw new AppError('Token de Canvas inválido o revocado', 401, { requireOAuth: true });
        }

        if (!response.ok) {
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
        global.canvasState = 'READY';

        if (options.returnFullResponse) {
          return response;
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof AppError && error.statusCode === 401) {
          // No registramos fallo por ser error esperado (sesión expirada o revocado)
          throw error;
        }
        if (error.name === 'AbortError' || error.message.includes('fetch failed') || error.isTransient) {
          canvasCircuitBreaker.recordFailure();
          attempt++;
          if (attempt >= maxRetries) {
            global.canvasState = 'ERROR';
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
