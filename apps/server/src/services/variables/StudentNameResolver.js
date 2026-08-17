import BaseVariableResolver from './BaseVariableResolver.js';

export default class StudentNameResolver extends BaseVariableResolver {
  constructor() {
    super('{{student_name}}');
  }

  async resolve(context) {
    const rawValue = context.student?.name || 'Student';
    return this.sanitize(rawValue);
  }
}
