import { ApiError } from '../../../utils/errors.js';

export default class CustomErrorHandler {
  static handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = typeof data === 'string' ? data : (data?.error?.message || data?.message || 'Custom endpoint error');

      if (status === 401 || status === 403) {
        throw new ApiError(`Access denied to custom endpoint (HTTP ${status}). Check the API Key or permissions.`, status);
      }
      
      if (status === 429) {
        const customError = new ApiError('Rate limit exceeded on custom endpoint.', 429);
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          customError.retryAfter = retryAfter;
        }
        throw customError;
      }

      if (status >= 500) {
        throw new ApiError(`Error on custom server: ${message}`, status);
      }
      
      throw new ApiError(`Error response from custom endpoint: ${message}`, status || 400);
    }
    
    // If it was an Axios error because it could not connect (e.g. CORS, DNS, invalid certificate)
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
       throw new ApiError(`Could not establish connection with the custom endpoint (${error.code}). Verify the URL.`, 502);
    }
    
    throw new ApiError(`Network or unknown error when contacting the endpoint: ${error.message}`, 500);
  }
}
