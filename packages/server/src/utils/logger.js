/**
 * Logger estructurado para el servidor del Plugin Feedback.
 * Basado en Pino, el logger más rápido de Node.js, para alto rendimiento y JSON logs.
 */

import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REDACT_PATHS, redactSensitiveStrings } from '../security/redact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const LOG_TO_FILE = process.env.LOG_TO_FILE !== 'false';
// __dirname is now Plugin Feedback/packages/server/src/utils
// We want to point to Plugin Feedback/logs
const LOG_DIR = path.resolve(__dirname, '../../../../logs');

if (LOG_TO_FILE && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const targets = [
  {
    target: 'pino-pretty',
    level: LOG_LEVEL,
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname,service',
      messageFormat: '{msg}'
    }
  }
];

if (LOG_TO_FILE) {
  targets.push({
    target: 'pino-roll',
    level: LOG_LEVEL,
    options: {
      file: path.join(LOG_DIR, 'server'),
      frequency: 'daily',
      extension: '.log',
      mkdir: true,
      sync: false
    }
  });
}

const pinoLogger = pino(
  { level: LOG_LEVEL, redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } },
  pino.transport({ targets })
);

class Logger {
  constructor(context = {}, internalLogger = null) {
    this._context = context;
    this._pino = internalLogger || pinoLogger.child(context);
  }

  debug(message, meta = {}) { this._pino.debug(meta, redactSensitiveStrings(message)); }
  info(message, meta = {}) { this._pino.info(meta, redactSensitiveStrings(message)); }
  warn(message, meta = {}) { this._pino.warn(meta, redactSensitiveStrings(message)); }
  error(message, meta = {}) { this._pino.error(meta, redactSensitiveStrings(message)); }
  fatal(message, meta = {}) { this._pino.fatal(meta, redactSensitiveStrings(message)); }

  child(extraContext = {}) {
    return new Logger({ ...this._context, ...extraContext }, this._pino.child(extraContext));
  }

  request(req) {
    const reqId = Math.random().toString(36).substring(2, 8);
    req._logId = reqId;
    req._startTime = Date.now();
    this.info(`-> ${req.method} ${req.originalUrl}`, {
      reqId,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent']?.substring(0, 60)
    });
    return reqId;
  }

  response(req, res, reqId) {
    const duration = req._startTime ? `${Date.now() - req._startTime}ms` : 'N/A';
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    this._pino[level]({ reqId, duration, statusCode: res.statusCode }, `<- ${req.method} ${req.originalUrl} ${res.statusCode}`);
  }

  get logFile() {
    return LOG_TO_FILE ? LOG_DIR : null;
  }
}

const logger = new Logger({ service: 'plugin-feedback-server' });

export default logger;
export { Logger };