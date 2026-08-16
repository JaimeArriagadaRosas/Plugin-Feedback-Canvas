/**
 * Grade Conversion Utility
 * Canvas LMS: 0–100 points → Chilean scale: 1.0–7.0 (maximum = 7.0, minimum passing = 4.0)
 *
 * Formula used in Chile (typical university scale):
 *   If score >= 60 (passed): grade = 1 + (score - 55) * 6 / 45
 *   If score <  60 (failed):  grade = 1 + score * 4  / 55
 * Passing threshold in Canvas: 60% → equivalent to grade 4.0 in Chile
 *
 * TODO (Technical Debt): Mathematical variables assume a Chilean scale at 60% by default. Reference: docs/TECHNICAL_DEBT.md
 */
export default class GradeConverter {

  /**
   * Converts a 0-100 scale grade to a Chilean 1.0-7.0 grade
   * @param {number} canvasScore - Canvas score (0-100)
   * @param {number} pointsPossible - Maximum exam points
   * @returns {{ chileGrade: number, canvasScore: number, pointsPossible: number, approved: boolean }}
   */
  static toChileGrade(canvasScore, pointsPossible = 100) {
    // Normalize to 0-100 scale in case the exam is not 100 pts
    const normalizedScore = (canvasScore / pointsPossible) * 100;
    let chileGrade;

    if (normalizedScore >= 60) {
      // Passed: scale 60-100 -> grade 4.0-7.0
      chileGrade = 4.0 + ((normalizedScore - 60) * 3.0) / 40;
    } else {
      // Failed: scale 0-59.99 -> grade 1.0-3.9
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
   * Processes the grade (Canvas or overwritten) to generate feedback
   */
  static processGrade(currentGrade, submission) {
    const pointsPossibleRaw = submission?.points_possible;
    const pointsPossible = typeof pointsPossibleRaw === 'number' && Number.isFinite(pointsPossibleRaw)
      ? pointsPossibleRaw
      : 100;

    if (pointsPossible <= 0) {
      // Using generic Error here, the caller must map it to DomainError if necessary
      const err = new Error('points_possible debe ser mayor a 0');
      err.errorCode = 'INSUFFICIENT_DATA';
      err.statusCode = 422;
      throw err;
    }

    if (currentGrade !== undefined && currentGrade !== null && currentGrade !== '') {
      const parsedGrade = typeof currentGrade === 'number' ? currentGrade : parseFloat(currentGrade);
      if (!Number.isFinite(parsedGrade) || parsedGrade < 1.0 || parsedGrade > 7.0) {
        const err = new Error('Chilean grade out of range (1.0-7.0)');
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
        const err = new Error(`Canvas grade out of range (0-${pointsPossible})`);
        err.errorCode = 'INSUFFICIENT_DATA';
        err.statusCode = 422;
        throw err;
      }
      const { chileGrade, approved } = this.toChileGrade(rawCanvasScore, pointsPossible);
      return { chileGrade, approved, canvasScore: Math.round(rawCanvasScore) };
    }

    const err = new Error('Cannot generate feedback because the submission has no score or grade assigned');
    err.errorCode = 'INSUFFICIENT_DATA';
    err.statusCode = 422;
    throw err;
  }

  /**
   * Selects the feedback tone based on the Chilean grade (1.0-7.0)
   * Standard thresholds for Chilean universities:
   *   7.0-6.0 : Outstanding / Excellent
   *   5.9-4.0 : Good / Passed
   *   3.9-1.0 : Needs reinforcement
   * @param {number} chileGrade
   * @returns {string}
   */
  static getToneForChileGrade(chileGrade) {
    if (chileGrade >= 6.0) return 'motivating and excellent';
    if (chileGrade >= 4.0) return 'constructive and standard';
    return 'supportive and reinforcing';
  }

  /**
   * Selects the feedback tone based on the Canvas score (0-100)
   * @param {number} canvasScore
   * @returns {string}
   */
  static getToneForCanvasScore(canvasScore) {
    if (canvasScore >= 70) return 'motivating and excellent';
    if (canvasScore >= 60) return 'constructive and standard';
    return 'supportive and reinforcing';
  }
}
