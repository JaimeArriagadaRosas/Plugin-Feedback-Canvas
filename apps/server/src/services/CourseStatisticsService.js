import logger from '../utils/logger.js';

/**
 * CourseStatisticsService - Calcula el promedio y tendencias de un curso.
 *
 * TODO (Deuda Técnica): Las variables matemáticas (GradeResolver, CourseStatisticsService y GradeConverter) asumen una escala chilena al 60% por defecto. Referencia: docs/TECHNICAL_DEBT.md
 */
export default class CourseStatisticsService {
  constructor(canvasGateway) {
    this.canvasGateway = canvasGateway;
  }

  async getAssignmentStats(courseId, assignmentId, teacherId) {
    try {
      const submissions = await this.canvasGateway.getAssignmentSubmissions(courseId, assignmentId, teacherId);
      
      if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
        return null; // Plan C: sin entregas
      }

      let totalGrade = 0;
      let gradeCount = 0;
      
      let totalScore = 0;
      let scoreCount = 0;

      for (const sub of submissions) {
        const gradeStr = sub.grade ?? sub.entered_grade;
        if (gradeStr !== undefined && gradeStr !== null) {
          const parsedGrade = parseFloat(gradeStr);
          if (!isNaN(parsedGrade)) {
            totalGrade += parsedGrade;
            gradeCount++;
          }
        }
        
        const rawScore = sub.score ?? sub.entered_score ?? sub.unposted_score;
        if (rawScore !== undefined && rawScore !== null) {
          const parsedScore = parseFloat(rawScore);
          if (!isNaN(parsedScore)) {
            totalScore += parsedScore;
            scoreCount++;
          }
        }
      }

      // Plan A: Notas explícitas (chilenas)
      if (gradeCount > 0) {
        return { grade: totalGrade / gradeCount };
      }
      
      // Plan B: Puntajes brutos
      if (scoreCount > 0) {
        return { score: totalScore / scoreCount };
      }

      return null;
    } catch (err) {
      logger.error(`[CourseStatisticsService] Error calculando promedio: ${err.message}`);
      return null;
    }
  }
}

