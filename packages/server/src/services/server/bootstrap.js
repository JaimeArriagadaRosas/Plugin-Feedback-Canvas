import db from '../../data/db.js';
import { ErrorHandler } from '../../middlewares/ErrorHandler.js';
import { authLimiter, webhookLimiter } from '../../middlewares/security.js';
import { getEnv, getCanvasEnv, isLocalDataEnabled, isProduction } from '../../config/index.js';
import { SECRET_REGISTRY, validateSecretsOrThrow, getSecret, maskSecret } from '../../config/secrets.js';

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
import VariableConfigManager from '../../services/VariableConfigManager.js';
import FeedbackWorkflowService from '../../services/FeedbackWorkflowService.js';
import TemplateValidatorService from '../../services/TemplateValidatorService.js';
import CanvasWebhookController from '../../controllers/CanvasWebhookController.js';
import StatsService from '../../services/StatsService.js';
import PermissionsService from '../../services/PermissionsService.js';

import FeedbackRepository from '../../data/FeedbackRepository.js';
import TemplateRepository from '../../data/TemplateRepository.js';
import ConfigRepository from '../../data/ConfigRepository.js';
import TokenRepository from '../../data/TokenRepository.js';
import CanvasTokenRepository from '../../data/CanvasTokenRepository.js';
import StudentRepository from '../../data/StudentRepository.js';
import PermissionsRepository from '../../data/PermissionsRepository.js';

import { registerRoutes } from './routes.js';
import { SSLService } from '../../security/SSLService.js';
import { isHttpsEnabled, getSslCertPaths } from '../../security/envGuard.js';
import { runMigrations } from '../../data/migrations.js';
import { seedLocalUsers } from '../../validation/setup/seedLocalUsers.js';
import { seedLocalTemplates } from '../../validation/setup/seedLocalTemplates.js';
import { isLocalModeAllowed } from '../../security/envGuard.js';
import logger from '../../utils/logger.js';

