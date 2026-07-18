/**
 * Errores del dominio - variantes de AppError para violaciones de reglas de negocio.
 * 
 * Estas excepciones son lanzadas desde la capa de servicios/dominio cuando
 * se viola una regla de negocio (ej: feedback rechazado, template no encontrada,
 * datos inválidos). Los errores de infraestructura (BD, red) continúan usando AppError.
 */
import { AppError } from '../../utils/errors.js';

export class DomainError extends AppError {
  constructor(message, statusCode = 422) {
    super(message, statusCode);
    this.name = 'DomainError';
  }
}