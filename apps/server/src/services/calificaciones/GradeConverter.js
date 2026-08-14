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
   * Procesa la calificación (Canvas o sobreescrita) para generar el feedback
   */
  static processGrade(currentGrade, submission) {
    const pointsPossibleRaw = submission?.points_possible;
    const pointsPossible = typeof pointsPossibleRaw === 'number' && Number.isFinite(pointsPossibleRaw)
      ? pointsPossibleRaw
      : 100;

    if (pointsPossible <= 0) {
      // Usamos Error genérico aquí, el llamador debe mapearlo a DomainError si es necesario
      const err = new Error('points_possible debe ser mayor a 0');
      err.errorCode = 'INSUFFICIENT_DATA';
      err.statusCode = 422;
      throw err;
    }

    if (currentGrade !== undefined && currentGrade !== null && currentGrade !== '') {
      const parsedGrade = typeof currentGrade === 'number' ? currentGrade : parseFloat(currentGrade);
      if (!Number.isFinite(parsedGrade) || parsedGrade < 1.0 || parsedGrade > 7.0) {
        const err = new Error('Nota chilena fuera de rango (1.0–7.0)');
        err.errorCode = 'INSUFFICIENT_DATA';
        err.statusCode = 422;
        throw err;
      }
      const rawCanvasScore = parsedGrade >= 4.0 
        ? 60 + ((parsedGrade - 4.0) / 3.0) * 40
        : ((parsedGrade - 1.0) / 2.9) * 60;
      
      const { chileGrade, approved } = this.toChileGrade(rawCanvasScore, pointsPossible);
      return { chileGrade, approved, canvasScore: Math.round(rawCanvasScore) };
    }
    
    const rawScore = submission?.score ?? submission?.entered_score ?? submission?.unposted_score;
    if (submission && rawScore !== undefined && rawScore !== null) {
      const rawCanvasScore = typeof rawScore === 'number' ? rawScore : parseFloat(rawScore);
      if (!Number.isFinite(rawCanvasScore) || rawCanvasScore < 0 || rawCanvasScore > pointsPossible) {
        const err = new Error(`Calificación Canvas fuera de rango (0–${pointsPossible})`);
        err.errorCode = 'INSUFFICIENT_DATA';
        err.statusCode = 422;
        throw err;
      }
      const { chileGrade, approved } = this.toChileGrade(rawCanvasScore, pointsPossible);
      return { chileGrade, approved, canvasScore: Math.round(rawCanvasScore) };
    }

    const err = new Error('No se puede generar feedback porque la entrega no tiene puntaje ni calificación asignada');
    err.errorCode = 'INSUFFICIENT_DATA';
    err.statusCode = 422;
    throw err;
  }

  /**
   * Selecciona el tono de feedback basado en la nota chilena (1.0–7.0)
   * Umbrales estándar de universidades chilenas:
   *   7.0–6.0 : Sobresaliente / Excelente
   *   5.9–4.0 : Bueno / Aprobado
   *   3.9–1.0 : Necesita reforzar
   * @param {number} chileGrade
   * @returns {string}
   */
  static getToneForChileGrade(chileGrade) {
    if (chileGrade >= 6.0) return 'motivador y de excelencia';
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
