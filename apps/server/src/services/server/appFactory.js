import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ErrorHandler } from '../../middlewares/ErrorHandler.js';
import { SECRET_REGISTRY, validateSecretsOrThrow } from '../../config/secrets.js';
import { runMigrations } from '../../../../../scripts/setup/migrate.mjs';
import { registerRoutes } from './routes.js';
import { isHttpsEnabled } from '../../security/envGuard.js';
import logger from '../../utils/logger.js';

import { resolveEnv, resolveFrontendDist, logSecretsSummary } from './envConfig.js';
import { generateLtiKeys, createServerInstance } from './tlsSetup.js';
import { initializeDataLayer, initializeServiceLayer } from './dependencyInjection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function executeMigrations() {
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
}

function configureStaticRouting(app, frontendDist) {
  logger.info(`[FRONTEND] Servidor estático: Sirviendo SPA desde carpeta /dist.`);
  app.use(express.static(frontendDist, { index: false }));

  app.use((req, res, next) => {
    const isApiLike = req.path.startsWith('/api') || req.path.startsWith('/lti') || req.path.startsWith('/health');
    if (isApiLike || req.method !== 'GET') {
      return res.status(404).json({
        exito: false,
        error: { mensaje: 'No encontrado', codigo: 404, path: req.originalUrl }
      });
    }

    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('Frontend no construido. Si estas en desarrollo, accede a través del puerto de Vite (5173).');
      }
    });
  });
}

export async function startServer(app, PORT) {
  await executeMigrations();

  const env = resolveEnv();
  validateSecretsOrThrow(SECRET_REGISTRY);
  logSecretsSummary();

  const ltiPublicJwk = await generateLtiKeys();
  process.env.LTI_PUBLIC_JWK = JSON.stringify(ltiPublicJwk);

  const repos = initializeDataLayer();
  const services = await initializeServiceLayer(env, repos);

  registerRoutes(app, services, ltiPublicJwk);
  app.set('permissionsManager', services.permissionsService);

  const frontendDist = resolveFrontendDist(__dirname);
  configureStaticRouting(app, frontendDist);

  app.use(ErrorHandler);

  const server = await createServerInstance(app);

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
      if (scheme === 'https') {
        logger.info('  💡 NOTA: Si tu navegador bloquea el Iframe en Canvas, visita:');
        logger.info(`     👉 https://localhost:${PORT}/health`);
        logger.info('===================================================');
      }
      logger.info('');

      // Notificar vía IPC al orquestador que el servidor está listo.
      if (process.send) {
        process.send({ type: 'server-ready' });
      }

      resolve(server);
    }).on('error', (err) => {
      logger.error(`[SERVER] ERROR al escuchar en el puerto ${PORT}: ${err.message}`);
      // Notificar vía IPC al orquestador que ocurrió un error
      if (process.send) {
        process.send({ type: 'server-error', message: err.message });
      }
      reject(err);
    });
  });
}
