import BaseVariableResolver from './BaseVariableResolver.js';
import { DomainError } from '../../utils/errors.js';

/**
 * GradeResolver
 * TODO (Deuda Técnica): Las variables matemáticas asumen una escala chilena al 60% por defecto. Referencia: docs/TECHNICAL_DEBT.md
 */
export default class GradeResolver extends BaseVariableResolver {
  constructor() {
    super('{{calificacion}}');
  }

  async resolve(context) {
    const { currentGrade, submission } = context;

    // Plan A: Nota explícita (convertida a texto semántico)
    if (currentGrade !== undefined && currentGrade !== null) {
      const parsedGrade = parseFloat(currentGrade);
      if (!isNaN(parsedGrade)) {
        return this.sanitize(`una nota de ${parsedGrade.toFixed(1)}`);
      }
    }

    // Plan B: Puntaje de la tarea
    const rawScore = submission?.score ?? submission?.entered_score ?? submission?.unposted_score;
    if (submission && rawScore !== undefined && rawScore !== null) {
      const parsedScore = parseFloat(rawScore);
      if (!isNaN(parsedScore)) {
        const possible = submission.assignment?.points_possible || 100;
        const formattedScore = Number(parsedScore.toFixed(1));
        return this.sanitize(`un puntaje de ${formattedScore} sobre ${possible}`);
      }
    }

    // Plan C: Sin nota ni puntaje -> Bloquear
    throw new DomainError('No se puede generar feedback porque la entrega no tiene puntaje ni calificación asignada.', 422);
  }
}
