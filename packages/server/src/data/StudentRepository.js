import db from './db.js';

/**
 * Repositorio de Estudiantes (Historial Académico)
 */
export default class StudentRepository {
  async getHistory(studentId, courseId) {
    // Modo local: En una DB real buscaríamos en la tabla Historial_Academico_Local
    const res = await db.query(
      'SELECT historial_json FROM Historial_Academico_Local WHERE estudiante_id = $1 AND curso_id = $2',
      [studentId, courseId]
    );
    return res.rows[0]?.historial_json || null;
  }

  async updateHistory(studentId, courseId, historyJson) {
    await db.query(
      'INSERT INTO Historial_Academico_Local (estudiante_id, curso_id, historial_json) VALUES ($1, $2, $3) ' +
      'ON CONFLICT (estudiante_id, curso_id) DO UPDATE SET historial_json = $3',
      [studentId, courseId, JSON.stringify(historyJson)]
    );
  }
}
