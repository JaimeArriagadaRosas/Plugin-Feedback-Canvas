// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH FOR LTI 1.3 ROLES (IMS Global)
//
// Centralizes role classification, effective role resolution for the
// frontend view, and launch validation. All components
// (AuthLTI13Handler, server.js, LtiAccessValidator, LTIController)
// must import from here to avoid divergences.
// ─────────────────────────────────────────────────────────────────────────────

// Map of standard IMS roles (LTI 1.3 URNs)
export const LTI_ROLE_URNS = {
  admin: [
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Administrator',
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator'
  ],
  teacher: [
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Instructor',
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Faculty'
  ],
  ta: ['http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant'],
  designer: ['http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper'],
  student: [
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Learner',
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Student'
  ]
};

const ROLE_CLAIM = 'https://purl.imsglobal.org/spec/lti/claim/roles';
const CUSTOM_CLAIM = 'https://purl.imsglobal.org/spec/lti/claim/custom';

/**
 * Extracts the roles array from the standard LTI claim.
 */
export function getRolesFromClaims(decoded = {}) {
  // eslint-disable-next-line security/detect-object-injection
  return decoded[ROLE_CLAIM] || [];
}

/**
 * Extracts the custom `unida_entry` parameter injected by Canvas placement
 * (e.g., "admin" for account_navigation, "course" for course_navigation).
 */
export function getEntryFromClaims(decoded = {}) {
  // eslint-disable-next-line security/detect-object-injection
  const custom = decoded[CUSTOM_CLAIM] || {};
  return custom.unida_entry || null;
}

/**
 * Classifies an array of IMS roles into boolean flags.
 *
 * KEY PRINCIPLE: separates the ACCOUNT role (institution/person#Administrator)
 * from the course CONTEXT role (membership#Instructor, #Learner, etc.).
 *
 * SECURITY: the match is EXACT against the standard IMS URNs defined
 * in LTI_ROLE_URNS. Previously `includes('Administrator')` was used, which allowed
 * false positives: any non-standard claim containing the substring
 * "Administrator" (e.g. "...#AdministratorAssistant") classified the user
 * as accountAdmin and escalated privileges.
 */
const ROLE_TO_FLAG = {
  isAccountAdmin: 'admin',
  isInstructor: 'teacher',
  isTA: 'ta',
  isDesigner: 'designer',
  isLearner: 'student',
};

export function classifyRoles(roles = []) {
  const list = Array.isArray(roles) ? roles : [roles];
  const normalized = new Set(
    list.filter(r => typeof r === 'string').map(r => r.trim())
  );

  const flags = {
    isAccountAdmin: false,
    isInstructor: false,
    isTA: false,
    isDesigner: false,
    isLearner: false,
    raw: list,
  };

  for (const [flag, category] of Object.entries(ROLE_TO_FLAG)) {
    // eslint-disable-next-line security/detect-object-injection
    const urns = LTI_ROLE_URNS[category] || [];
    if (urns.some(urn => normalized.has(urn))) {
      // eslint-disable-next-line security/detect-object-injection
      flags[flag] = true;
    }
  }

  return flags;
}

/**
 * Resolves a UNIQUE effective role to direct the frontend view.
 * Priority: account admin > teacher (instructor/TA/designer) > student.
 */
export function resolveEffectiveRole(classification) {
  if (classification.isAccountAdmin) return 'admin';
  if (classification.isInstructor || classification.isTA || classification.isDesigner) return 'teacher';
  if (classification.isLearner) return 'student';
  return 'unknown';
}

/**
 * Determines if the person is ONLY a student (no teacher/admin capacity).
 * Used to block unauthorized launches (defense in depth).
 */
export function isStudentOnly(classification) {
  return (
    classification.isLearner &&
    !classification.isAccountAdmin &&
    !classification.isInstructor &&
    !classification.isTA &&
    !classification.isDesigner
  );
}

export function isLaunchAllowed(decoded = {}) {
  // Now all roles (including pure students) can launch the tool.
  // Resource access authorization is handled at the route middlewares level.
  return true;
}

/**
 * Resolves the role that /api/config/me should report to the frontend.
 * @param {object} params
 * @param {boolean} isLocalSession
 * @param {string}  localRole        Explicit role in local mode (dev_role)
 * @param {Array}   roles            IMS roles claims
 * @param {string}  entry            "admin" if the launch came from account_navigation
 * @param {string}  courseId         Course context (if applicable)
 */
export function toRoleURN(role) {
  // eslint-disable-next-line security/detect-object-injection
  const urns = LTI_ROLE_URNS[role];
  if (!urns || !urns.length) return role;
  return urns[0];
}

export function resolveViewRole({ isLocalSession, localRole, roles, entry, courseId }) {
  if (isLocalSession && localRole) {
    return localRole;
  }

  const classification = classifyRoles(roles);

  // Explicit launch from account_navigation => administration panel.
  if (entry === 'admin') {
    return 'admin';
  }
  
  // Explicit launch from global_navigation for teachers.
  if (entry === 'teacher') {
    return 'teacher';
  }

  // If we are in a course, admins and teachers must see the teacher view.
  if (courseId && (classification.isInstructor || classification.isTA || classification.isDesigner || classification.isAccountAdmin)) {
    return 'teacher';
  }

  // If there is no course and is admin, go to administration panel.
  if (classification.isAccountAdmin) {
    return 'admin';
  }

  if (classification.isInstructor || classification.isTA || classification.isDesigner) {
    return 'teacher';
  }

  return 'student';
}
