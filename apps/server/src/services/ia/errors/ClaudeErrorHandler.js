import { ApiError } from '../../../utils/errors.js';

export default class ClaudeErrorHandler {
  static handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = data?.error?.message || 'Error desconocido de Claude (Anthropic)';
      const type = data?.error?.type;

      if (status === 401) {
        throw new ApiError('API Key de Claude inválida o revocada.', 401);
      }
      
      if (status === 429) {
        const customError = new ApiError('Límite de cuota o rate limit de Claude excedido.', 429);
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          customError.retryAfter = retryAfter;
        }
        throw customError;
      }

      // Anthropic específico: 529 Overloaded
      if (status === 529 || type === 'overloaded_error') {
        const customError = new ApiError('El servidor de Claude está sobrecargado (529).', 529);
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          customError.retryAfter = retryAfter;
        }
        throw customError;
      }

      if (status >= 500) {
        throw new ApiError(`Error en los servidores de Claude: ${message}`, status);
      }
      
      throw new ApiError(`Error de Claude: ${message}`, status || 400);
    }
    
    throw new ApiError(`Error de red al conectar con Claude: ${error.message}`, 500);
  }
}
