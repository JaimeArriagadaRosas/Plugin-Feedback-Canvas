import express from 'express';
import { authorizeRole } from '../../authz/authorizeRole.js';
import { handleValidationErrors, validateCourseId, validateAssignmentId, validateStudentId } from '../../middlewares/security.js';
import logger from '../../utils/logger.js';

export function createCourseRoutes(courseCtrl, fileCtrl, canvasOAuth) {
  const router = express.Router();

  router.use(canvasOAuth); // Canvas OAuth es requerido para estas rutas

  router.get('/', authorizeRole(['teacher']), handleValidationErrors, (req, res, next) => {
    logger.debug('GET /courses', { user: req.appIdentity?.canonicalUserId });
    courseCtrl.getCourses(req, res, next);
  });

  router.get('/:courseId/assignments', authorizeRole(['teacher']), ...validateCourseId, handleValidationErrors, (req, res, next) => {
    logger.debug('GET /courses/:id/assignments', { courseId: req.params.courseId });
    courseCtrl.getAssignments(req, res, next);
  });

  router.get('/:courseId/students', authorizeRole(['teacher']), ...validateCourseId, handleValidationErrors, (req, res, next) => {
    courseCtrl.getStudents(req, res, next);
  });

  router.get('/:courseId/assignments/:assignmentId/submissions/:studentId', authorizeRole(['teacher']), ...validateCourseId, ...validateAssignmentId, ...validateStudentId, handleValidationErrors, (req, res, next) => {
    courseCtrl.getSubmission(req, res, next);
  });

  router.get('/:courseId/assignments/:assignmentId/quiz-details/:studentId', authorizeRole(['teacher']), ...validateCourseId, ...validateAssignmentId, ...validateStudentId, handleValidationErrors, (req, res, next) => {
    courseCtrl.getQuizDetails(req, res, next);
  });

  router.post('/:courseId/assignments/reset-active', authorizeRole(['teacher']), ...validateCourseId, handleValidationErrors, (req, res, next) => {
    courseCtrl.resetActiveAssignments(req, res, next);
  });

  router.post('/:courseId/assignments/:assignmentId/toggle', authorizeRole(['teacher']), ...validateCourseId, ...validateAssignmentId, handleValidationErrors, (req, res, next) => {
    courseCtrl.togglePlugin(req, res, next);
  });

  // Ruta de utilería vinculada a cursos (file preview)
  router.get('/file/preview', authorizeRole(['teacher']), handleValidationErrors, (req, res, next) => {
    fileCtrl.preview(req, res, next);
  });

  return router;
}
