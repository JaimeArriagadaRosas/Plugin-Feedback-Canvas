import logger from './logger.js';
import { AppError } from './errors.js';

/**
 * Utilidad genérica para manejar el límite de tasa (429) usando Exponential Backoff
 * con soporte para la cabecera Retry-After y Jitter.
 * Implementa la directiva 3: Exponential Backoff para límites de tasa 429.
 */
export class ExponentialBackoff {
  /**
   * Ejecuta una función que retorna una promesa, reintentando si se recibe un 429.
   * 
   * @param {Function} asyncOperation - Función que realiza la llamada HTTP y retorna Promise.
   * @param {string} context - Nombre o contexto de la operación (para logs).
   * @param {number} maxRetries - Número máximo de reintentos.
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
          
          // Soporte para Retry-After (si la API lo expone en el error o respuesta)
          // Asumimos que el AppError o un error enriquecido trae los headers originales en error.headers
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
            logger.warn(`[BACKOFF] ${context} Rate Limit (429). Retry-After detectado: ${delay}ms`);
          } else {
            // Añadir Jitter (0 - 500ms) si no hay Retry-After estricto
            const jitter = Math.random() * 500;
            delay += jitter;
            logger.warn(`[BACKOFF] ${context} Rate Limit (429). Reintentando en ${Math.round(delay)}ms (Intento ${attempt})`);
          }

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Si no es 429 o superamos los reintentos, lanzar el error
        throw error;
      }
    }
  }
}
