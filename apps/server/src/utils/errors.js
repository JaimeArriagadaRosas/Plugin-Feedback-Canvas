/**
 * Errores operacionales del dominio.
 *
 * Centraliza la definición de AppError para que cualquier capa
 * (servicios, utilidades, controladores) pueda usarlo sin acoplarse
 * a la capa de transporte (middlewares).
 */
export class AppError extends Error {
  constructor(message, statusCode, data = null, responseHeaders = null, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.data = data;
    this.headers = responseHeaders;
    this.errorCode = errorCode; // RF61

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Errores de API, exclusivos para la capa de presentación (controladores/rutas).
 * Hereda de AppError para mantener consistencia operativa.
 */
export class ApiError extends AppError {
  constructor(message, statusCode, errorCode = null) {
    super(message, statusCode, null, null, errorCode);
    this.name = 'ApiError';
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(message, originalError = null, attempt = null) {
    super(message, 500);
    this.name = 'DatabaseConnectionError';
    this.originalError = originalError;
    this.attempt = attempt;
  }
}

export class IdempotencyError extends AppError {
  constructor(message, originalError = null) {
    super(message, 409); // Conflict
    this.name = 'IdempotencyError';
    this.originalError = originalError;
  }
}

export class DomainError extends AppError {
  constructor(message, statusCode = 400, errorCode = null) {
    super(message, statusCode, null, null, errorCode);
    this.name = 'DomainError';
  }
}

