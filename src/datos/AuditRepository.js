import db from './db.js';

/**
 * Repositorio de Auditoría (PostgreSQL)
 */
export default class AuditRepository {
  static async log(userId, action, details, ip = '0.0.0.0') {
    try {
      await db.query(
        'INSERT INTO Logs_Auditoria (usuario_id, accion, detalle, ip_address) VALUES ($1, $2, $3, $4)',
        [userId, action, details, ip]
      );
    } catch (error) {
      console.error('[AUDIT] Error guardando log:', error.message);
    }
  }

  async getLogs(limit = 100) {
    const res = await db.query('SELECT * FROM Logs_Auditoria ORDER BY fecha DESC LIMIT $1', [limit]);
    return res.rows;
  }
}
