export class AppIdentity {
  /**
   * Represents the unified identity of a user within the system.
   *
   * @param {Object} params
   * @param {string} params.ltiUserId - The UUID provided by Canvas LTI in the `sub` claim
   * @param {string} [params.numericUserId] - The Canvas numeric ID (usually provided by custom_fields)
   * @param {string} [params.name] - User name (if available)
   * @param {string[]} params.roles - List of LTI roles
   * @param {string} [params.courseId] - The Canvas course ID (or UUID/hash) provided by the context claim
   * @param {string} [params.numericCourseId] - The course numeric ID (usually provided by custom_fields)
   * @param {string} params.source - Authentication origin (e.g., 'lti-launch', 'session-token', 'api-token')
   * @param {string} [params.entry] - Entrypoint ('teacher', 'student', etc.)
   * @param {string} [params.deploymentId] - The LTI deployment ID
   * @param {boolean} [params.isLocalSession=false] - Indicates if it's a session generated for local testing
   */
  constructor({
    ltiUserId,
    numericUserId,
    name = 'User',
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
   * Gets the canonical user identifier.
   * Prioritizes the numeric ID if Canvas LTI provided it in custom_fields. 
   * Otherwise, returns the UUID (sub).
   * @returns {string} The canonical identifier
   */
  get canonicalUserId() {
    return this.numericUserId || this.ltiUserId;
  }

  /**
   * Gets the canonical course identifier.
   * Prioritizes the numeric ID if Canvas LTI provided it in custom_fields.
   * Otherwise, returns the LTI Context ID (UUID/hash).
   * @returns {string}
   */
  get canonicalCourseId() {
    return this.numericCourseId || this.courseId;
  }

  /**
   * Evaluates if the active user is a student.
   * @returns {boolean}
   */
  isStudent() {
    return this.entry === 'student' || 
           this.roles.includes('http://purl.imsglobal.org/vocab/lis/v2/membership#Learner') || 
           this.roles.includes('Learner');
  }

  /**
   * Evaluates if the active user is a teacher.
   * @returns {boolean}
   */
  isTeacher() {
    return this.entry === 'teacher' || 
           this.roles.includes('http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor') || 
           this.roles.includes('Instructor');
  }
}
