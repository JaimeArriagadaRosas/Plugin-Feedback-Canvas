
/**
 * Utilidad de red para manejar reintentos con Exponential Backoff
 */
export default class ExponentialBackoff {
  /**
   * Ejecuta una función asíncrona con reintentos
   * @param {Function} operation La función asíncrona a ejecutar
   * @param {Object} options Opciones (maxRetries, baseDelay)
   */
  static async execute(operation, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        // Extraemos el código de estado (puede venir de Axios, fetch u otros clientes personalizados como ApiError)
        const status = error.statusCode || error.response?.status || error.status || error.code;

        // Errores del cliente (4xx excepto 429) no se reintentan
        if (status >= 400 && status < 500 && status !== 429) {
          throw error;
        }

        // Si alcanzamos el máximo de reintentos, propagar el error
        if (attempt === maxRetries) {
          throw error;
        }

        let delay;
        if (status === 429) {
          // Lógica para 429 (Too Many Requests): Exponential Backoff con Jitter
          // No más esperas estáticas de 60s. Usamos un baseDelay mayor (ej. 4000ms) y lo escalamos exponencialmente
          const base429Delay = 4000;
          delay = (base429Delay * Math.pow(2, attempt)) + (Math.random() * 1000);
          delay = error.retryAfter ? parseInt(error.retryAfter) * 1000 : delay; 
        } else {
          // Calcular el delay exponencial con jitter para otros errores 5xx
          delay = (baseDelay * Math.pow(2, attempt)) + (Math.random() * 500);
          delay = error.retryAfter ? parseInt(error.retryAfter) * 1000 : delay;
        }
        
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
}
