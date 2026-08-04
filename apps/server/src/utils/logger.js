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
  
  if (redacted === '' ||
      /^[=\s-]{20,}$/.test(redacted.trim()) || 
      redacted.includes('BACKEND INICIADO') || 
      redacted.includes('Plugin Feedback Adaptativo') || 
      redacted.includes('Puerto interno') || 
      redacted.includes('Modo de inicio') || 
      redacted.includes('• Base de datos') || 
      redacted.includes('Sesión local') || 
      redacted.includes('Interfaz UI') || 
      redacted.includes('API Backend') || 
      redacted.includes('Logs') || 
      redacted.includes('💡 NOTA:') || 
      redacted.includes('bloquea el Iframe') || 
      redacted.includes('en Canvas, haz clic') || 
      redacted.includes('👉 https://localhost')) {
    return redacted;
  }

  // eslint-disable-next-line security/detect-unsafe-regex
  let cleanMsg = redacted.replace(/^(\s*·\s*|\s*!!\s*|\s*×\s*|\s*√\s*|\s*↳\s*)+/, '').trim();
  const match = cleanMsg.match(/^\[([^\]]+)\]\s*(.*)/);
  
  let component = '';
  let finalMessage = cleanMsg;
  if (match) {
    component = match[1];
    finalMessage = match[2];
  }

  const isHttpRequest = finalMessage.startsWith('-> GET') || finalMessage.startsWith('-> POST') || finalMessage.startsWith('-> PUT') || finalMessage.startsWith('-> DELETE');
  const isHttpResponse = finalMessage.startsWith('<- GET') || finalMessage.startsWith('<- POST') || finalMessage.startsWith('<- PUT') || finalMessage.startsWith('<- DELETE');

  // Ignorar endpoints ruidosos (polling del frontend) para mantener la consola limpia
  const isNoisyEndpoint = finalMessage.includes('/system-notifications/pending') || 
                          finalMessage.includes('/feedback/pending/summary') || 
                          finalMessage.includes('/feedback/list');

  if (isNoisyEndpoint) {
    return null;
  }

  if (isHttpRequest) {
    const methodPath = finalMessage.replace('-> ', '').trim();
    const [method, ...rest] = methodPath.split(' ');
    return `\n  ${pc.cyan('·')} Petición ${pc.bold(method)}: ${rest.join(' ')}`;
  }

  if (isHttpResponse) {
    const parts = finalMessage.split(' ');
    const status = parts[parts.length - 1];
    if (status.startsWith('2') || status.startsWith('3')) {
      return `    ${pc.green('√')} Petición completada (${status})`;
    } else {
      return `    ${pc.red('×')} Petición finalizada con error (${status})`;
    }
  }

  const isAuthSubLog = redacted.includes('[LTI-') || 
                       redacted.includes('[SESSION-') || 
                       redacted.includes('[LtiOidcRecoveryManager]') || 
                       redacted.includes('[Auth]') ||
                       redacted.includes('verifyToken') ||
                       redacted.includes('VerifyToken') ||
                       redacted.includes('Audience verificada') ||
                       redacted.includes('INICIO DE SESION') ||
                       redacted.includes('OIDC') ||
                       redacted.includes('Sesión válida') ||
                       redacted.includes('Rol efectivo') ||
                       redacted.includes('Estado activo') ||
                       redacted.includes('Claves RSA') ||
                       redacted.includes('SESSION:') ||
                       redacted.includes('CanvasOAuth') ||
                       redacted.includes('OAuth');
                       
  const isSubLog = isAuthSubLog || 
                   ['CORS', 'AUTH', 'AUTHZ', 'CONTROLLER', 'AUDIT-DB', 'SUBMISSION', 'HTTP', 'LTI-AUTH', 'LTI-CALLBACK', 'LTI-TOKEN', 'SESSION', 'OAUTH2'].includes(component) ||
                   (component && component.startsWith('LTI'));

  let icon = pc.cyan('·');
  if (level === 'warn') icon = pc.yellow('!');
  if (level === 'error' || level === 'fatal') icon = pc.red('×');
  
  const lowerMsg = finalMessage.toLowerCase();
  if (level === 'info' && (
      lowerMsg.includes('exitosa') || 
      lowerMsg.includes('exitosamente') || 
      lowerMsg.includes('completad') || 
      lowerMsg.includes('permitido') || 
      lowerMsg.includes('activo') || 
      lowerMsg.includes('listo') || 
      lowerMsg.includes('válid') || 
      lowerMsg.includes('registrado') || 
      lowerMsg.includes('ok') || 
      lowerMsg.includes('generado') ||
      lowerMsg.includes('éxito')
  )) {
    icon = pc.green('√');
  }

  let text = finalMessage;
  
  if (component === 'CORS' && text.includes('Solicitud con Origin:')) {
    text = text.replace('Solicitud con Origin:', 'Origin validado:');
  }

  if (component && !isSubLog) {
     if (!['SERVER', 'BOOTSTRAP', 'TLS', 'SSL', 'HTTPS', 'FRONTEND', 'DATA', 'JOBS', 'DB', 'CANVAS-API', 'JWKS-CLIENT', 'KeyManager', 'TLS-PROXY'].includes(component)) {
       text = `${component}: ${text}`;
     } else if (component === 'DB' && !text.toLowerCase().includes('postgresql') && !text.toLowerCase().includes('base de datos')) {
       text = `Base de datos: ${text}`;
     }
  }

  if (isSubLog) {
    return `    ${icon} ${text}`;
  }

  return `  ${icon} ${text}`;
}

function writeDevLog(level, rawMessage) {
  if (global.canvasSpinner) global.canvasSpinner.clear();
  const lines = String(rawMessage).split('\n');
  for (const line of lines) {
    const formatted = formatDevLog(level, line);
    if (formatted !== null) {
      if (process.stdout.isTTY) {
        process.stdout.write('\r\x1b[K');
      }
      process.stdout.write(`${formatted}\n`);
    }
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
    if (IS_DEV) writeDevLog('warn', meta.error ? `${message} ${meta.error}` : message);
    this._pino.warn(meta, redactSensitiveStrings(message)); 
  }
  error(message, meta = {}) { 
    if (IS_DEV) writeDevLog('error', meta.error ? `${message} ${meta.error}` : message);
    this._pino.error(meta, redactSensitiveStrings(message)); 
  }
  fatal(message, meta = {}) { 
    if (IS_DEV) writeDevLog('fatal', meta.error ? `${message} ${meta.error}` : message);
    this._pino.fatal(meta, redactSensitiveStrings(message)); 
  }

  child(extraContext = {}) {
    return new Logger({ ...this._context, ...extraContext }, this._pino.child(extraContext));
  }

  progress(message, meta = {}) {
    if (IS_DEV) {
      if (process.stdout.isTTY) {
        if (global.canvasSpinner) global.canvasSpinner.clear();
        const formatted = formatDevLog('info', message);
        process.stdout.write(`\r\x1b[K${formatted}`);
      }
      // If it's not a TTY, we suppress progress logs to avoid spamming buffered outputs (like child_process)
    }
    // Escribimos en debug file, sin saturar log_level info si no es necesario.
    this._pino.debug(meta, redactSensitiveStrings(message));
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
      // eslint-disable-next-line security/detect-object-injection
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