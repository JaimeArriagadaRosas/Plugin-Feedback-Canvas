import db from '../../data/db.js';
import { ErrorHandler } from '../../middlewares/ErrorHandler.js';
import { getEnv, getCanvasEnv, isLocalDataEnabled, isProduction } from '../../config/index.js';
import { SECRET_REGISTRY, validateSecretsOrThrow, getSecret } from '../../config/secrets.js';
import configManager from '../config/ConfigManager.js';

import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import CanvasClient from '../infrastructure/CanvasClient.js';
import CanvasTokenManager from '../auth/CanvasTokenManager.js';
import CanvasLmsAdapter from '../../adapters/CanvasLmsAdapter.js';
import FeedbackService from '../FeedbackService.js';
import TemplateManager from '../TemplateManager.js';
import IAConfigManager from '../IAConfigManager.js';
import AcademicHistoryService from '../AcademicHistoryService.js';
import ValidadorAcademico from '../ValidadorAcademico.js';
import GeminiProvider from '../ia/GeminiProvider.js';
import LLMConfigurationService from '../../services/LLMConfigurationService.js';
import CourseVariablesService from '../../services/variables/CourseVariablesService.js';
import FeedbackWorkflowService from '../../services/FeedbackWorkflowService.js';
import TemplateValidatorService from '../../services/TemplateValidatorService.js';
import CanvasWebhookController from '../../controllers/CanvasWebhookController.js';
import StatsService from '../../services/StatsService.js';
import PermissionsManager from '../../modules/permissions/PermissionsManager.js';
import PermissionsManagerLocal from '../../modules/permissions/PermissionsManager.local.js';
import PreferencesService from '../../modules/preferences/PreferencesService.js';
import EmailServiceLocal from '../../modules/notifications/EmailService.local.js';
import NotificationDiagnosticsLocal from '../../modules/notifications/NotificationDiagnostics.local.js';
import TokenRotationJob from '../auth/TokenRotationJob.js';
import PrivateNoteService from '../../services/PrivateNoteService.js';
import WebhookService from '../../services/WebhookService.js';
import CourseService from '../../services/CourseService.js';

import FeedbackRepository from '../../data/FeedbackRepository.js';
import TemplateRepository from '../../data/TemplateRepository.js';
import ConfigRepository from '../../data/ConfigRepository.js';
import TokenRepository from '../../data/TokenRepository.js';
import CanvasTokenRepository from '../../data/CanvasTokenRepository.js';
import StudentRepository from '../../data/StudentRepository.js';
import PermissionsRepository from '../../data/PermissionsRepository.js';
import SystemNotificationRepository from '../../data/SystemNotificationRepository.js';
import SystemNotificationService from '../../services/SystemNotificationService.js';

import { registerRoutes } from './routes.js';
import { SSLService } from '../../security/SSLService.js';
import { isHttpsEnabled, getSslCertPaths } from '../../security/envGuard.js';
import { runMigrations } from '../../data/migrations.js';
// import { seedLocalUsers } from '../../validation/setup/seedLocalUsers.js';
// import { seedLocalTemplates } from '../../validation/setup/seedLocalTemplates.js';
import { isLocalModeAllowed } from '../../security/envGuard.js';
import logger from '../../utils/logger.js';

