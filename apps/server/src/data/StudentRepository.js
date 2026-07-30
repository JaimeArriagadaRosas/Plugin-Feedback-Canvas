import db from './db.js';

/**
 * Repositorio de Estudiantes (Historial Académico)
 */
export default class StudentRepository {
  async getHistory(studentId, courseId) {
    // Modo local: En una DB real buscaríamos en la tabla Historial_Academico_Local
    const res = await db.query(
      'SELECT resumen_desempeno FROM Historial_Academico_Local WHERE estudiante_id = $1 AND curso_id = $2',
      [studentId, courseId]
    );
    return res.rows[0]?.resumen_desempeno || null;
  }

  async updateHistory(studentId, courseId, historyJson) {
    await db.query(
      'INSERT INTO Historial_Academico_Local (estudiante_id, curso_id, resumen_desempeno) VALUES ($1, $2, $3) ' +
      'ON CONFLICT (estudiante_id, curso_id) DO UPDATE SET resumen_desempeno = $3',
      [studentId, courseId, JSON.stringify(historyJson)]
    );
  }
}
