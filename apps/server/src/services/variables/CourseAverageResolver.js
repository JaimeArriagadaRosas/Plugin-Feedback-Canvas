import BaseVariableResolver from './BaseVariableResolver.js';

// The assignment mean is NOT a course-wide average. Only a Canvas-provided
// course-wide statistic may populate this optional template variable.
export default class CourseAverageResolver extends BaseVariableResolver {
  constructor() { super('{{course_average}}'); }
  async resolve(context) {
    const statistic = context.canvasCourseAverage;
    if (statistic == null || statistic === '') return null;
    if (typeof statistic === 'string') {
      return statistic.trim() ? this.sanitize(statistic.trim()) : null;
    }
    if (Number.isFinite(statistic?.mean) && Number.isFinite(statistic?.pointsPossible) &&
      statistic.pointsPossible > 0) {
      return this.sanitize(String(statistic.mean) + ' out of ' + String(statistic.pointsPossible) + ' points');
    }
    return null;
  }
}
