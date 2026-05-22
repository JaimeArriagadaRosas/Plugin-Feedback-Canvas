/**
 * Middleware de manejo de errores centralizado (RF40)
 * Captura errores de la aplicación y devuelve una respuesta formateada.
 */
export const ErrorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()}:`, err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    exito: false,
    error: {
      mensaje: message,
      codigo: statusCode,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    }
  });
};

/**
 * Clase de error personalizada para manejar errores operativos
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
