
/**
 * Network utility to handle retries using Exponential Backoff
 */
export default class ExponentialBackoff {
  /**
   * Executes an asynchronous function with retries
   * @param {Function} operation The async function to execute
   * @param {Object} options Options (maxRetries, baseDelay)
   */
  static async execute(operation, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        // Extract status code (can come from Axios, fetch, or custom clients like ApiError)
        const status = error.statusCode || error.response?.status || error.status || error.code;

        // Client errors (4xx except 429) are not retried
        if (status >= 400 && status < 500 && status !== 429) {
          throw error;
        }

        // If max retries reached, propagate error
        if (attempt === maxRetries) {
          throw error;
        }

        let delay;
        if (status === 429) {
          // Logic for 429 (Too Many Requests): Exponential Backoff with Jitter
          // No more static 60s waits. Use a higher baseDelay (e.g., 4000ms) and scale exponentially
          const base429Delay = 4000;
          delay = (base429Delay * Math.pow(2, attempt)) + (Math.random() * 1000);
          delay = error.retryAfter ? parseInt(error.retryAfter) * 1000 : delay; 
        } else {
          // Calculate exponential delay with jitter for other 5xx errors
          delay = (baseDelay * Math.pow(2, attempt)) + (Math.random() * 500);
          delay = error.retryAfter ? parseInt(error.retryAfter) * 1000 : delay;
        }
        
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
}
