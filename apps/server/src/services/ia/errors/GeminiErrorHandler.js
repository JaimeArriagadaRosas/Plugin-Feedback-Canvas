import { ApiError } from '../../../utils/errors.js';

export default class GeminiErrorHandler {
  static handleError(error) {
    let retryAfter = null;
    
    if (error.response?.headers) {
      retryAfter = typeof error.response.headers.get === 'function' ? error.response.headers.get('retry-after') : error.response.headers['retry-after'];
    }
    if (!retryAfter && error.headers) {
      retryAfter = typeof error.headers.get === 'function' ? error.headers.get('retry-after') : error.headers['retry-after'];
    }

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = data?.error?.message || 'Unknown Gemini error';

      if (status === 401 || status === 403) {
        throw new ApiError('Gemini API Key invalid, revoked or without permissions.', 401);
      }
      
      if (status === 429) {
        const err = new ApiError('The AI model is currently experiencing high demand (quota limit). Please try again in a few minutes.', 429);
        if (retryAfter) err.retryAfter = retryAfter;
        throw err;
      }

      if (status >= 500) {
        const err = new ApiError(`The AI model is experiencing high demand or an internal error occurred. Please try again later. (Detail: ${message})`, status);
        if (retryAfter) err.retryAfter = retryAfter;
        throw err;
      }
      
      throw new ApiError(`Gemini Error: ${message}`, status || 400);
    }
    
    // The Google SDK (if used) can throw errors with a different format
    if (error.status && error.message) {
      if (error.status === 401 || error.status === 403) {
         throw new ApiError('Gemini API Key rejected.', 401);
      }
      if (error.status === 429) {
         const err = new ApiError('The AI model is currently experiencing high demand (quota limit). Please try again in a few minutes.', 429);
         if (retryAfter) err.retryAfter = retryAfter;
         throw err;
      }
      if (error.status >= 500) {
         const err = new ApiError(`The AI model is experiencing high demand or an internal error occurred. Please try again later. (Detail: ${error.message})`, error.status);
         if (retryAfter) err.retryAfter = retryAfter;
         throw err;
      }
      throw new ApiError(`Gemini Error: ${error.message}`, error.status || 400);
    }
    
    throw new ApiError(`Error communicating with Gemini: ${error.message}`, 500);
  }
}
