import BaseVariableResolver from './BaseVariableResolver.js';

// Una media de actividad no equivale al promedio general del curso.
export default class CourseAverageResolver extends BaseVariableResolver {
  constructor() { super('{{promedio_curso}}'); }
  async resolve(context) {
    const value = context.canvasCourseAverage;
    if (typeof value === 'string' && value.trim()) return this.sanitize(value.trim());
    if (Number.isFinite(value?.mean) && Number.isFinite(value?.pointsPossible) && value.pointsPossible > 0)
      return this.sanitize(value.mean + ' de ' + value.pointsPossible + ' puntos');
    return null;
  }
}
