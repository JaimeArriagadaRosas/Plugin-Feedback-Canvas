import BaseVariableResolver from './BaseVariableResolver.js';
import CanvasScorePolicy from '../calificaciones/CanvasScorePolicy.js';

// Optional Canvas score. Does not infer grades, apply Chilean scales or block feedback.
export default class GradeResolver extends BaseVariableResolver {
  constructor() { super('{{grade}}'); }
  async resolve(context) {
    const submission = context.submission || {};
    const score = submission.score ?? submission.canvasScore;
    const possible = submission.pointsPossible ?? submission.assignment?.points_possible;
    if (score === null || score === undefined || possible == null) return null;
    try {
      const value = CanvasScorePolicy.classify(score, possible);
      return this.sanitize(CanvasScorePolicy.renderScore(value.earned, value.possible));
    } catch {
      return null;
    }
  }
}
