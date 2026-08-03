/**
 * Utilidad de Conversión de Calificaciones
 * Canvas LMS: 0–100 puntos → Escala chilena: 1.0–7.0 (máximo = 7.0, mínima de aprobación = 4.0)
 *
 * Fórmula usada en Chile (escala típica universitaria):
 *   Si score >= 60 (aprobado): nota = 1 + (score - 55) * 6 / 45
 *   Si score <  60 (reprobado):  nota = 1 + score * 4  / 55
 * Umbral de aprobación en Canvas: 60% → equivale a nota 4.0 en Chile
 *
 * TODO (Deuda Técnica): Las variables matemáticas asumen una escala chilena al 60% por defecto. Referencia: docs/TECHNICAL_DEBT.md
 */
export default class GradeConverter {

  /**
   * Convierte una calificación de escala 0–100 a nota chilena 1.0–7.0
   * @param {number} canvasScore - Puntaje Canvas (0–100)
   * @param {number} pointsPossible - Puntos máximos del examen
   * @returns {{ chileGrade: number, canvasScore: number, pointsPossible: number, approved: boolean }}
   */
  static toChileGrade(canvasScore, pointsPossible = 100) {
    // Normalizar a escala 0–100 por si el examen no es de 100 pts
    const normalizedScore = (canvasScore / pointsPossible) * 100;
    let chileGrade;

    if (normalizedScore >= 60) {
      // Aprobado: escala 60–100 → nota 4.0–7.0
      chileGrade = 4.0 + ((normalizedScore - 60) * 3.0) / 40;
    } else {
      // Reprobado: escala 0–59.99 → nota 1.0–3.9
      chileGrade = 1.0 + (normalizedScore * 2.9) / 60;
    }

    chileGrade = Math.max(1.0, Math.min(7.0, Math.round(chileGrade * 10) / 10));

    return {
      chileGrade,
      canvasScore: Math.round(normalizedScore),
      pointsPossible,
      approved: normalizedScore >= 60
    };
  }

  /**
   * Selecciona el tono de feedback basado en la nota chilena (1.0–7.0)
   * Umbrales estándar de universidades chilenas:
   *   7.0–5.5 : Sobresaliente / Excelente
   *   5.4–4.0 : Bueno / Aprobado
   *   3.9–1.0 : Necesita reforzar
   * @param {number} chileGrade
   * @returns {string}
   */
  static getToneForChileGrade(chileGrade) {
    if (chileGrade >= 5.5) return 'motivador y de excelencia';
    if (chileGrade >= 4.0) return 'constructivo y estándar';
    return 'de apoyo y refuerzo';
  }

  /**
   * Selecciona el tono de feedback basado en calificación Canvas (0–100)
   * @param {number} canvasScore
   * @returns {string}
   */
  static getToneForCanvasScore(canvasScore) {
    if (canvasScore >= 70) return 'motivador y de excelencia';
    if (canvasScore >= 60) return 'constructivo y estándar';
    return 'de apoyo y refuerzo';
  }
}
