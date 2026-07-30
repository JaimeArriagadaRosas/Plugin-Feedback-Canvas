/**
 * Clase base para todos los resolutores de variables dinámicas.
 * Define la interfaz que deben cumplir los módulos de variables.
 */
export default class BaseVariableResolver {
  constructor(variableName) {
    this.variableName = variableName;
  }

  /**
   * Indica si esta variable está presente en la plantilla cruda.
   * @param {string} template 
   * @returns {boolean}
   */
  matches(template) {
    return template.includes(this.variableName);
  }

  /**
   * Resuelve el valor de la variable de forma asíncrona (si es necesario) 
   * o sincrónica.
   * @param {Object} context Contexto global de la generación (submission, student, courseId, etc.)
   * @returns {Promise<string>} El string que reemplazará la variable
   */
  async resolve(context) {
    throw new Error('Debe ser implementado por la subclase');
  }

  /**
   * Sanitización básica para prevenir Prompt Injection
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
