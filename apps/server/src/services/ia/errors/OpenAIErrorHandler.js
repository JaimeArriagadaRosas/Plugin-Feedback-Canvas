import { ApiError } from '../../../utils/errors.js';

export default class OpenAIErrorHandler {
  static handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = data?.error?.message || 'Unknown OpenAI error';
      const type = data?.error?.type;

      if (status === 401) {
        throw new ApiError('Invalid or revoked OpenAI API Key.', 401);
      }
      if (status === 429 || type === 'insufficient_quota') {
        throw new ApiError('OpenAI quota or rate limit exceeded.', 429);
      }
      if (status >= 500) {
        throw new ApiError(`Error in OpenAI servers: ${message}`, status);
      }
      throw new ApiError(`OpenAI error: ${message}`, status || 400);
    }
    
    // Network or other errors
    throw new ApiError(`Network error when connecting to OpenAI: ${error.message}`, 500);
  }
}
