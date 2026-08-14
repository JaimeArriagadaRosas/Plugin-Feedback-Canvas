export class AppIdentity {
  /**
   * Representa la identidad unificada de un usuario dentro del sistema.
   *
   * @param {Object} params
   * @param {string} params.ltiUserId - El UUID proporcionado por Canvas LTI en el claim `sub`
   * @param {string} [params.numericUserId] - El ID numérico de Canvas (usualmente proveído por custom_fields)
   * @param {string} [params.name] - Nombre del usuario (si está disponible)
   * @param {string[]} params.roles - Lista de roles LTI
   * @param {string} [params.courseId] - El ID (o UUID/hash) del curso de Canvas proporcionado por el claim context
   * @param {string} [params.numericCourseId] - El ID numérico del curso (usualmente proveído por custom_fields)
   * @param {string} params.source - Origen de la autenticación (e.g. 'lti-launch', 'session-token', 'api-token')
   * @param {string} [params.entry] - Entrypoint ('teacher', 'student', etc)
   * @param {string} [params.deploymentId] - El LTI deployment ID
   * @param {boolean} [params.isLocalSession=false] - Indica si es una sesión generada para pruebas locales
   */
  constructor({
    ltiUserId,
    numericUserId,
    name = 'Usuario',
    roles = [],
    courseId,
    numericCourseId,
    source,
    entry,
    deploymentId,
    isLocalSession = false
  }) {
    this.ltiUserId = ltiUserId;
    this.numericUserId = numericUserId ? String(numericUserId) : null;
    this.name = name;
    this.roles = roles || [];
    this.courseId = courseId;
    this.numericCourseId = numericCourseId ? String(numericCourseId) : null;
    this.source = source;
    this.entry = entry;
    this.deploymentId = deploymentId || null;
    this.isLocalSession = isLocalSession;
  }

  /**
   * Obtiene el identificador canónico del usuario.
   * Prioriza el ID numérico si Canvas LTI lo proporcionó en custom_fields. 
   * De lo contrario, retorna el UUID (sub).
   * @returns {string} El identificador canónico
   */
  get canonicalUserId() {
    return this.numericUserId || this.ltiUserId;
  }

  /**
   * Obtiene el identificador canónico del curso.
   * Prioriza el ID numérico si Canvas LTI lo proporcionó en custom_fields.
   * De lo contrario, retorna el LTI Context ID (UUID/hash).
   * @returns {string}
   */
  get canonicalCourseId() {
    return this.numericCourseId || this.courseId;
  }

  /**
   * Evalúa si el usuario activo es un student.
   * @returns {boolean}
   */
  isStudent() {
    return this.entry === 'student' || 
           this.roles.includes('http://purl.imsglobal.org/vocab/lis/v2/membership#Learner') || 
           this.roles.includes('Learner');
  }

  /**
   * Evalúa si el usuario activo es un teacher.
   * @returns {boolean}
   */
  isTeacher() {
    return this.entry === 'teacher' || 
           this.roles.includes('http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor') || 
           this.roles.includes('Instructor');
  }
}
