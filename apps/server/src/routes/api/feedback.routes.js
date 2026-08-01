import express from 'express';
import { authorizeRole } from '../../authz/authorizeRole.js';
import { handleValidationErrors, validateId, validateCourseId, validateStudentId, validateFeedbackDetailQuery, studentRateLimiter } from '../../middlewares/security.js';
import { schemas, validateBody, requireDeploymentId } from '../../security/validation.js';
import { idempotencyManager } from '../../middlewares/IdempotencyKeyManager.js';

const ensureIdempotencyKey = (req, res, next) => {
  if (!req.headers['idempotency-key']) {
    if (req.body && req.body.courseId && req.body.assignmentId && req.body.studentId) {
      req.headers['idempotency-key'] = `concurrent-lock-${req.body.courseId}-${req.body.assignmentId}-${req.body.studentId}`;
    } else if (req.body && req.body.id && req.body.rating) {
      req.headers['idempotency-key'] = `concurrent-lock-rate-${req.body.id}`;
    }
  }
  next();
};

export function createFeedbackRoutes(feedbackCtrl, advancedFbCtrl, manualFbCtrl) {
  const router = express.Router();

  router.get('/list', authorizeRole(['teacher']), (req, res, next) => feedbackCtrl.listAll(req, res, next));
  router.get('/pending', authorizeRole(['teacher']), (req, res, next) => feedbackCtrl.listPending(req, res, next));
  router.get('/detail', authorizeRole(['teacher']), ...validateFeedbackDetailQuery, handleValidationErrors, (req, res, next) => feedbackCtrl.getDetail(req, res, next));
  router.get('/history/:courseId/:studentId', authorizeRole(['teacher']), ...validateCourseId, ...validateStudentId, handleValidationErrors, (req, res, next) => feedbackCtrl.getHistory(req, res, next));
  router.post('/generate', authorizeRole(['teacher']), validateBody(schemas.feedbackGenerate), ensureIdempotencyKey, idempotencyManager.middleware(), (req, res, next) => feedbackCtrl.generate(req, res, next));
  router.post('/generate-all', authorizeRole(['teacher']), (req, res, next) => feedbackCtrl.generateMassive(req, res, next));
  router.put('/:id', authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, validateBody(schemas.feedbackUpdate), (req, res, next) => feedbackCtrl.updateFeedback(req, res, next));
  router.post('/approve', authorizeRole(['teacher']), validateBody(schemas.feedbackApprove), (req, res, next) => feedbackCtrl.approveAndSend(req, res, next));
  router.put('/:id/rate', authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, (req, res, next) => feedbackCtrl.rateByTeacher(req, res, next));
  
  router.post('/bulk-approve', authorizeRole(['teacher']), (req, res, next) => advancedFbCtrl.bulkApprove(req, res, next));
  router.put('/:id/reject', authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, (req, res, next) => advancedFbCtrl.rejectFeedback(req, res, next));
  router.put('/:id/memo', authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, (req, res, next) => advancedFbCtrl.updatePrivateNote(req, res, next));
  router.post('/manual', authorizeRole(['teacher']), validateBody(schemas.feedbackManual), (req, res, next) => manualFbCtrl.submitManualFeedback(req, res, next));

  return router;
}

export function createStudentFeedbackRoutes(studentCtrl) {
  const router = express.Router();

  router.get('/feedback/:studentId', authorizeRole(['student', 'teacher']), ...validateStudentId, requireDeploymentId, handleValidationErrors, (req, res, next) => studentCtrl.getStudentView(req, res, next));
  router.post('/rate', authorizeRole(['student']), studentRateLimiter, requireDeploymentId, validateBody(schemas.studentRate), ensureIdempotencyKey, idempotencyManager.middleware(), (req, res, next) => studentCtrl.rateByStudent(req, res, next));

  return router;
}
