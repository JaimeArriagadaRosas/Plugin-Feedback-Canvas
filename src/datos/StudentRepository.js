import db from './db.js';

/**
 * Repositorio de Estudiantes (Historial Académico)
 */
export default class StudentRepository {
  async getHistory(studentId, courseId) {
    // Simulación: En una DB real buscaríamos en la tabla historial_academico
    const res = await db.query(
      'SELECT historial_json FROM historial_academico WHERE estudiante_id = $1 AND curso_id = $2',
      [studentId, courseId]
    );
    return res.rows[0]?.historial_json || null;
  }

  async updateHistory(studentId, courseId, historyJson) {
    await db.query(
      'INSERT INTO historial_academico (estudiante_id, curso_id, historial_json) VALUES ($1, $2, $3) ' +
      'ON CONFLICT (estudiante_id, curso_id) DO UPDATE SET historial_json = $3',
      [studentId, courseId, JSON.stringify(historyJson)]
    );
  }
}
