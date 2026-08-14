import logger from '../utils/logger.js';

/**
 * CourseStatisticsService - Calculates the average and trends of a course.
 *
 * TODO (Technical Debt): Mathematical variables (GradeResolver, CourseStatisticsService and GradeConverter) assume a Chilean scale at 60% by default. Reference: docs/TECHNICAL_DEBT.md
 */
export default class CourseStatisticsService {
  constructor(canvasGateway) {
    this.canvasGateway = canvasGateway;
  }

  async getAssignmentStats(courseId, assignmentId, teacherId) {
    try {
      const submissions = await this.canvasGateway.getAssignmentSubmissions(courseId, assignmentId, teacherId);
      
      if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
        return null; // Plan C: no submissions
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

      // Plan A: Explicit grades (Chilean)
      if (gradeCount > 0) {
        return { grade: totalGrade / gradeCount };
      }
      
      // Plan B: Raw scores
      if (scoreCount > 0) {
        return { score: totalScore / scoreCount };
      }

      return null;
    } catch (err) {
      logger.error(`[CourseStatisticsService] Error calculating average: ${err.message}`);
      return null;
    }
  }
}

