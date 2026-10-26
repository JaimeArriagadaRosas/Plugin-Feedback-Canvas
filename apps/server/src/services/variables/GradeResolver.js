import BaseVariableResolver from './BaseVariableResolver.js';
import CanvasScorePolicy from '../calificaciones/CanvasScorePolicy.js';

export default class GradeResolver extends BaseVariableResolver {
  constructor() { super('{{calificacion}}'); }
  async resolve(context) {
    const submission = context.submission || {};
    const score = submission.score ?? submission.canvasScore;
    const possible = submission.pointsPossible ?? submission.assignment?.points_possible;
    if (score === null || score === undefined || possible == null) return null;
    try {
      const result = CanvasScorePolicy.classify(score, possible);
      return this.sanitize(result.earned + ' de ' + result.possible + ' puntos');
    } catch { return null; }
  }
}
