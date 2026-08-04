import logger from '../logger.js';

export default class RateLimiterQueue {
  /**
   * Cola Global de Control de Frecuencia (Token Bucket / Rate Limiter)
   * @param {number} requestsPerMinute Máximo número de peticiones permitidas por minuto
   */
  constructor(requestsPerMinute = 12) {
    this.requestsPerMinute = requestsPerMinute;
    this.intervalMs = Math.ceil((60 * 1000) / this.requestsPerMinute); // ej. 5000ms para 12 RPM
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
  }

  /**
   * Encola una función asíncrona para ser ejecutada respetando el Rate Limit
   * @param {Function} taskFn Función asíncrona a ejecutar
   * @returns {Promise<any>} Promesa que se resuelve con el resultado de la función
   */
  async enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const timeToWait = Math.max(0, this.intervalMs - timeSinceLastRequest);

      if (timeToWait > 0) {
        await new Promise(res => setTimeout(res, timeToWait));
      }

      // Tomar la siguiente tarea de la cola (FIFO)
      const { taskFn, resolve, reject } = this.queue.shift();
      
      this.lastRequestTime = Date.now();

      try {
        const result = await taskFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.isProcessing = false;
  }
}

// Exportamos un Singleton para que toda la aplicación comparta la misma cuota
export const globalGeminiQueue = new RateLimiterQueue(12);
