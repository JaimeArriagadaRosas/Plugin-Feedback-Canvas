import { AppError } from './errors.js';

/**
 * Utilidades de Validación de Entradas (RF40)
 */
export const ValidationUtils = {
  /**
   * Valida que un campo esté presente y no esté vacío
   */
  requerido: (valor, nombreCampo) => {
    if (valor === undefined || valor === null || valor === '') {
      throw new AppError(`El campo ${nombreCampo} es requerido`, 400);
    }
    return true;
  },

  /**
   * Valida que un ID de Canvas sea numérico
   */
  validarIdCanvas: (id, nombreCampo = 'ID') => {
    if (isNaN(parseInt(id))) {
      throw new AppError(`${nombreCampo} debe ser un ID numérico válido de Canvas`, 400);
    }
    return parseInt(id);
  },

  /**
   * Valida un formato de correo electrónico
   */
  validarEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
      throw new AppError('Formato de email no válido', 400);
    }
    return email;
  }
};
