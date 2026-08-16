import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ErrorHandler } from '../../middlewares/ErrorHandler.js';
import { SECRET_REGISTRY, validateSecretsOrThrow } from '../../config/secrets.js';
import { runMigrations } from '@plugin-feedback/plugin-database';
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
      logger.info('[BOOTSTRAP] Executing database migrations (AUTO_MIGRATE=true)...');
      await runMigrations();
      logger.info('[BOOTSTRAP] Migrations completed.');
    } else {
      logger.info('[BOOTSTRAP] Auto-migration disabled. Run "npm run db:migrate" manually in deployment.');
    }
  } catch (err) {
    logger.error('[BOOTSTRAP] Critical failure in migrations:', err.message);
    process.exit(1);
  }
}

function configureStaticRouting(app, frontendDist) {
  logger.info(`[FRONTEND] Static server: Serving SPA from /dist folder.`);
  app.use(express.static(frontendDist, { index: false }));

  app.use((req, res, next) => {
    const isApiLike = req.path.startsWith('/api') || req.path.startsWith('/lti') || req.path.startsWith('/health');
    if (isApiLike || req.method !== 'GET') {
      return res.status(404).json({
        exito: false,
        error: { mensaje: 'Not found', codigo: 404, path: req.originalUrl }
      });
    }

    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('Frontend not built. If you are in development, access via the Vite port (5173).');
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
  app.set('iaConfigManager', services.iaConfigManager);

  const frontendDist = resolveFrontendDist(__dirname);
  configureStaticRouting(app, frontendDist);

  app.use(ErrorHandler);

  const server = await createServerInstance(app);

  return new Promise((resolve, reject) => {
    server.listen(PORT, () => {
      const modeName = process.env.STARTUP_MODE === '1' ? 'LTI 1.3 (Real Canvas)' :
                       process.env.STARTUP_MODE === '2' ? 'Canvas API (Manual Token)' :
                       process.env.STARTUP_MODE === '3' ? 'Local Canvas (Docker)' : 'Local';

      server.setTimeout(300000);
      server.headersTimeout = 120000;
      server.keepAliveTimeout = 60000;
      if (services.tokenRotationJob) {
        server.tokenRotationJob = services.tokenRotationJob;
        services.tokenRotationJob.start();
      }
      logger.info('[SERVER] Configured timeouts: timeout=300s, headers=120s, keepAlive=60s');

      logger.info('');
      logger.info('===================================================');
      logger.info(' 🚀 BACKEND STARTED - Adaptive Feedback Plugin');
      logger.info('===================================================');
      logger.info(`  • Internal port : ${PORT}`);
      logger.info(`  • Startup mode  : ${modeName}`);
      logger.info(`  • Database      : Real PostgreSQL`);
      logger.info(`  • Local session : ${env.useLocalData ? 'Active (waiting for dev-token cookie)' : 'Inactive'}`);
      logger.info('---------------------------------------------------');
      const scheme = isHttpsEnabled() ? 'https' : 'http';
      logger.info(`  🌐 UI Interface : ${process.env.FRONTEND_URL || 'https://localhost:5173/'}`);
      logger.info(`  ⚙️  Backend API : ${scheme}://localhost:${PORT}/`);
      logger.info(`  📄 Logs         : ${console.logFile || 'Console only'}`);
      logger.info('===================================================');
      if (scheme === 'https') {
        logger.info('  💡 NOTE: If your browser blocks the Canvas Iframe, visit:');
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
      logger.error(`[SERVER] ERROR listening on port ${PORT}: ${err.message}`);
      // Notificar vía IPC al orquestador que ocurrió un error
      if (process.send) {
        process.send({ type: 'server-error', message: err.message });
      }
      reject(err);
    });
  });
}
