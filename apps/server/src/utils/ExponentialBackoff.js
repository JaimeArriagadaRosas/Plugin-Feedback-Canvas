import logger from './logger.js';
import { AppError } from './errors.js';

/**
 * Generic utility to handle rate limit (429) using Exponential Backoff
 * with support for the Retry-After header and Jitter.
 * Implements directive 3: Exponential Backoff for 429 rate limits.
 */
export class ExponentialBackoff {
  /**
   * Executes a function that returns a promise, retrying if a 429 is received.
   * 
   * @param {Function} asyncOperation - Function that makes the HTTP call and returns a Promise.
   * @param {string} context - Name or context of the operation (for logs).
   * @param {number} maxRetries - Maximum number of retries.
   */
  static async execute(asyncOperation, context = 'Operation', maxRetries = 4) {
    let attempt = 0;
    const baseDelay = 1000;

    while (true) {
      try {
        return await asyncOperation();
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 429 && attempt < maxRetries) {
          attempt++;
          let delay = baseDelay * Math.pow(2, attempt - 1);
          
          // Support for Retry-After (if the API exposes it in the error or response)
          // We assume that the AppError or an enriched error brings the original headers in error.headers
          let retryAfter = null;
          if (error.headers && (error.headers.get('retry-after') || error.headers.get('Retry-After'))) {
            const headerVal = error.headers.get('retry-after') || error.headers.get('Retry-After');
            const seconds = parseInt(headerVal, 10);
            if (!isNaN(seconds)) {
              retryAfter = seconds * 1000;
            } else {
              const date = new Date(headerVal);
              if (!isNaN(date.getTime())) {
                retryAfter = date.getTime() - Date.now();
              }
            }
          }

          if (retryAfter && retryAfter > 0) {
            delay = retryAfter;
            logger.warn(`[BACKOFF] ${context} Rate Limit (429). Retry-After detected: ${delay}ms`);
          } else {
            // Add Jitter (0 - 500ms) if there is no strict Retry-After
            const jitter = Math.random() * 500;
            delay += jitter;
            logger.warn(`[BACKOFF] ${context} Rate Limit (429). Retrying in ${Math.round(delay)}ms (Attempt ${attempt})`);
          }

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If it is not 429 or we exceed retries, throw the error
        throw error;
      }
    }
  }
}
