import CourseVariablesService from '../services/variables/CourseVariablesService.js';
import { DomainError } from '../utils/errors.js';

const variablesService = new CourseVariablesService();

export default class CourseVariablesController {
  static async getCourseVariables(req, res, next) {
    try {
      const { courseId } = req.params;
      if (!courseId) throw new DomainError('courseId is required', 400);

      const variables = await variablesService.getCourseVariables(courseId);
      res.json({ exito: true, data: variables });
    } catch (error) {
      next(error);
    }
  }

  static async saveCourseVariables(req, res, next) {
    try {
      const { courseId } = req.params;
      if (!courseId) throw new DomainError('courseId is required', 400);

      const variablesObj = req.body.variables;
      if (!variablesObj) throw new DomainError('variables are required in the body', 400);

      const saved = await variablesService.saveCourseVariables(courseId, variablesObj);
      res.json({ exito: true, data: saved, mensaje: 'Course variables updated successfully.' });
    } catch (error) {
      next(error);
    }
  }
}
