import { AppError } from '../utils/errors.js';

export function assertOwnStudent(req, studentId) {
  if (!studentId) return;

  const identity = req.appIdentity;
  if (!identity) {
    throw new AppError('Contexto de identidad no inicializado.', 500);
  }

  if (identity.isStudent() && identity.canonicalUserId !== String(studentId)) {
    throw new AppError('Acceso denegado: Solo puedes acceder a tu propio feedback.', 403);
  }
}
