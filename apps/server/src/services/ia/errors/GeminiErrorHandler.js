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
      const message = data?.error?.message || 'Error desconocido de Gemini';

      if (status === 401 || status === 403) {
        throw new ApiError('API Key de Gemini inválida, revocada o sin permisos.', 401);
      }
      
      if (status === 429) {
        const err = new ApiError('El modelo de IA está experimentando alta demanda en este momento (límite de cuota). Por favor, inténtelo de nuevo en unos minutos.', 429);
        if (retryAfter) err.retryAfter = retryAfter;
        throw err;
      }

      if (status >= 500) {
        const err = new ApiError(`El modelo de IA está experimentando alta demanda en este momento o hubo un error interno. Por favor, inténtelo de nuevo más tarde. (Detalle: ${message})`, status);
        if (retryAfter) err.retryAfter = retryAfter;
        throw err;
      }
      
      throw new ApiError(`Error de Gemini: ${message}`, status || 400);
    }
    
    // El SDK de Google (si se usa) puede lanzar errores con formato distinto
    if (error.status && error.message) {
      if (error.status === 401 || error.status === 403) {
         throw new ApiError('API Key de Gemini rechazada.', 401);
      }
      if (error.status === 429) {
         const err = new ApiError('El modelo de IA está experimentando alta demanda en este momento (límite de cuota). Por favor, inténtelo de nuevo en unos minutos.', 429);
         if (retryAfter) err.retryAfter = retryAfter;
         throw err;
      }
      if (error.status >= 500) {
         const err = new ApiError(`El modelo de IA está experimentando alta demanda en este momento o hubo un error interno. Por favor, inténtelo de nuevo más tarde. (Detalle: ${error.message})`, error.status);
         if (retryAfter) err.retryAfter = retryAfter;
         throw err;
      }
      throw new ApiError(`Error de Gemini: ${error.message}`, error.status || 400);
    }
    
    throw new ApiError(`Error al comunicarse con Gemini: ${error.message}`, 500);
  }
}
