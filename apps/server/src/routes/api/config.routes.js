import express from 'express';
import { authorizeRole } from '../../authz/authorizeRole.js';
import { requirePermission } from '../../authz/requirePermission.js';
import { schemas, validateBody } from '../../security/validation.js';

export function createConfigRoutes(configCtrl, iaConfigCtrl, permissionsCtrl, variableCtrl) {
  const router = express.Router();

  router.put('/ia-model', authorizeRole(['admin', 'teacher']), requirePermission('config_llm'), validateBody(schemas.iaModel), (req, res, next) => configCtrl.setIAModel(req, res, next));
  router.get('/tokens/status', authorizeRole(['admin', 'teacher']), requirePermission('config_llm'), (req, res, next) => configCtrl.getTokenStatus(req, res, next));
  router.get('/tokens', authorizeRole(['admin', 'teacher']), requirePermission('config_llm'), (req, res, next) => configCtrl.getTokens(req, res, next));
  router.post('/tokens', authorizeRole(['admin', 'teacher']), requirePermission('config_llm'), validateBody(schemas.iaToken), (req, res, next) => configCtrl.saveToken(req, res, next));
  router.get('/ia-models', authorizeRole(['admin', 'teacher']), requirePermission('config_llm'), (req, res, next) => configCtrl.getAvailableModels(req, res, next));
  
  router.get('/ia-advanced', authorizeRole(['admin', 'teacher']), requirePermission('config_llm'), (req, res, next) => iaConfigCtrl.getConfig(req, res, next));
  router.put('/ia-advanced', authorizeRole(['admin', 'teacher']), requirePermission('config_llm'), validateBody(schemas.iaAdvancedConfig), (req, res, next) => iaConfigCtrl.updateConfig(req, res, next));
  
  router.get('/permissions', authorizeRole(['admin']), (req, res, next) => permissionsCtrl.getAllPermissions(req, res, next));
  router.put('/permissions/:role', authorizeRole(['admin']), (req, res, next) => permissionsCtrl.updatePermissions(req, res, next));
  
  // Variables de curso están bajo /courses/:courseId/variables en GestorRutasAPI, así que las exportamos separadas o aquí en /
  router.get('/courses/:courseId/variables', authorizeRole(['teacher', 'admin']), (req, res, next) => variableCtrl.getVariables(req, res, next));
  router.put('/courses/:courseId/variables', authorizeRole(['teacher', 'admin']), validateBody(schemas.courseVariables), (req, res, next) => variableCtrl.saveVariables(req, res, next));

  return router;
}
