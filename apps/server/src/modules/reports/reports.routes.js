import express from 'express';
import { authorizeRole } from '../../authz/authorizeRole.js';

export function setupReportsRoutes(reportsController) {
  const router = express.Router();

  // Todos estos endpoints requieren permisos de administrador o profesor.
  router.get('/stats/:courseId', authorizeRole(['teacher', 'admin']), (req, res, next) => reportsController.getStats(req, res, next));
  router.get('/ratings/:courseId', authorizeRole(['teacher', 'admin']), (req, res, next) => reportsController.getRatings(req, res, next));
  router.get('/export/excel/:courseId', authorizeRole(['teacher', 'admin']), (req, res, next) => reportsController.exportExcel(req, res, next));
  router.get('/export/pdf/:courseId', authorizeRole(['teacher', 'admin']), (req, res, next) => reportsController.exportPdf(req, res, next));

  return router;
}
