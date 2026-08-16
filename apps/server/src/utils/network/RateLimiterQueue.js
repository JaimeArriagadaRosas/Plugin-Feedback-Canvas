import logger from '../logger.js';

export default class RateLimiterQueue {
  /**
   * Global Rate Limiter Queue (Token Bucket / Rate Limiter)
   * @param {number} requestsPerMinute Maximum number of requests allowed per minute
   */
  constructor(requestsPerMinute = 12) {
    this.requestsPerMinute = requestsPerMinute;
    this.intervalMs = Math.ceil((60 * 1000) / this.requestsPerMinute); // e.g. 5000ms for 12 RPM
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
  }

  /**
   * Enqueues an async task to be executed respecting the Rate Limit
   * @param {Function} taskFn Async function to execute
   * @returns {Promise<any>} Promise that resolves with the function's result
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

      // Take next task from the queue (FIFO)
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

// Export a Singleton so the entire application shares the same quota
export const globalGeminiQueue = new RateLimiterQueue(12);
