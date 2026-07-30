import BaseVariableResolver from './BaseVariableResolver.js';

export default class StudentNameResolver extends BaseVariableResolver {
  constructor() {
    super('{{nombre_estudiante}}');
  }

  async resolve(context) {
    const rawValue = context.student?.name || 'Estudiante';
    return this.sanitize(rawValue);
  }
}
