import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'node:path';

import { ErrorHandler } from '../../middlewares/ErrorHandler.js';
import { globalLimiter } from '../../middlewares/security.js';
import { helmetMiddleware } from '../../security/headers.js';
import { corsMiddleware } from '../../security/cors.js';
import { getEnv } from '../../config/index.js';

dotenv.config();

export function createApp() {
  const app = express();
  const PORT = getEnv('PORT', 3000);

  // Trust proxy: necesario para rate limiting por IP real y secure cookies
  // cuando se está detrás de un reverse proxy / load balancer (nginx, ALB...).
  const trustProxy = getEnv('TRUST_PROXY');
  if (trustProxy) {
    app.set('trust proxy', trustProxy === 'true' ? 1 : trustProxy);
  }

  app.use((req, res, next) => {
    console.debug(`-> ${req.method} ${req.originalUrl}`);
    res.on('finish', () => {
      console.debug(`<- ${req.method} ${req.originalUrl} ${res.statusCode}`);
    });
    next();
  });

  app.use(corsMiddleware());

  app.disable('x-powered-by');
  app.use(helmetMiddleware());

  // Captura el raw body para verificar la firma HMAC de los webhooks de Canvas.
  // Límite de 10kb (defensa por capas, OWASP A04): el plugin sólo envía
  // metadatos y comentarios cortos; payloads mayores las rechazamos con 413.
  app.use(express.json({
    limit: '10kb',
    verify: (req, res, buf) => { req.rawBody = buf; }
  }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/api/lti', express.urlencoded({ extended: true, limit: '1mb', type: '*/*' }));
  app.use(cookieParser());
  app.use(globalLimiter);

  return { app, PORT };
}
