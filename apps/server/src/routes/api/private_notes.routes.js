import express from 'express';
import { handleValidationErrors, validateId } from '../../middlewares/security.js';
import { authorizeRole } from '../../authz/authorizeRole.js';

export function createPrivateNotesRoutes(privateNoteCtrl) {
  const router = express.Router();

  router.put('/:id', 
    authorizeRole(['teacher', 'admin']), 
    ...validateId('id'),
    handleValidationErrors,
    (req, res, next) => privateNoteCtrl.updateNote(req, res, next)
  );

  return router;
}
