import { AppError } from '../utils/errors.js';

export function assertOwnStudent(req, studentId) {
  if (!studentId) return;
  const roles = req.ltiContext?.role || [];
  const roleList = Array.isArray(roles) ? roles : [roles];
  const isStudentRole = req.ltiContext?.localRole === 'student'
    || roleList.some(r => typeof r === 'string' && r.toLowerCase().includes('learner'));

  const ltiUserStr = String(req.ltiContext?.user);
  const ltiStudentIdStr = String(req.ltiContext?.studentId);
  const targetIdStr = String(studentId);

  if (isStudentRole && ltiUserStr !== targetIdStr && ltiStudentIdStr !== targetIdStr) {
    throw new AppError('Acceso denegado: Solo puedes acceder a tu propio feedback.', 403);
  }
}
