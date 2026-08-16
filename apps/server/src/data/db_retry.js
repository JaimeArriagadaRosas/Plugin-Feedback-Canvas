import logger from '../utils/logger.js';

/**
 * Executes an operation with Exponential Backoff and Jitter.
 * @param {Function} operation - Asynchronous function to retry.
 * @param {Object} options - Retry options.
 * @param {number} [options.maxAttempts=10] - Maximum number of attempts.
 * @param {number} [options.baseDelayMs=1500] - Initial base delay.
 * @param {number} [options.maxDelayMs=15000] - Maximum delay.
 * @param {Function} [options.onAttemptFailed] - Callback for each failure.
 * @param {Function} [options.shouldRetry] - Function that determines if the error is transient.
 * @returns {Promise<any>}
 */
export async function withExponentialBackoff(operation, options = {}) {
  const {
    maxAttempts = 10,
    baseDelayMs = 1500,
    maxDelayMs = 15000,
    onAttemptFailed = (err, attempt, delay) => {
      logger.progress(`[DB-RETRY] Attempt ${attempt} failed. Waiting ${delay}ms to retry...`);
    },
    shouldRetry = () => true
  } = options;

  let attempt = 1;
  let lastError = null;

  while (attempt <= maxAttempts) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      
      if (!shouldRetry(error) || attempt === maxAttempts) {
        break;
      }

      // Exponential Backoff with Jitter
      // Delay = min(base * 2^(attempt-1), maxDelay) + Jitter(0-100ms)
      const baseDelay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = Math.floor(Math.random() * 100);
      const totalDelay = baseDelay + jitter;

      if (onAttemptFailed) {
        onAttemptFailed(error, attempt, totalDelay);
      }

      await new Promise(r => setTimeout(r, totalDelay));
      attempt++;
    }
  }

  throw lastError;
}