try {
  if (process.env.AUTO_MIGRATE === 'true') {
    logger.info('[BOOTSTRAP] Ejecutando migraciones de base de datos (AUTO_MIGRATE=true)...');
    await runMigrations();
    logger.info('[BOOTSTRAP] Migraciones completadas.');
  } else {
    logger.info('[BOOTSTRAP] Auto-migración desactivada. Ejecutar "npm run db:migrate" manualmente en despliegue.');
  }
} catch (err) {
  logger.error('[BOOTSTRAP] Fallo critico en migraciones:', err.message);
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveEnv() {
  const useLocalData = isLocalDataEnabled();

  if (useLocalData && isProduction()) {
    logger.warn('USE_LOCAL_DATA activo en entorno production. Esto desactiva la seguridad LTI real.');
  }

  const canvasBaseUrl = configManager.getCanvasBaseUrl();
  let canvasAccessToken = getCanvasEnv('CANVAS_ACCESS_TOKEN', 'VITE_CANVAS_ACCESS_TOKEN');
  const canvasApiHost = getEnv('CANVAS_API_HOST', process.env.STARTUP_MODE === '3' ? 'canvas.local' : 'localhost:8443');
  const canvasCourseId = getCanvasEnv('CANVAS_COURSE_ID', 'VITE_CANVAS_COURSE_ID') || '1';
  const canvasClientId = configManager.getLtiClientId();
  const canvasIssuer = configManager.getCanvasIssuer();
  const webhookSecret = getSecret('WEBHOOK_SECRET');
  const allowedDeploymentIds = configManager.getLtiDeploymentIds();

  if (!webhookSecret) {
    logger.warn('WEBHOOK_SECRET no configurado. Los webhooks de Canvas no estaran autenticados.');
  }

  if (!canvasAccessToken) {
    logger.warn('[BOOTSTRAP] No se encontró CANVAS_ACCESS_TOKEN en el entorno.');
  }

  return {
    useLocalData, canvasBaseUrl, canvasAccessToken, canvasCourseId,
    canvasClientId, canvasIssuer, webhookSecret, allowedDeploymentIds, canvasApiHost
  };
}



export async function generateLtiKeys() {
  const { generateKeyPairSync } = await import('node:crypto');
  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001
  });

  const publicKeyJwk = publicKey.export({ format: 'jwk' });

  const ltiPublicJwk = {
    ...publicKeyJwk,
    alg: 'RS256',
    use: 'sig',
    kid: `lti-key-${Date.now()}`
  };
  logger.info('[LTI] Par de claves LTI generado exitosamente.', { kid: ltiPublicJwk.kid });
  return ltiPublicJwk;
}

export function initializeDataLayer() {
  const feedbackRepo  = new FeedbackRepository(db);
  const templateRepo  = new TemplateRepository(db);
  const configRepo    = new ConfigRepository(db);
  const tokenRepo     = new TokenRepository(db);
  const canvasTokenRepo = new CanvasTokenRepository();
  const studentRepo   = new StudentRepository(db);
  const permissionsRepo = new PermissionsRepository(db);
  const systemNotificationRepo = new SystemNotificationRepository();

  logger.info('[DATA] Repositorios de datos inicializados.', {
    db: 'PostgreSQL real'
  });

  return { feedbackRepo, templateRepo, configRepo, tokenRepo, canvasTokenRepo, studentRepo, permissionsRepo, systemNotificationRepo };
}

export async function initializeServiceLayer(env, repos) {
  const { feedbackRepo, templateRepo, configRepo, tokenRepo, canvasTokenRepo, permissionsRepo } = repos;

  const canvasClient = new CanvasClient(env.canvasBaseUrl, env.canvasApiHost);
  const canvasTokenManager = new CanvasTokenManager(canvasTokenRepo, env, canvasClient);

  const canvasGateway = new CanvasLmsAdapter(canvasClient, canvasTokenManager, env);
  logger.info(`[CANVAS] Servicio inicializado: CanvasLmsAdapter (Paridad Producción)`);

  const iaProvider = new GeminiProvider(getSecret('GEMINI_API_KEY'));
  const academicHistoryService = new AcademicHistoryService(canvasGateway, repos.studentRepo);
  const templateManager = new TemplateManager(templateRepo);

  const iaConfigManager = new IAConfigManager(tokenRepo, configRepo);
  
  const preferencesService = new PreferencesService();
  const emailServiceLocal = new EmailServiceLocal();
  const diagnosticsService = process.env.NODE_ENV !== 'production' ? new NotificationDiagnosticsLocal() : null;
  const systemNotificationService = new SystemNotificationService(repos.systemNotificationRepo);

  const feedbackService = new FeedbackService(
    iaProvider,
    canvasGateway,
    feedbackRepo,
    templateRepo,
    academicHistoryService,
    ValidadorAcademico,
    configRepo,
    iaConfigManager,
    preferencesService,
    emailServiceLocal,
    systemNotificationService
  );

  const llmConfigService = new LLMConfigurationService();
  const variableConfigManager = new CourseVariablesService();
  const feedbackWorkflowService = new FeedbackWorkflowService(feedbackRepo, feedbackService, canvasGateway, preferencesService, emailServiceLocal, diagnosticsService);
  const templateValidatorService = new TemplateValidatorService();
  const webhookService = new WebhookService();
  const courseService = new CourseService(configRepo);
  const webhookController = new CanvasWebhookController(feedbackService, configRepo, webhookService);
  const statsService = new StatsService(feedbackRepo);
  const permissionsService = isLocalModeAllowed()
    ? new PermissionsManagerLocal(permissionsRepo)
    : new PermissionsManager(permissionsRepo);
  const tokenRotationJob = new TokenRotationJob(canvasTokenManager);
  const privateNoteService = new PrivateNoteService(feedbackRepo);

  return {
    canvasService: canvasGateway, feedbackService, templateManager, iaConfigManager,
    configRepo, llmConfigService, variableConfigManager,
    feedbackWorkflowService, templateValidatorService, feedbackRepo,
    webhookController, statsService, permissionsService, canvasTokenRepo,
    canvasTokenManager, canvasClient, tokenRotationJob, webhookService, courseService,
    privateNoteService, systemNotificationService
  };
}

