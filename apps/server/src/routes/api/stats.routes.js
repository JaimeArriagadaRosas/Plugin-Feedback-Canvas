import express from 'express';
import { authorizeRole } from '../../authz/authorizeRole.js';
import { handleValidationErrors, validateCourseId } from '../../middlewares/security.js';

export function createStatsRoutes(statsCtrl, auditLogCtrl) {
  const router = express.Router();

  router.get('/course/:courseId', authorizeRole(['teacher', 'admin']), ...validateCourseId, handleValidationErrors, (req, res, next) => statsCtrl.getCourseStats(req, res, next));
  router.get('/grades/:courseId', authorizeRole(['teacher', 'admin']), ...validateCourseId, handleValidationErrors, (req, res, next) => statsCtrl.getGradeDistribution(req, res, next));
  router.get('/ratings/:courseId', authorizeRole(['teacher', 'admin']), ...validateCourseId, handleValidationErrors, (req, res, next) => statsCtrl.getStudentRatings(req, res, next));
  router.get('/export/:courseId', authorizeRole(['teacher', 'admin']), ...validateCourseId, handleValidationErrors, (req, res, next) => statsCtrl.exportCsv(req, res, next));
  
  return router;
}

export function createAuditRoutes(auditLogCtrl) {
  const router = express.Router();
  
  router.get('/logs', authorizeRole(['admin']), (req, res, next) => auditLogCtrl.getLogs(req, res, next));
  
  return router;
}
