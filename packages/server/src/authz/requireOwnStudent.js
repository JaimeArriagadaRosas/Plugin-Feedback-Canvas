import { AppError } from '../utils/errors.js';

export function assertOwnStudent(req, studentId) {
  if (!studentId) return;
  const roles = req.ltiContext?.role || [];
  const roleList = Array.isArray(roles) ? roles : [roles];
  const isStudentRole = req.ltiContext?.localRole === 'student'
    || roleList.some(r => typeof r === 'string' && r.toLowerCase().includes('learner'));

  if (isStudentRole && String(req.ltiContext?.user) !== String(studentId)) {
    throw new AppError('Acceso denegado: Solo puedes acceder a tu propio feedback.', 403);
  }
}
