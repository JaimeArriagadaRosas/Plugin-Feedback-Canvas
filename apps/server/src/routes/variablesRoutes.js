import { Router } from 'express';
import CourseVariablesController from '../controllers/CourseVariablesController.js';
import { authorizeRole } from '../authz/authorizeRole.js';

export default function createVariablesRoutes() {
  const router = Router();

  // Middleware base: el usuario debe ser profesor o admin (LTI ya verificado globalmente)
  router.use(authorizeRole(['teacher', 'admin']));


  // Retrieve variable configuration by course
  router.get('/:courseId/variables', CourseVariablesController.getCourseVariables);

  // Save variable configuration by course
  router.put('/:courseId/variables', CourseVariablesController.saveCourseVariables);

  return router;
}
