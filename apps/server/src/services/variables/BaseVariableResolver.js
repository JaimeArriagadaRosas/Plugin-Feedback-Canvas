/**
 * Base class for all dynamic variable resolvers.
 * Defines the interface that variable modules must meet.
 */
export default class BaseVariableResolver {
  constructor(variableName) {
    this.variableName = variableName;
  }

  /**
   * Indicates if this variable is present in the raw template.
   * @param {string} template 
   * @returns {boolean}
   */
  matches(template) {
    return template.includes(this.variableName);
  }

  /**
   * Resolves the variable value asynchronously (if necessary) 
   * or synchronously.
   * @param {Object} context Global generation context (submission, student, courseId, etc.)
   * @returns {Promise<string>} The string that will replace the variable
   */
  async resolve(context) {
    throw new Error('Must be implemented by the subclass');
  }

  /**
   * Basic sanitization to prevent Prompt Injection
   */
  sanitize(val) {
    if (typeof val !== 'string') return val;
    return val
      .replace(/```/g, "'''")
      .replace(/{{/g, '{ {')
      .replace(/}}/g, '} }')
      .replace(/\[INST\]/ig, '[ INST ]')
      .replace(/<system>/ig, '< system >')
      .replace(/<\/system>/ig, '< /system >');
  }
}
