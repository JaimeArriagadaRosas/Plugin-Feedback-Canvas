import express from 'express';

export function createPreferencesRoutes(preferencesController) {
  const router = express.Router();

  // GET /api/preferences -> Retrieves student preferences
  router.get('/', preferencesController.getPreferences);

  // PUT /api/preferences -> Updates student preferences
  router.put('/', preferencesController.updatePreferences);

  return router;
}