/**
 * Localiza el build del frontend (dist/index.html) de forma robusta.
 *
 * CORRECCION (Fase A): el codigo anterior calculaba la ruta como
 * path.join(__dirname, '../../../dist'), lo que resolvia a
 * packages/server/dist (inexistente) y provocaba ENOENT + 404 en el
 * fallback SPA. El build real del cliente se genera en la raiz del repo
 * (dist/). En lugar de contar niveles fragiles de '../', se busca hacia
 * arriba el primer directorio 'dist' que contenga index.html, permitiendo
 * ademas sobreescribir la ubicacion con FRONTEND_DIST.
 */
function resolveFrontendDist(startDir) {
  if (process.env.FRONTEND_DIST) {
    return path.resolve(process.env.FRONTEND_DIST);
  }

  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, 'dist');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  logger.warn('[FRONTEND] No se encontró build (dist/index.html). SPA no se servirá desde el backend.');
  return path.join(startDir, '../../../../../dist');
}

function logSecretsSummary() {
  const missing = Object.keys(SECRET_REGISTRY).filter(nombre => !getSecret(nombre));
  if (missing.length) {
    logger.info(`[BOOTSTRAP] Estado de secretos verificado (${missing.join(', ')}: FALTA).`);
  } else {
    logger.info(`[BOOTSTRAP] Estado de secretos verificado (OK).`);
  }
}

