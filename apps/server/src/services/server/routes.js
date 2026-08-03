import { AuthLTI13Handler, refreshLtiTokenCookie } from '../../middlewares/AuthLTI13Handler.js';
import GestorRutasAPI from '../../routes/GestorRutasAPI.js';
import SystemConfigController from '../../controllers/SystemConfigController.js';
import LocalAuthController from '../../controllers/AuthController.local.js';
import authRouter from '../../routes/auth.js';
import canvasSessionRouter from '../../routes/canvasSession.js';
import deepDiagnosticRouter from '../../routes/deepDiagnostic.js';
import createVariablesRoutes from '../../routes/variablesRoutes.js';
import db from '../../data/db.js';
import logger from '../../utils/logger.js';
import { getCanvasCircuitBreaker } from '../../services/infrastructure/CanvasClient.js';
import { nowIso } from '../../utils/datetime.js';
import { idempotencyManager } from '../../middlewares/IdempotencyKeyManager.js';

export function registerRoutes(app, services, ltiPublicJwk) {
  app.get('/health', (req, res) => {
    res.send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center; color: #333;">
        <h1 style="color: #4CAF50;">✅ Conexión Segura Establecida</h1>
        <p>Has aceptado correctamente el certificado de desarrollo HTTPS (mkcert).</p>
        <p><strong>Ya puedes cerrar esta pestaña y volver a Canvas. El plugin cargará sin problemas.</strong></p>
      </div>
    `);
  });

  app.get('/health/detailed', async (req, res) => {
    const reqId = req._logId;
    const checks = {
      timestamp: nowIso(),
      uptime: process.uptime(),
      db: { status: 'unknown' },
      canvas: { status: 'unknown' },
      webhooks: { status: 'unknown' },
      jwks: { status: 'unknown' }
    };

    let dbOk = false;
    try {
      await db.query('SELECT 1');
      checks.db.status = 'ok';
      dbOk = true;
    } catch (e) {
      checks.db.status = 'error';
      checks.db.error = e.message;
      logger.warn('[Health] DB check failed:', { reqId, error: e.message });
    }

    let canvasOk = false;
    try {
      if (services.canvasClient) {
        const circuit = getCanvasCircuitBreaker();
        checks.canvas.status = circuit.canAttempt() ? 'ok' : 'circuit_open';
        checks.canvas.circuitState = circuit.state;
        canvasOk = circuit.state === 'CLOSED' || circuit.state === 'HALF_OPEN';
      } else {
        checks.canvas.status = 'no_client';
      }
    } catch (e) {
      checks.canvas.status = 'error';
      checks.canvas.error = e.message;
    }

    let webhookOk = false;
    try {
      if (services.webhookController) {
        const dlResult = await db.query('SELECT COUNT(*) AS count FROM webhook_dead_letter');
        checks.webhooks.deadLetterCount = parseInt(dlResult.rows[0]?.count || '0', 10);
        checks.webhooks.status = checks.webhooks.deadLetterCount > 100 ? 'degraded' : 'ok';
        webhookOk = true;
      } else {
        checks.webhooks.status = 'no_controller';
      }
    } catch (e) {
      checks.webhooks.status = 'error';
      checks.webhooks.error = e.message;
    }

    try {
      checks.jwks.status = ltiPublicJwk?.kid ? 'ok' : 'missing';
      checks.jwks.kid = ltiPublicJwk?.kid || null;
    } catch (e) {
      checks.jwks.status = 'error';
    }

    const allOk = dbOk && (canvasOk || !services.canvasClient) && (webhookOk || !services.webhookController);
    const statusCode = allOk ? 200 : 503;

    logger.info('[Health] Detailed check', { reqId, status: allOk ? 'healthy' : 'degraded' });
    res.status(statusCode).json({ status: allOk ? 'healthy' : 'degraded', checks });
  });
  app.use('/api', AuthLTI13Handler, refreshLtiTokenCookie);

  const localAuth = new LocalAuthController();
  app.post('/api/auth/local-login', (req, res, next) => localAuth.localLogin(req, res, next));
  app.post('/api/auth/local-logout', (req, res, next) => localAuth.localLogout(req, res, next));
  app.post('/api/auth/lti-logout', (req, res, next) => localAuth.ltiLogout(req, res, next));

  app.use('/api/auth', authRouter);

  app.use('/api/canvas', canvasSessionRouter);
  app.use('/api/canvas', deepDiagnosticRouter);
  app.use('/api/courses', createVariablesRoutes());

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
    statsService: services.statsService,
    permissionsService: services.permissionsService,
    canvasTokenRepo: services.canvasTokenRepo,
    courseService: services.courseService,
    privateNoteService: services.privateNoteService,
    systemNotificationService: services.systemNotificationService,
    ltiPublicJwk
  };
  app.use('/api', idempotencyManager.middleware());
  
  const gestorRutas = new GestorRutasAPI(dependencias);
  app.use('/api', gestorRutas.getRouter());

  const systemConfig = new SystemConfigController();
  app.get('/api/config/startup-mode', (req, res) => systemConfig.getStartupMode(req, res));
  app.post('/api/config/set-local-role', (req, res) => systemConfig.setLocalRole(req, res));
  app.post('/api/config/clear-local-role', (req, res) => systemConfig.clearLocalRole(req, res));
  app.get('/api/config/me', (req, res) => systemConfig.getMe(req, res));
}
