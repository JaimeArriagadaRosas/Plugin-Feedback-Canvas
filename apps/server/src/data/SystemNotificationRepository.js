import db from './db.js';
import logger from '../utils/logger.js';

export default class SystemNotificationRepository {
  async save(profesorId, tipoError, detalle, contexto = {}) {
    try {
      const query = `
        INSERT INTO Notificaciones_Sistema (profesor_id, tipo_error, detalle, contexto)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const result = await db.query(query, [profesorId, tipoError, detalle, JSON.stringify(contexto)]);
      return result.rows[0];
    } catch (error) {
      logger.error('[SystemNotificationRepository] Error guardando notificación', { error: error.message });
      throw error;
    }
  }

  async getPendingCounts(profesorId) {
    try {
      const query = `
        SELECT tipo_error, COUNT(*) as cantidad
        FROM Notificaciones_Sistema
        WHERE profesor_id = $1 AND leido = FALSE
        GROUP BY tipo_error;
      `;
      const result = await db.query(query, [profesorId]);
      return result.rows; // [{ tipo_error: 'CANVAS_CONNECTION_FAILED', cantidad: 2 }, ...]
    } catch (error) {
      logger.error('[SystemNotificationRepository] Error obteniendo pendientes', { error: error.message });
      return [];
    }
  }

  async clearPending(profesorId, tipoError) {
    try {
      const query = `
        UPDATE Notificaciones_Sistema
        SET leido = TRUE
        WHERE profesor_id = $1 AND tipo_error = $2 AND leido = FALSE;
      `;
      await db.query(query, [profesorId, tipoError]);
      return true;
    } catch (error) {
      logger.error('[SystemNotificationRepository] Error limpiando pendientes', { error: error.message });
      throw error;
    }
  }

  async getForCourse(profesorId, courseId) {
    try {
      // Si el contexto incluye el courseId, se podría filtrar, 
      // pero para simplificar traeremos todas las notificaciones de ese profe
      const query = `
        SELECT *
        FROM Notificaciones_Sistema
        WHERE profesor_id = $1
        ORDER BY fecha DESC;
      `;
      const result = await db.query(query, [profesorId]);
      return result.rows;
    } catch (error) {
      logger.error('[SystemNotificationRepository] Error obteniendo historial', { error: error.message });
      return [];
    }
  }
}
