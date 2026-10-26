// Language-neutral interpretation of Canvas points. No Chilean grade conversion.
export default class CanvasScorePolicy {
  static classify(score, pointsPossible) {
    const earned = Number(score);
    const possible = Number(pointsPossible);
    if (!Number.isFinite(earned) || !Number.isFinite(possible) ||
        possible <= 0 || earned < 0 || earned > possible) {
      const error = new Error('A valid Canvas score and positive points_possible are required');
      error.statusCode = 422;
      error.errorCode = 'INVALID_CANVAS_SCORE';
      throw error;
    }
    const percentage = earned / possible * 100;
    // Equivalent to the former rounded Chilean thresholds (6.0 and 4.0)
    // on the normal 0..100-point scale, without converting the score.
    const range = percentage >= 86 ? 'alto' : percentage >= 60 ? 'medio' : 'bajo';
    return { earned, possible, percentage, range };
  }

  static renderScore(earned, possible) {
    return String(earned) + ' out of ' + String(possible) + ' points';
  }
}
