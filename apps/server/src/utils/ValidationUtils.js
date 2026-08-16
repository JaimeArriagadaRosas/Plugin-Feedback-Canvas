import { AppError } from './errors.js';

/**
 * Input Validation Utilities (RF40)
 */
export const ValidationUtils = {
  /**
   * Validates that a field is present and not empty
   */
  requerido: (valor, nombreCampo) => {
    if (valor === undefined || valor === null || valor === '') {
      throw new AppError(`The field ${nombreCampo} is required`, 400);
    }
    return true;
  },

  /**
   * Validates that a Canvas ID is numeric
   */
  validarIdCanvas: (id, nombreCampo = 'ID') => {
    if (isNaN(parseInt(id))) {
      throw new AppError(`${nombreCampo} must be a valid numeric Canvas ID`, 400);
    }
    return parseInt(id);
  },

  /**
   * Validates an email format
   */
  validarEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
      throw new AppError('Invalid email format', 400);
    }
    return email;
  }
};
