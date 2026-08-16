import { ApiError } from '../../../utils/errors.js';

export default class ClaudeErrorHandler {
  static handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = data?.error?.message || 'Unknown Claude error (Anthropic)';
      const type = data?.error?.type;

      if (status === 401) {
        throw new ApiError('Invalid or revoked Claude API Key.', 401);
      }
      
      if (status === 429) {
        const customError = new ApiError('Claude quota or rate limit exceeded.', 429);
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          customError.retryAfter = retryAfter;
        }
        throw customError;
      }

      // Anthropic specific: 529 Overloaded
      if (status === 529 || type === 'overloaded_error') {
        const customError = new ApiError('Claude server is overloaded (529).', 529);
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          customError.retryAfter = retryAfter;
        }
        throw customError;
      }

      if (status >= 500) {
        throw new ApiError(`Error in Claude servers: ${message}`, status);
      }
      
      throw new ApiError(`Claude error: ${message}`, status || 400);
    }
    
    throw new ApiError(`Network error when connecting to Claude: ${error.message}`, 500);
  }
}
