/**
 * Validador Académico
 * Procesa datos históricos y actuales para generar un perfil de desempeño del estudiante.
 */
export default class ValidadorAcademico {
  /**
   * Genera un perfil psicopedagógico resumido basado en historial
   * @param {Array} history - Lista de calificaciones y feedbacks previos
   */
  static generateStudentProfile(history) {
    if (!history || history.length === 0) {
      return { level: 'Nuevo', trend: 'Neutral', advice: 'No hay datos previos.' };
    }

    const grades = history.map(h => parseFloat(h.grade) || 0);
    const average = grades.reduce((a, b) => a + b, 0) / grades.length;
    
    // Calcular tendencia (simplificado)
    const recent = grades.slice(0, 3);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const trend = recentAvg > average ? 'Mejorando' : (recentAvg < average ? 'Bajando' : 'Estable');

    let level = 'Promedio';
    if (average >= 90) level = 'Sobresaliente';
    else if (average < 60) level = 'En Riesgo';

    return {
      average: average.toFixed(1),
      level,
      trend,
      totalSubmissions: history.length
    };
  }

  /**
   * Valida si un estudiante califica para un feedback de refuerzo especial
   */
  static needsReinforcement(profile) {
    return profile.level === 'En Riesgo' || profile.trend === 'Bajando';
  }
}
