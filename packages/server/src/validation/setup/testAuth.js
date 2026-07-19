import { signDevToken } from '../../security/crypto.js';

/**
 * Genera una cookie `lti-token` FIRMADA válida para los tests de caja negra.
 * Reemplaza el anterior `lti-token=admin-token` (sin firma), que era un bypass
 * de autenticación. Requiere ENABLE_TEST_AUTH_BYPASS=true en el entorno de prueba.
 */
export function signedLtiCookie(role = 'admin') {
  return `lti-token=${signDevToken(`dev-token:${role}:local`)}`;
}

export const ADMIN_COOKIE = signedLtiCookie('admin');
export const TEACHER_COOKIE = signedLtiCookie('teacher');
export const STUDENT_COOKIE = signedLtiCookie('student');