export async function startServer(app, PORT) {
  const env = resolveEnv();

  validateSecretsOrThrow(SECRET_REGISTRY);
  logSecretsSummary();

  const ltiPublicJwk = await generateLtiKeys();
  process.env.LTI_PUBLIC_JWK = JSON.stringify(ltiPublicJwk);
  const repos = initializeDataLayer();
  const services = await initializeServiceLayer(env, repos);

  // Moved tokenRotationJob.start() to the listen callback

  registerRoutes(app, services, ltiPublicJwk);
  app.set('permissionsManager', services.permissionsService);

  const frontendDist = resolveFrontendDist(__dirname);
  logger.info(`[FRONTEND] Servidor estático: Sirviendo SPA desde carpeta /dist.`);

  app.use(express.static(frontendDist, { index: false }));

  app.use((req, res, next) => {
    const isApiLike =
      req.path.startsWith('/api') ||
      req.path.startsWith('/lti') ||
      req.path.startsWith('/health');

    if (isApiLike || req.method !== 'GET') {
      return res.status(404).json({
        exito: false,
        error: {
          mensaje: 'No encontrado',
          codigo: 404,
          path: req.originalUrl
        }
      });
    }

    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('Frontend no construido. Si estas en desarrollo, accede a través del puerto de Vite (5173).');
      }
    });
  });

  app.use(ErrorHandler);

  // ── HTTPS / HTTP ──────────────────────────────────────────────────────────
  // La resolución de esquemas es inmutable (depende de SSLService).
  logger.info(`[HTTPS] Esquema de transporte configurado (STARTUP_MODE: ${process.env.STARTUP_MODE ?? '(indefinido)'}).`);
  logger.debug(`[HTTPS] HTTPS env flag : ${process.env.HTTPS ?? '(indefinido / auto-detección)'}`);
  logger.debug(`[HTTPS] NODE_ENV       : ${process.env.NODE_ENV ?? '(indefinido)'}`);

  const sslContext = await SSLService.initializeSSLContext();
  const shouldUseHttps = isHttpsEnabled();
  const { cert, key } = getSslCertPaths();
  
  logger.debug(`[HTTPS] Entorno SSL detectado : ${JSON.stringify(sslContext.env)}`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  logger.debug(`[HTTPS] Certificado (pem)    : ${cert} -> ${fs.existsSync(cert) ? 'ENCONTRADO' : 'AUSENTE'}`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  logger.debug(`[HTTPS] Clave privada (key)  : ${key} -> ${fs.existsSync(key) ? 'ENCONTRADA' : 'AUSENTE'}`);
  logger.debug(`[HTTPS] DECISIÓN FINAL       : ${shouldUseHttps ? 'HTTPS (TLS)' : 'HTTP (plano)'}`);

  let server;
  if (shouldUseHttps) {
    const https = await import('node:https');
    let sslOptions;
    try {
      sslOptions = {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        key:  fs.readFileSync(key),
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        cert: fs.readFileSync(cert),
      };
      logger.info('[HTTPS] Certificados leídos correctamente. Creando servidor TLS...');
    } catch (err) {
      logger.error(`[HTTPS] ERROR al leer los certificados SSL: ${err.message}`);
      logger.error('[HTTPS] No se puede arrancar en HTTPS. Revise los archivos en apps/server/certs/.');
      throw err;
    }
    server = https.default.createServer(sslOptions, app);
  } else {
    server = app;
  }

  return new Promise((resolve, reject) => {
    server.listen(PORT, () => {
      const modeName = process.env.STARTUP_MODE === '1' ? 'LTI 1.3 (Canvas Real)' :
                       process.env.STARTUP_MODE === '2' ? 'API Canvas (Token Manual)' :
                       process.env.STARTUP_MODE === '3' ? 'Canvas Local (Docker)' : 'Local';

      server.setTimeout(300000);
      server.headersTimeout = 120000;
      server.keepAliveTimeout = 60000;
      if (services.tokenRotationJob) {
        server.tokenRotationJob = services.tokenRotationJob;
        services.tokenRotationJob.start();
      }
      logger.info('[SERVER] Timeouts configurados: timeout=300s, headers=120s, keepAlive=60s');

      logger.info('');
      logger.info('===================================================');
      logger.info(' 🚀 BACKEND INICIADO - Plugin Feedback Adaptativo');
      logger.info('===================================================');
      logger.info(`  • Puerto interno : ${PORT}`);
      logger.info(`  • Modo de inicio : ${modeName}`);
      logger.info(`  • Base de datos  : PostgreSQL real`);
      logger.info(`  • Sesión local   : ${env.useLocalData ? 'Activa (esperando dev-token cookie)' : 'Inactiva'}`);
      logger.info('---------------------------------------------------');
      const scheme = isHttpsEnabled() ? 'https' : 'http';
      logger.info(`  🌐 Interfaz UI   : ${process.env.FRONTEND_URL || 'https://localhost:5173/'}`);
      logger.info(`  ⚙️  API Backend   : ${scheme}://localhost:${PORT}/`);
      logger.info(`  📄 Logs          : ${console.logFile || 'Solo consola'}`);
      logger.info('===================================================');
      if (shouldUseHttps) {
        logger.info('  💡 NOTA: mkcert ya instaló la confianza en el sistema.');
        logger.info('     Pero si por algún motivo tu navegador bloquea el Iframe');
        logger.info('     en Canvas, haz clic en el siguiente enlace:');
        logger.info(`     👉 https://localhost:${PORT}/health`);
        logger.info('===================================================');
      }
      logger.info('');
      resolve(server);
    }).on('error', (err) => {
      logger.error(`[${shouldUseHttps ? 'HTTPS' : 'HTTP'}] ERROR al escuchar en el puerto ${PORT}: ${err.message}`);
      reject(err);
    });
  });
}
