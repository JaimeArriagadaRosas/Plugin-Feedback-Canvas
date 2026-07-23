// ─────────────────────────────────────────────────────────────────────────────
// ÚNICA FUENTE DE VERDAD PARA ROLES LTI 1.3 (IMS Global)
//
// Centraliza la clasificación de roles, la resolución del rol efectivo para la
// vista del frontend, y la validación de lanzamientos (launch). Todos los
// componentes (AuthLTI13Handler, server.js, LtiAccessValidator, LTIController)
// deben importar desde aquí para evitar divergencias.
// ─────────────────────────────────────────────────────────────────────────────

// Mapa de roles IMS estándar (URNs de LTI 1.3)
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
 * Extrae el arreglo de roles del claim estándar de LTI.
 */
export function getRolesFromClaims(decoded = {}) {
  return decoded[ROLE_CLAIM] || [];
}

/**
 * Extrae el parámetro custom `unida_entry` inyectado por el placement de Canvas
 * (p.ej. "admin" para account_navigation, "course" para course_navigation).
 */
export function getEntryFromClaims(decoded = {}) {
  const custom = decoded[CUSTOM_CLAIM] || {};
  return custom.unida_entry || null;
}

/**
 * Clasifica un arreglo de roles IMS en banderas booleanas.
 *
 * PRINCIPIO CLAVE: separa el rol de CUENTA (institution/person#Administrator)
 * del rol de CONTEXTO de curso (membership#Instructor, #Learner, etc.).
 *
 * SEGURIDAD: la coincidencia es EXACTA contra las URNs IMS estándar definidas
 * en LTI_ROLE_URNS. Antes se usaba `includes('Administrator')`, lo que permitía
 * falsos positivos: cualquier claim no estándar que contuviera la subcadena
 * "Administrator" (p.ej. "...#AdministratorAssistant") clasificaba al usuario
 * como accountAdmin y escalaba privilegios.
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
    const urns = LTI_ROLE_URNS[category] || [];
    if (urns.some(urn => normalized.has(urn))) {
      flags[flag] = true;
    }
  }

  return flags;
}

/**
 * Resuelve un rol efectivo ÚNICO para dirigir la vista del frontend.
 * Prioridad: administrador de cuenta > docente (instructor/TA/designer) > estudiante.
 */
export function resolveEffectiveRole(classification) {
  if (classification.isAccountAdmin) return 'admin';
  if (classification.isInstructor || classification.isTA || classification.isDesigner) return 'teacher';
  if (classification.isLearner) return 'student';
  return 'unknown';
}

/**
 * Determina si la persona es UNICAMENTE estudiante (sin capacidad docente/admin).
 * Se usa para bloquear lanzamientos no autorizados (defensa en profundidad).
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

/**
 * Valida un lanzamiento LTI a partir de un token decodificado.
 * Devuelve true si el acceso debe permitirse.
 *
 * Política: un estudiante puro (Learner sin Instructor/Admin/TA/Designer) nunca
 * puede lanzar el plugin. Docentes, admins y claims atípicos pasan; la
 * visibilidad real la controla Canvas mediante los placements.
 */
export function isLaunchAllowed(decoded = {}) {
  const roles = getRolesFromClaims(decoded);
  if (roles.length === 0) return true; // sin claims: lo resuelve el flujo real
  return !isStudentOnly(classifyRoles(roles));
}

/**
 * Resuelve el rol que debe reportar /api/config/me al frontend.
 * @param {object} params
 * @param {boolean} isLocalSession
 * @param {string}  localRole        Rol explícito en modo local (dev_role)
 * @param {Array}   roles            Claims de roles IMS
 * @param {string}  entry            "admin" si el lanzamiento vino de account_navigation
 * @param {string}  courseId         Contexto de curso (si aplica)
 */
export function toRoleURN(role) {
  const urns = LTI_ROLE_URNS[role];
  if (!urns || !urns.length) return role;
  return urns[0];
}

export function resolveViewRole({ isLocalSession, localRole, roles, entry, courseId }) {
  if (isLocalSession && localRole) {
    return localRole;
  }

  const classification = classifyRoles(roles);

  // Lanzamiento explícito desde account_navigation => panel de administración.
  if (entry === 'admin') {
    return 'admin';
  }
  
  // Lanzamiento explícito desde global_navigation para docentes.
  if (entry === 'teacher') {
    return 'teacher';
  }

  // Si estamos en un curso, los admins y docentes deben ver la vista de profesor.
  if (courseId && (classification.isInstructor || classification.isTA || classification.isDesigner || classification.isAccountAdmin)) {
    return 'teacher';
  }

  // Si no hay curso y es admin, va al panel de administración.
  if (classification.isAccountAdmin) {
    return 'admin';
  }

  if (classification.isInstructor || classification.isTA || classification.isDesigner) {
    return 'teacher';
  }

  return 'student';
}
