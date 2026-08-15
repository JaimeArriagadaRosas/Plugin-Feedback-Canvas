import { ApiError } from '../../../utils/errors.js';

export default class OpenAIErrorHandler {
  static handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = data?.error?.message || 'Error desconocido de OpenAI';
      const type = data?.error?.type;

      if (status === 401) {
        throw new ApiError('API Key de OpenAI inválida o revocada.', 401);
      }
      if (status === 429 || type === 'insufficient_quota') {
        throw new ApiError('Límite de cuota o rate limit de OpenAI excedido.', 429);
      }
      if (status >= 500) {
        throw new ApiError(`Error in OpenAI servers: ${message}`, status);
      }
      throw new ApiError(`OpenAI error: ${message}`, status || 400);
    }
    
    // Errores de red u otros
    throw new ApiError(`Network error when connecting to OpenAI: ${error.message}`, 500);
  }
}
