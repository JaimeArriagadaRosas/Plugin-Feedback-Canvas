import express from 'express';
import { authorizeRole } from '../../authz/authorizeRole.js';
import { handleValidationErrors, validateId } from '../../middlewares/security.js';
import { schemas, validateBody } from '../../security/validation.js';

export function createTemplateRoutes(templateCtrl) {
  const router = express.Router();

  router.get('/', authorizeRole(['teacher']), handleValidationErrors, (req, res, next) => templateCtrl.getAll(req, res, next));
  router.get('/:id', authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, (req, res, next) => templateCtrl.getOne(req, res, next));
  router.post('/', authorizeRole(['teacher']), validateBody(schemas.templateCreate), (req, res, next) => templateCtrl.create(req, res, next));
  router.put('/:id', authorizeRole(['teacher']), ...validateId('id'), validateBody(schemas.templateUpdate), (req, res, next) => templateCtrl.update(req, res, next));
  router.delete('/:id', authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, (req, res, next) => templateCtrl.delete(req, res, next));

  return router;
}
