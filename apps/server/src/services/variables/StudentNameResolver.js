import BaseVariableResolver from './BaseVariableResolver.js';

export default class StudentNameResolver extends BaseVariableResolver {
  constructor() {
    super('{{nombre_student}}');
  }

  async resolve(context) {
    const rawValue = context.student?.name || 'Student';
    return this.sanitize(rawValue);
  }
}
