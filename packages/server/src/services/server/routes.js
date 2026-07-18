import { AuthLTI13Handler, refreshLtiTokenCookie } from '../../middlewares/AuthLTI13Handler.js';
import GestorRutasAPI from '../../routes/GestorRutasAPI.js';
import SystemConfigController from '../../controllers/SystemConfigController.js';
import LocalAuthController from '../../controllers/AuthController_local.js';
import canvasSessionRouter from '../../routes/canvasSession.js';
import deepDiagnosticRouter from '../../routes/deepDiagnostic.js';

export function registerRoutes(app, services, ltiPublicJwk) {
  // Endpoint visual para que el desarrollador confirme el certificado mkcert
  app.get('/health', (req, res) => {
    res.send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center; color: #333;">
        <h1 style="color: #4CAF50;">✅ Conexión Segura Establecida</h1>
        <p>Has aceptado correctamente el certificado de desarrollo HTTPS (mkcert).</p>
        <p><strong>Ya puedes cerrar esta pestaña y volver a Canvas. El plugin cargará sin problemas.</strong></p>
      </div>
    `);
  });
  app.use('/api', AuthLTI13Handler, refreshLtiTokenCookie);

  const localAuth = new LocalAuthController();
  app.post('/api/auth/local-login', (req, res, next) => localAuth.localLogin(req, res, next));
  app.post('/api/auth/local-logout', (req, res, next) => localAuth.localLogout(req, res, next));
  app.post('/api/auth/lti-logout', (req, res, next) => localAuth.ltiLogout(req, res, next));

  app.use('/api/canvas', canvasSessionRouter);
  app.use('/api/canvas', deepDiagnosticRouter);

  const dependencias = {
    canvasService: services.canvasService,
    feedbackService: services.feedbackService,
    templateManager: services.templateManager,
    iaConfigManager: services.iaConfigManager,
    configRepo: services.configRepo,
    llmConfigService: services.llmConfigService,
    variableConfigManager: services.variableConfigManager,
    feedbackWorkflowService: services.feedbackWorkflowService,
    feedbackRepo: services.feedbackRepo,
    webhookController: services.webhookController,
    ltiPublicJwk
  };
  const gestorRutas = new GestorRutasAPI(dependencias);
  app.use('/api', gestorRutas.getRouter());

  const systemConfig = new SystemConfigController();
  app.get('/api/config/startup-mode', (req, res) => systemConfig.getStartupMode(req, res));
  app.post('/api/config/set-local-role', (req, res) => systemConfig.setLocalRole(req, res));
  app.post('/api/config/clear-local-role', (req, res) => systemConfig.clearLocalRole(req, res));
  app.get('/api/config/me', (req, res) => systemConfig.getMe(req, res));
}
