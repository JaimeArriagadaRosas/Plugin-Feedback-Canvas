import { AppIdentity } from './AppIdentity.js';
import { getRolesFromClaims, getEntryFromClaims } from '../../utils/roles.js';

export class IdentityFactory {
  /**
   * Creates an AppIdentity instance from the raw claims of an LTI Launch (decoded JWT).
   * @param {Object} decoded - Decoded JWT of the LTI Launch
   * @returns {AppIdentity}
   */
  static fromLtiClaims(decoded) {
    const customClaims = decoded.custom || decoded['https://purl.imsglobal.org/spec/lti/claim/custom'] || {};
    const contextClaim = decoded.context || decoded['https://purl.imsglobal.org/spec/lti/claim/context'] || {};
    
    return new AppIdentity({
      ltiUserId: decoded.sub,
      numericUserId: customClaims.canvas_user_id || customClaims.user_id || null,
      name: decoded.name || 'User',
      roles: getRolesFromClaims(decoded),
      courseId: contextClaim.id,
      numericCourseId: customClaims.canvas_course_id || null,
      source: 'lti-launch',
      entry: getEntryFromClaims(decoded),
      deploymentId: decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
      isLocalSession: false
    });
  }

  /**
   * Creates an AppIdentity instance from a previously validated Session Token.
   * @param {Object} decoded - Decoded Session Token
   * @returns {AppIdentity}
   */
  static fromSessionToken(decoded) {
    const customClaims = decoded.custom || decoded['https://purl.imsglobal.org/spec/lti/claim/custom'] || {};
    const contextClaim = decoded.context || decoded['https://purl.imsglobal.org/spec/lti/claim/context'] || {};
    
    return new AppIdentity({
      ltiUserId: decoded.sub,
      // If the SessionToken was issued with studentId, we use it as numericUserId (priority)
      numericUserId: decoded.studentId || customClaims.canvas_user_id || customClaims.user_id || null,
      name: decoded.name || 'User',
      roles: getRolesFromClaims(decoded) || decoded.role, // Backward compatibility
      courseId: contextClaim.id || decoded.courseId,
      numericCourseId: customClaims.canvas_course_id || null,
      source: 'session-token',
      entry: getEntryFromClaims(decoded) || decoded.entry,
      deploymentId: decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
      isLocalSession: decoded.isLocalSession || false
    });
  }

  /**
   * Creates a test AppIdentity instance (Local / ApiToken)
   */
  static fromLocalUser(localId, role = 'teacher', courseId = null) {
    return new AppIdentity({
      ltiUserId: localId,
      numericUserId: localId,
      name: 'Local User',
      roles: [role], // Simplified
      courseId: courseId,
      numericCourseId: courseId,
      source: 'local-test',
      entry: role,
      deploymentId: 'local-deployment-id',
      isLocalSession: true
    });
  }
}
