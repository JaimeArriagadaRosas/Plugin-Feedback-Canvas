import { ApiError } from '../../../utils/errors.js';

export default class CustomErrorHandler {
  static handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = typeof data === 'string' ? data : (data?.error?.message || data?.message || 'Error del endpoint personalizado');

      if (status === 401 || status === 403) {
        throw new ApiError(`Acceso denegado al endpoint personalizado (HTTP ${status}). Revisa la API Key o los permisos.`, status);
      }
      
      if (status === 429) {
        const customError = new ApiError('Límite de peticiones (rate limit) excedido en el endpoint personalizado.', 429);
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          customError.retryAfter = retryAfter;
        }
        throw customError;
      }

      if (status >= 500) {
        throw new ApiError(`Error en el servidor personalizado: ${message}`, status);
      }
      
      throw new ApiError(`Respuesta de error del endpoint personalizado: ${message}`, status || 400);
    }
    
    // Si fue un error de Axios porque no se pudo conectar (ej. CORS, DNS, certificado inválido)
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
       throw new ApiError(`No se pudo establecer conexión con el endpoint personalizado (${error.code}). Verifica la URL.`, 502);
    }
    
    throw new ApiError(`Error de red o desconocido al contactar el endpoint: ${error.message}`, 500);
  }
}
