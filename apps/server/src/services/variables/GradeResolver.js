import BaseVariableResolver from './BaseVariableResolver.js';
import { DomainError } from '../../utils/errors.js';

/**
 * GradeResolver
 * TODO (Technical Debt): Math variables assume a 60% Chilean scale by default. Reference: docs/TECHNICAL_DEBT.md
 */
export default class GradeResolver extends BaseVariableResolver {
  constructor() {
    super('{{calificacion}}');
  }

  async resolve(context) {
    const { currentGrade, submission } = context;

    // Plan A: Explicit grade (converted to semantic text)
    if (currentGrade !== undefined && currentGrade !== null) {
      const parsedGrade = parseFloat(currentGrade);
      if (!isNaN(parsedGrade)) {
        return this.sanitize(`a grade of ${parsedGrade.toFixed(1)}`);
      }
    }

    // Plan B: Assignment score
    const rawScore = submission?.score ?? submission?.entered_score ?? submission?.unposted_score;
    if (submission && rawScore !== undefined && rawScore !== null) {
      const parsedScore = parseFloat(rawScore);
      if (!isNaN(parsedScore)) {
        const possible = submission.assignment?.points_possible || 100;
        const formattedScore = Number(parsedScore.toFixed(1));
        return this.sanitize(`a score of ${formattedScore} out of ${possible}`);
      }
    }

    // Plan C: No grade or score -> Block
    throw new DomainError('Feedback cannot be generated because the submission has no assigned score or grade.', 422);
  }
}
