import logger from './logger.js';

export class CircuitBreaker {
  constructor(threshold = 0.5, windowMs = 30000, openDurationMs = 30000, minRequests = 10) {
    this.threshold = threshold;
    this.windowMs = windowMs;
    this.openDurationMs = openDurationMs;
    this.events = []; // { timestamp, success: boolean }
    this.minRequests = minRequests;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
    this.openedAt = null;
  }

  _clean() {
    const cutoff = Date.now() - this.windowMs;
    this.events = this.events.filter(e => e.timestamp > cutoff);
  }

  recordSuccess() {
    this.events.push({ timestamp: Date.now(), success: true });
    this._clean();
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.events = [];
      this.openedAt = null;
      logger.info('[CircuitBreaker] Servicio recuperado. Estado: CLOSED');
    }
  }

  recordFailure() {
    this.events.push({ timestamp: Date.now(), success: false });
    this._clean();
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      logger.warn('[CircuitBreaker] Servicio sigue fallando. Estado: OPEN');
      return;
    }

    const total = this.events.length;
    if (this.state === 'CLOSED' && total >= this.minRequests) {
      const failures = this.events.filter(e => !e.success).length;
      const ratio = failures / total;
      if (ratio >= this.threshold) {
        this.state = 'OPEN';
        this.openedAt = Date.now();
        logger.warn(`[CircuitBreaker] Servicio degradado (${Math.round(ratio * 100)}% fallos en ${this.windowMs}ms). Estado: OPEN`);
      }
    }
  }

  canAttempt() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (this.openedAt && Date.now() - this.openedAt > this.openDurationMs) {
        this.state = 'HALF_OPEN';
        logger.info('[CircuitBreaker] Pasando a estado HALF_OPEN. Probando servicio...');
        return true;
      }
      return false;
    }
    if (this.state === 'HALF_OPEN') return true;
    return true;
  }
}
