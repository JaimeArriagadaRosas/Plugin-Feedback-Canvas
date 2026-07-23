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

import pc from 'picocolors';

const targets = [];

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

const IS_DEV = process.env.NODE_ENV !== 'production';

// Fallback para producción sin archivos: imprimir JSON a stdout
if (targets.length === 0 && !IS_DEV) {
  targets.push({ target: 'pino/file', options: { destination: 1 } });
}

const pinoLogger = pino(
  { level: LOG_LEVEL, redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } },
  targets.length > 0 ? pino.transport({ targets }) : undefined
);

function formatDevLog(level, rawMessage) {
  const redacted = redactSensitiveStrings(rawMessage);
  
  if (redacted.startsWith('-> GET') || redacted.startsWith('-> POST') || redacted.startsWith('-> PUT') || redacted.startsWith('-> DELETE')) {
    return `${pc.bold(pc.blue('[HTTP]'))} ${redacted}`;
  }

  const isAuthSubLog = redacted.includes('[LTI-') || 
                       redacted.includes('[SESSION-') || 
                       redacted.includes('[LtiOidcRecoveryManager]') || 
                       redacted.includes('[Auth]') ||
                       redacted.startsWith('verifyToken:') ||
                       redacted.startsWith('Audience verificada') ||
                       redacted.startsWith('INICIO DE SESION EXITOSO') ||
                       redacted.includes('VerifyToken') ||
                       redacted.includes('OIDC');

  let cleanMsg = redacted.replace(/^(\s*·\s*|\s*!!\s*|\s*×\s*)+/, '').trim();
  const match = cleanMsg.match(/^\[([^\]]+)\]\s*(.*)/);
  
  let component = '';
  let finalMessage = cleanMsg;
  if (match) {
    component = match[1];
    finalMessage = match[2];
  }

  let levelTag = '';
  if (level === 'info') levelTag = pc.cyan('[INFO]');
  else if (level === 'warn') levelTag = pc.yellow('[WARN]');
  else if (level === 'error') levelTag = pc.red('[FAIL]');
  else if (level === 'debug') levelTag = pc.gray('[DEBUG]');
  else if (level === 'fatal') levelTag = pc.bgRed(pc.white('[FATAL]'));

  if (/^[=\s-]{20,}$/.test(finalMessage.trim()) || 
      finalMessage.includes('BACKEND INICIADO') || 
      finalMessage.includes('Plugin Feedback Adaptativo') || 
      finalMessage.includes('Puerto interno:') || 
      finalMessage.includes('Modo de inicio:') || 
      finalMessage.includes('Base de datos:') || 
      finalMessage.includes('Sesion local:') || 
      finalMessage.includes('Interfaz de usuario:') || 
      finalMessage.includes('Backend:') || 
      finalMessage.includes('Logs del backend:') || 
      finalMessage.includes('💡 NOTA:') || 
      finalMessage.includes('bloquea el Iframe') || 
      finalMessage.includes('en Canvas, haz clic') || 
      finalMessage.includes('👉 https://localhost')) {
    return redacted;
  }

  if (component) {
    if (isAuthSubLog) {
      return `       ${pc.gray('↳')} ${pc.gray(`[${component}]`)} ${finalMessage}`;
    }
    const paddedComponent = `[${component}]`.padEnd(14, ' ');
    return `    ${pc.bold(paddedComponent)} ${finalMessage}`;
  }

  if (isAuthSubLog) {
    return `       ${pc.gray('↳')} ${finalMessage}`;
  }

  return `${levelTag} ${finalMessage}`;
}

function writeDevLog(level, rawMessage) {
  if (global.canvasSpinner) global.canvasSpinner.clear();
  const lines = String(rawMessage).split('\n');
  for (const line of lines) {
    const formatted = formatDevLog(level, line);
    if (process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K');
    }
    process.stdout.write(`${formatted}\n`);
  }
  if (global.canvasSpinner) global.canvasSpinner.start();
}

class Logger {
  constructor(context = {}, internalLogger = null) {
    this._context = context;
    this._pino = internalLogger || pinoLogger.child(context);
  }

  debug(message, meta = {}) { 
    if (IS_DEV && LOG_LEVEL === 'debug') writeDevLog('debug', message);
    this._pino.debug(meta, redactSensitiveStrings(message)); 
  }
  info(message, meta = {}) { 
    if (IS_DEV) writeDevLog('info', message);
    this._pino.info(meta, redactSensitiveStrings(message)); 
  }
  warn(message, meta = {}) { 
    if (IS_DEV) writeDevLog('warn', message);
    this._pino.warn(meta, redactSensitiveStrings(message)); 
  }
  error(message, meta = {}) { 
    if (IS_DEV) writeDevLog('error', message);
    this._pino.error(meta, redactSensitiveStrings(message)); 
  }
  fatal(message, meta = {}) { 
    if (IS_DEV) writeDevLog('fatal', message);
    this._pino.fatal(meta, redactSensitiveStrings(message)); 
  }

  child(extraContext = {}) {
    return new Logger({ ...this._context, ...extraContext }, this._pino.child(extraContext));
  }

  request(req) {
    const reqId = Math.random().toString(36).substring(2, 8);
    req._logId = reqId;
    req._startTime = Date.now();
    
    const isHealthCheck = req.originalUrl.includes('/config/startup-mode') || req.originalUrl.includes('/health');
    if (!isHealthCheck) {
      this.info(`-> ${req.method} ${req.originalUrl}`, {
        reqId,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']?.substring(0, 60)
      });
    }
    return reqId;
  }

  response(req, res, reqId) {
    const duration = req._startTime ? `${Date.now() - req._startTime}ms` : 'N/A';
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    const isHealthCheck = req.originalUrl.includes('/config/startup-mode') || req.originalUrl.includes('/health');
    // Solo registrar si no es health check, O si fue un error (status >= 400)
    if (!isHealthCheck || res.statusCode >= 400) {
      this._pino[level]({ reqId, duration, statusCode: res.statusCode }, `<- ${req.method} ${req.originalUrl} ${res.statusCode}`);
    }
  }

  get logFile() {
    return LOG_TO_FILE ? LOG_DIR : null;
  }
}

const logger = new Logger({ service: 'plugin-feedback-server' });

export default logger;
export { Logger };