<<<<<<< Updated upstream
if (isLocalModeAllowed()) {
  runMigrations().catch(err => logger.warn('[BOOTSTRAP] Migrations skipped:', err.message));
  seedLocalUsers().catch(err => logger.warn('[BOOTSTRAP] Seed skipped:', err.message));
=======
if (!isLocalModeAllowed()) {
  try {
    logger.info('[BOOTSTRAP] Ejecutando migraciones de base de datos...');
    await runMigrations();
    logger.info('[BOOTSTRAP] Migraciones completadas.');
    await seedLocalTemplates().catch(err => logger.warn('[BOOTSTRAP] Seed plantillas (postgres) skipped:', err.message));
  } catch (err) {
    logger.error('[BOOTSTRAP] Fallo critico en migraciones:', err.message);
    process.exit(1);
  }
} else {
  seedLocalUsers().catch(err => logger.warn('[BOOTSTRAP] Seed usuarios skipped:', err.message));
  seedLocalTemplates().catch(err => logger.warn('[BOOTSTRAP] Seed plantillas skipped:', err.message));
>>>>>>> Stashed changes
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveEnv() {
  const useLocalData = isLocalDataEnabled();

  if (useLocalData && isProduction()) {
    logger.warn('USE_LOCAL_DATA activo en entorno production. Esto desactiva la seguridad LTI real.');
  }

  const canvasBaseUrl = getCanvasEnv('CANVAS_BASE_URL', 'VITE_CANVAS_BASE_URL') || 'https://canvas.instructure.com';
  let canvasAccessToken = getCanvasEnv('CANVAS_ACCESS_TOKEN', 'VITE_CANVAS_ACCESS_TOKEN');
  const canvasApiHost = getEnv('CANVAS_API_HOST', process.env.STARTUP_MODE === '3' ? 'canvas.local' : 'localhost:8443');
  const canvasCourseId = getCanvasEnv('CANVAS_COURSE_ID', 'VITE_CANVAS_COURSE_ID') || '1';
  const canvasClientId = getEnv('CANVAS_CLIENT_ID', getEnv('LTI_CLIENT_ID', '10000000000001'));
  const canvasIssuer = getEnv('CANVAS_ISSUER', canvasBaseUrl);
  const webhookSecret = getSecret('WEBHOOK_SECRET');
  const allowedDeploymentIds = getEnv('LTI_DEPLOYMENT_IDS', '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!webhookSecret) {
    logger.warn('WEBHOOK_SECRET no configurado. Los webhooks de Canvas no estaran autenticados.');
  }

  // En modo Canvas Local (Docker), el token de API del .env es auto-sanado por el orquestador Python.
  // Confiamos exclusivamente en el token provisto por la variable de entorno.
  if (process.env.STARTUP_MODE === '3' && !canvasAccessToken) {
    logger.warn('[BOOTSTRAP] No se encontró CANVAS_ACCESS_TOKEN en el .env. GET /api/courses puede responder 401.');
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
  logger.info('Par de claves LTI generado', { kid: ltiPublicJwk.kid });
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

  logger.info('Repositorios de datos inicializados', {
    db: db.isLocalMode() ? 'LOCAL (sin PostgreSQL)' : 'PostgreSQL real'
  });

  return { feedbackRepo, templateRepo, configRepo, tokenRepo, canvasTokenRepo, studentRepo, permissionsRepo };
}

export function initializeServiceLayer(env, repos) {
  const { feedbackRepo, templateRepo, configRepo, tokenRepo, canvasTokenRepo, permissionsRepo } = repos;

  const canvasClient = new CanvasClient(env.canvasBaseUrl, env.canvasApiHost);
  const canvasTokenManager = new CanvasTokenManager(canvasTokenRepo, env, canvasClient);

  const canvasGateway = new CanvasLmsAdapter(canvasClient, canvasTokenManager, env);

  logger.info(`Servicio Canvas: CanvasLmsAdapter (useLocalData=${env.useLocalData})`);

  const iaProvider = new GeminiProvider(getSecret('GEMINI_API_KEY'));
  const academicHistoryService = new AcademicHistoryService(canvasGateway, repos.studentRepo);
  const templateManager = new TemplateManager(templateRepo);

  const feedbackService = new FeedbackService(
    iaProvider,
    canvasGateway,
    feedbackRepo,
    templateRepo,
    academicHistoryService,
    ValidadorAcademico,
    configRepo
  );

  const iaConfigManager = new IAConfigManager(tokenRepo, configRepo);
  const llmConfigService = new LLMConfigurationService();
  const variableConfigManager = new VariableConfigManager();
  const feedbackWorkflowService = new FeedbackWorkflowService(feedbackRepo, feedbackService, canvasGateway);
  const templateValidatorService = new TemplateValidatorService();
  const webhookController = new CanvasWebhookController(feedbackService, configRepo);
  const statsService = new StatsService(feedbackRepo);
  const permissionsService = new PermissionsService(permissionsRepo);

  return {
    canvasService: canvasGateway, feedbackService, templateManager, iaConfigManager,
    configRepo, llmConfigService, variableConfigManager,
    feedbackWorkflowService, templateValidatorService, feedbackRepo,
    webhookController, statsService, permissionsService, canvasTokenRepo,
    canvasTokenManager, canvasClient
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
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  logger.warn('[BOOTSTRAP] No se encontro un build del frontend (dist/index.html). El SPA no se servira desde el backend.');
  return path.join(startDir, '../../../../../dist');
}

function logSecretsSummary() {
  const resumenStr = Object.keys(SECRET_REGISTRY)
    .map((nombre) => `${nombre}: ${getSecret(nombre) ? 'OK' : 'FALTA'}`)
    .join(', ');
  logger.info(`[BOOTSTRAP] Estado de secretos: [ ${resumenStr} ]`);
}

export async function startServer(app, PORT) {
  const env = resolveEnv();

  validateSecretsOrThrow(SECRET_REGISTRY);
  logSecretsSummary();

  const ltiPublicJwk = await generateLtiKeys();
  process.env.LTI_PUBLIC_JWK = JSON.stringify(ltiPublicJwk);
  const repos = initializeDataLayer();
  const services = initializeServiceLayer(env, repos);

  registerRoutes(app, services, ltiPublicJwk);

  const frontendDist = resolveFrontendDist(__dirname);
  logger.info(`[BOOTSTRAP] Sirviendo frontend estatico desde: ${frontendDist}`);

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
  logger.info('[HTTPS] Iniciando resolución de esquema de transporte...');
  logger.info(`[HTTPS]   HTTPS env flag : ${process.env.HTTPS ?? '(indefinido / auto-detección)'}`);
  logger.info(`[HTTPS]   NODE_ENV       : ${process.env.NODE_ENV ?? '(indefinido)'}`);
  logger.info(`[HTTPS]   STARTUP_MODE   : ${process.env.STARTUP_MODE ?? '(indefinido)'}`);

  const sslContext = await SSLService.initializeSSLContext();
  const shouldUseHttps = isHttpsEnabled();
  const { cert, key } = getSslCertPaths();
  
  logger.info(`[HTTPS] Entorno SSL detectado : ${JSON.stringify(sslContext.env)}`);
  logger.info(`[HTTPS] Certificado (pem)    : ${cert} -> ${fs.existsSync(cert) ? 'ENCONTRADO' : 'AUSENTE'}`);
  logger.info(`[HTTPS] Clave privada (key)  : ${key} -> ${fs.existsSync(key) ? 'ENCONTRADA' : 'AUSENTE'}`);
  logger.info(`[HTTPS] DECISIÓN FINAL       : ${shouldUseHttps ? 'HTTPS (TLS)' : 'HTTP (plano)'}`);

  let server;
  if (shouldUseHttps) {
    const https = await import('node:https');
    let sslOptions;
    try {
      sslOptions = {
        key:  fs.readFileSync(key),
        cert: fs.readFileSync(cert),
      };
      logger.info('[HTTPS] Certificados leídos correctamente. Creando servidor TLS...');
    } catch (err) {
      logger.error(`[HTTPS] ERROR al leer los certificados SSL: ${err.message}`);
      logger.error('[HTTPS] No se puede arrancar en HTTPS. Revise los archivos en packages/server/certs/.');
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

      logger.info('===================================================');
      logger.info('BACKEND INICIADO - Plugin Feedback Adaptativo');
      logger.info('===================================================');
      logger.info(`Puerto interno: ${PORT}`);
      logger.info(`Modo de inicio: ${modeName}`);
      logger.info(`Base de datos: ${db.isLocalMode() ? 'Datos locales (sin PostgreSQL)' : 'PostgreSQL real'}`);
      logger.info(`Sesion local: ${env.useLocalData ? 'Activa (esperando dev-token cookie)' : 'Inactiva'}`);
      logger.info('---------------------------------------------------');
      const scheme = isHttpsEnabled() ? 'https' : 'http';
      logger.info(`Interfaz de usuario: ${process.env.FRONTEND_URL || 'https://localhost:5173/'}`);
      logger.info(`Backend: ${scheme}://localhost:${PORT}/`);
      logger.info(`Logs del backend: ${console.logFile || 'Solo consola'}`);
      logger.info('===================================================');
      if (shouldUseHttps) {
        logger.info('  💡 NOTA: mkcert ya instaló la confianza en el sistema.');
        logger.info('     Pero si por algún motivo tu navegador bloquea el Iframe');
        logger.info('     en Canvas, haz clic en el siguiente enlace para forzar la confianza:');
        logger.info(`     👉 https://localhost:${PORT}/health`);
        logger.info('===================================================');
      }
      server.setTimeout(120000);
      server.headersTimeout = 60000;
      server.keepAliveTimeout = 5000;
      logger.info('[SERVER] Timeouts configurados: timeout=120s, headersTimeout=60s, keepAliveTimeout=5s');
      resolve(server);
    }).on('error', (err) => {
      logger.error(`[${shouldUseHttps ? 'HTTPS' : 'HTTP'}] ERROR al escuchar en el puerto ${PORT}: ${err.message}`);
      reject(err);
    });
  });
}
