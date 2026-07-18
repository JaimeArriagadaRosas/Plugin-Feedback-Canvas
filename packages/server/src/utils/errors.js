/**
 * Errores operacionales del dominio.
 *
 * Centraliza la definición de AppError para que cualquier capa
 * (servicios, utilidades, controladores) pueda usarlo sin acoplarse
 * a la capa de transporte (middlewares).
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
