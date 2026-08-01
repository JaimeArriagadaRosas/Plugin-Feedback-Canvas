import db from '../data/db.js';

export default class PreferencesRepository {
  async getPreference(estudianteId) {
    const res = await db.query(
      'SELECT metodo, frecuencia FROM Preferencias_Notificacion_Estudiante WHERE estudiante_id = $1',
      [estudianteId]
    );
    return res.rows[0] || null;
  }

  async savePreference(estudianteId, metodo, frecuencia) {
    const res = await db.query(
      `INSERT INTO Preferencias_Notificacion_Estudiante (estudiante_id, metodo, frecuencia)
       VALUES ($1, $2, $3)
       ON CONFLICT (estudiante_id) 
       DO UPDATE SET metodo = EXCLUDED.metodo, frecuencia = EXCLUDED.frecuencia
       RETURNING *`,
      [estudianteId, metodo, frecuencia]
    );
    return res.rows[0];
  }
}
