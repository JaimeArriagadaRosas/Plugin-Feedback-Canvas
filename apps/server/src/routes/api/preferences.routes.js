import express from 'express';

export function createPreferencesRoutes(preferencesController) {
  const router = express.Router();

  // GET /api/preferences -> Obtiene preferencias del estudiante
  router.get('/', preferencesController.getPreferences);

  // PUT /api/preferences -> Actualiza preferencias del estudiante
  router.put('/', preferencesController.updatePreferences);

  return router;
}
