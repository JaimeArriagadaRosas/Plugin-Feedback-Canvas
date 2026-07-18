import db from '../../data/db.js';
import { ErrorHandler } from '../../middlewares/ErrorHandler.js';
import { authLimiter, webhookLimiter } from '../../middlewares/security.js';
import { getEnv, getCanvasEnv, isLocalDataEnabled, isProduction } from '../../config/index.js';
import { SECRET_REGISTRY, validateSecretsOrThrow, getSecret, maskSecret } from '../../config/secrets.js';

import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import CanvasService from '../infrastructure/CanvasService.js';
import CanvasServiceLocal from '../infrastructure/CanvasService_local.js';
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
import StudentRepository from '../../data/StudentRepository.js';
import PermissionsRepository from '../../data/PermissionsRepository.js';

import { registerRoutes } from './routes.js';
import { SSLService } from '../../security/SSLService.js';
import { isHttpsEnabled, getSslCertPaths } from '../../security/envGuard.js';
import { runMigrations } from '../../data/migrations.js';
import { seedLocalUsers } from '../../validation/setup/seedLocalUsers.js';
import { isLocalModeAllowed } from '../../security/envGuard.js';

if (isLocalModeAllowed()) {
  runMigrations().catch(err => console.warn('[BOOTSTRAP] Migrations skipped:', err.message));
  seedLocalUsers().catch(err => console.warn('[BOOTSTRAP] Seed skipped:', err.message));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveEnv() {
  const useLocalData = isLocalDataEnabled();

  if (useLocalData && isProduction()) {
    console.warn('USE_LOCAL_DATA activo en entorno production. Esto desactiva la seguridad LTI real.');
  }

  const canvasBaseUrl = getCanvasEnv('CANVAS_BASE_URL', 'VITE_CANVAS_BASE_URL') || 'https://canvas.instructure.com';
  let canvasAccessToken = getCanvasEnv('CANVAS_ACCESS_TOKEN', 'VITE_CANVAS_ACCESS_TOKEN');
  const canvasApiHost = getEnv('CANVAS_API_HOST', 'canvas.local');
  const canvasCourseId = getCanvasEnv('CANVAS_COURSE_ID', 'VITE_CANVAS_COURSE_ID') || '1';
  const canvasClientId = getEnv('CANVAS_CLIENT_ID', getEnv('LTI_CLIENT_ID', '10000000000001'));
  const canvasIssuer = getEnv('CANVAS_ISSUER', canvasBaseUrl);
  const webhookSecret = getSecret('WEBHOOK_SECRET');
  const allowedDeploymentIds = getEnv('LTI_DEPLOYMENT_IDS', '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!webhookSecret) {
    console.warn('WEBHOOK_SECRET no configurado. Los webhooks de Canvas no estaran autenticados.');
  }

  // En modo Canvas Local (Docker) el token de API del .env suele apuntar a
  // producción o estar expirado. Si existe el perfil local del profesor con
  // un token generado por el orquestador, lo usamos para autenticar la
  // Canvas API real contra https://localhost:8080.
  const isCanvasLocal = process.env.STARTUP_MODE === '3';
  if (isCanvasLocal) {
    const localToken = readLocalTeacherToken();
    if (localToken) {
      if (canvasAccessToken && canvasAccessToken !== localToken) {
        console.info('[BOOTSTRAP] Usando token de profesor local (perfiles_data.json) en lugar del CANVAS_ACCESS_TOKEN del .env.');
      }
      canvasAccessToken = localToken;
    } else if (!canvasAccessToken) {
      console.warn('[BOOTSTRAP] No se encontró token del profesor local. GET /api/courses puede responder 401.');
    }
  }

  return {
    useLocalData, canvasBaseUrl, canvasAccessToken, canvasCourseId,
    canvasClientId, canvasIssuer, webhookSecret, allowedDeploymentIds, canvasApiHost
  };
}

/**
 * Lee el token de API del profesor generado por el orquestador en el Canvas
 * Local (Docker) desde tmp/perfiles_data.json. Devuelve null si no existe.
 */
function readLocalTeacherToken() {
  try {
    const profilesPath = path.resolve(__dirname, '../../../../canvas-lms-master/tmp/perfiles_data.json');
    if (!fs.existsSync(profilesPath)) return null;
    const data = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
    const teacher = (data.usuarios || []).find(u => u.rol === 'teacher' && u.token);
    return teacher?.token || null;
  } catch {
    return null;
  }
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
  console.info('Par de claves LTI generado', { kid: ltiPublicJwk.kid });
  return ltiPublicJwk;
}

export function initializeDataLayer() {
  const feedbackRepo  = new FeedbackRepository(db);
  const templateRepo  = new TemplateRepository(db);
  const configRepo    = new ConfigRepository(db);
  const tokenRepo     = new TokenRepository(db);
  const studentRepo   = new StudentRepository(db);
  const permissionsRepo = new PermissionsRepository(db);

  console.info('Repositorios de datos inicializados', {
    db: db.isLocalMode() ? 'LOCAL (sin PostgreSQL)' : 'PostgreSQL real'
  });

  return { feedbackRepo, templateRepo, configRepo, tokenRepo, studentRepo, permissionsRepo };
}

export function initializeServiceLayer(env, repos) {
  const { feedbackRepo, templateRepo, configRepo, tokenRepo, permissionsRepo } = repos;

  const canvasService = env.useLocalData
    ? new CanvasServiceLocal()
    : new CanvasService(
        env.canvasAccessToken,
        env.canvasBaseUrl,
        env.canvasApiHost
      );

  console.info(`Servicio Canvas: ${env.useLocalData ? 'CanvasServiceLocal (datos locales)' : 'CanvasService (API real)'}`);

  const iaProvider = new GeminiProvider(getSecret('GEMINI_API_KEY'));
  const academicHistoryService = new AcademicHistoryService(canvasService, repos.studentRepo);
  const templateManager = new TemplateManager(templateRepo);

  const feedbackService = new FeedbackService(
    iaProvider,
    canvasService,
    feedbackRepo,
    templateRepo,
    academicHistoryService,
    ValidadorAcademico,
    configRepo
  );

  const iaConfigManager = new IAConfigManager(tokenRepo, configRepo);
  const llmConfigService = new LLMConfigurationService();
  const variableConfigManager = new VariableConfigManager();
  const feedbackWorkflowService = new FeedbackWorkflowService(feedbackRepo, feedbackService, canvasService);
  const templateValidatorService = new TemplateValidatorService();
  const webhookController = new CanvasWebhookController(feedbackService);
  const statsService = new StatsService(feedbackRepo);
  const permissionsService = new PermissionsService(permissionsRepo);

  return {
    canvasService, feedbackService, templateManager, iaConfigManager,
    configRepo, llmConfigService, variableConfigManager,
    feedbackWorkflowService, templateValidatorService, feedbackRepo,
    webhookController, statsService, permissionsService
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

  console.warn('[BOOTSTRAP] No se encontro un build del frontend (dist/index.html). El SPA no se servira desde el backend.');
  return path.join(startDir, '../../../../../dist');
}

function logSecretsSummary() {
  const resumenStr = Object.keys(SECRET_REGISTRY)
    .map((nombre) => `${nombre}: ${getSecret(nombre) ? 'OK' : 'FALTA'}`)
    .join(', ');
  console.info(`[BOOTSTRAP] Estado de secretos: [ ${resumenStr} ]`);
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
  console.info(`[BOOTSTRAP] Sirviendo frontend estatico desde: ${frontendDist}`);

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

    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.use(ErrorHandler);

  // ── HTTPS / HTTP ──────────────────────────────────────────────────────────
  // La resolución de esquemas es inmutable (depende de SSLService).
  console.info('[HTTPS] Iniciando resolución de esquema de transporte...');
  console.info(`[HTTPS]   HTTPS env flag : ${process.env.HTTPS ?? '(indefinido / auto-detección)'}`);
  console.info(`[HTTPS]   NODE_ENV       : ${process.env.NODE_ENV ?? '(indefinido)'}`);
  console.info(`[HTTPS]   STARTUP_MODE   : ${process.env.STARTUP_MODE ?? '(indefinido)'}`);

  const sslContext = await SSLService.initializeSSLContext();
  const shouldUseHttps = isHttpsEnabled();
  const { cert, key } = getSslCertPaths();
  
  console.info(`[HTTPS] Entorno SSL detectado : ${JSON.stringify(sslContext.env)}`);
  console.info(`[HTTPS] Certificado (pem)    : ${cert} -> ${fs.existsSync(cert) ? 'ENCONTRADO' : 'AUSENTE'}`);
  console.info(`[HTTPS] Clave privada (key)  : ${key} -> ${fs.existsSync(key) ? 'ENCONTRADA' : 'AUSENTE'}`);
  console.info(`[HTTPS] DECISIÓN FINAL       : ${shouldUseHttps ? 'HTTPS (TLS)' : 'HTTP (plano)'}`);

  if (shouldUseHttps) {
    const https = await import('node:https');
    let sslOptions;
    try {
      sslOptions = {
        key:  fs.readFileSync(key),
        cert: fs.readFileSync(cert),
      };
      console.info('[HTTPS] Certificados leídos correctamente. Creando servidor TLS...');
    } catch (err) {
      console.error(`[HTTPS] ERROR al leer los certificados SSL: ${err.message}`);
      console.error('[HTTPS] No se puede arrancar en HTTPS. Revise los archivos en packages/server/certs/.');
      throw err;
    }
    https.default.createServer(sslOptions, app).listen(PORT, () => {
      const modeName = process.env.STARTUP_MODE === '1' ? 'LTI 1.3 (Canvas Real)' :
                       process.env.STARTUP_MODE === '2' ? 'API Canvas (Token Manual)' :
                       process.env.STARTUP_MODE === '3' ? 'Canvas Local (Docker)' : 'Local';

      console.info('===================================================');
      console.info('BACKEND INICIADO - Plugin Feedback Adaptativo (HTTPS)');
      console.info('===================================================');
      console.info(`Puerto interno: ${PORT}`);
      console.info(`Modo de inicio: ${modeName}`);
      console.info(`Base de datos: ${db.isLocalMode() ? 'Datos locales (sin PostgreSQL)' : 'PostgreSQL real'}`);
      console.info(`Sesion local: ${env.useLocalData ? 'Activa (esperando dev-token cookie)' : 'Inactiva'}`);
      console.info('---------------------------------------------------');
      console.info(`Interfaz de usuario: ${process.env.FRONTEND_URL || 'https://localhost:5173/'}`);
      console.info(`Backend: https://localhost:${PORT}/`);
      console.info(`Logs del backend: ${console.logFile || 'Solo consola'}`);
      console.info('===================================================');
      console.info('  💡 NOTA: mkcert ya instaló la confianza en el sistema.');
      console.info('     Pero si por algún motivo tu navegador bloquea el Iframe');
      console.info('     en Canvas, haz clic en el siguiente enlace para forzar la confianza:');
      console.info(`     👉 https://localhost:${PORT}/health`);
      console.info('===================================================');
    }).on('error', (err) => {
      console.error(`[HTTPS] ERROR al escuchar en el puerto ${PORT} (TLS): ${err.message}`);
    });
  } else {
    app.listen(PORT, () => {
      const modeName = process.env.STARTUP_MODE === '1' ? 'LTI 1.3 (Canvas Real)' :
                       process.env.STARTUP_MODE === '2' ? 'API Canvas (Token Manual)' :
                       process.env.STARTUP_MODE === '3' ? 'Canvas Local (Docker)' : 'Local';

      console.info('===================================================');
      console.info('BACKEND INICIADO - Plugin Feedback Adaptativo');
      console.info('===================================================');
      console.info(`Puerto interno: ${PORT}`);
      console.info(`Modo de inicio: ${modeName}`);
      console.info(`Base de datos: ${db.isLocalMode() ? 'Datos locales (sin PostgreSQL)' : 'PostgreSQL real'}`);
      console.info(`Sesion local: ${env.useLocalData ? 'Activa (esperando dev-token cookie)' : 'Inactiva'}`);
      console.info('---------------------------------------------------');
      const scheme = isHttpsEnabled() ? 'https' : 'http';
      console.info(`Interfaz de usuario: ${process.env.FRONTEND_URL || 'https://localhost:5173/'}`);
      console.info(`Backend: ${scheme}://localhost:${PORT}/`);
      console.info(`Logs del backend: ${console.logFile || 'Solo consola'}`);
      console.info('===================================================');
    }).on('error', (err) => {
      console.error(`[HTTP] ERROR al escuchar en el puerto ${PORT}: ${err.message}`);
    });
  }
}
