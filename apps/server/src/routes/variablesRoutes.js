import { Router } from 'express';
import CourseVariablesController from '../controllers/CourseVariablesController.js';
import { authorizeRole } from '../authz/authorizeRole.js';

export default function createVariablesRoutes() {
  const router = Router();

  // Middleware base: el usuario debe ser profesor o admin (LTI ya verificado globalmente)
  router.use(authorizeRole(['teacher', 'admin']));


  // Obtener configuración de variables por curso
  router.get('/:courseId/variables', CourseVariablesController.getCourseVariables);

  // Guardar configuración de variables por curso
  router.put('/:courseId/variables', CourseVariablesController.saveCourseVariables);

  return router;
}
