/**
 * Logger estructurado para el backend del Plugin Feedback.
 * Soporta niveles: DEBUG, INFO, WARN, ERROR, FATAL.
 * Escribe a consola (coloreado) y opcionalmente a archivo.
 *
 * Uso:
 *   import logger from '../utils/logger.js';
 *   logger.info('Servidor iniciado');
 *   logger.error('Error crítico', error);
 *   const reqLogger = logger.child({ reqId: 'abc123', path: '/api/courses' });
 *   reqLogger.info('Procesando petición');
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────
const LOG_LEVEL = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
const LOG_TO_FILE = process.env.LOG_TO_FILE !== 'false';
const LOG_DIR = path.resolve(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, `backend-${new Date().toISOString().split('T')[0]}.log`);

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.INFO;

// Colores ANSI para consola
const COLORS = {
  DEBUG: '\x1b[36m',  // Cyan
  INFO:  '\x1b[32m',  // Verde
  WARN:  '\x1b[33m',  // Amarillo
  ERROR: '\x1b[31m',  // Rojo
  FATAL: '\x1b[35m',  // Magenta
  RESET: '\x1b[0m',
  GRAY:  '\x1b[90m',
  BOLD:  '\x1b[1m'
};

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN DEL DIRECTORIO DE LOGS
// ─────────────────────────────────────────────────────────────────────────────
function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn('[Logger] No se pudo crear directorio de logs:', e.message);
  }
}

let logStream = null;
if (LOG_TO_FILE) {
  ensureLogDir();
  try {
    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a', encoding: 'utf8' });
    logStream.on('error', (err) => {
      console.error('[Logger] Error escribiendo al archivo de log:', err.message);
      logStream = null;
    });
  } catch (e) {
    console.warn('[Logger] No se pudo abrir archivo de log:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATEADOR DE MENSAJES
// ─────────────────────────────────────────────────────────────────────────────
function formatMessage(level, message, meta = {}, context = {}) {
  const ts = new Date().toISOString();
  const contextStr = Object.keys(context).length
    ? Object.entries(context).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';

  // Formato para archivo (JSON estructurado)
  const fileEntry = JSON.stringify({
    ts,
    level,
    message,
    ...context,
    ...meta
  });

  // Formato para consola (legible con colores)
  const color = COLORS[level] || COLORS.RESET;
  const metaStr = Object.keys(meta).length
    ? ' ' + COLORS.GRAY + JSON.stringify(meta) + COLORS.RESET
    : '';
  const ctxStr = contextStr ? ` ${COLORS.GRAY}[${contextStr}]${COLORS.RESET}` : '';
  const consoleEntry = `${COLORS.GRAY}${ts}${COLORS.RESET} ${color}${COLORS.BOLD}${level.padEnd(5)}${COLORS.RESET}${ctxStr} ${message}${metaStr}`;

  return { consoleEntry, fileEntry };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN DE ESCRITURA
// ─────────────────────────────────────────────────────────────────────────────
function writeLog(level, message, meta = {}, context = {}) {
  if ((LEVELS[level] ?? 99) < currentLevel) return;

  const { consoleEntry, fileEntry } = formatMessage(level, message, meta, context);

  if (level === 'ERROR' || level === 'FATAL') {
    console.error(consoleEntry);
  } else if (level === 'WARN') {
    console.warn(consoleEntry);
  } else {
    console.log(consoleEntry);
  }

  if (logStream) {
    logStream.write(fileEntry + '\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFAZ PÚBLICA DEL LOGGER
// ─────────────────────────────────────────────────────────────────────────────
class Logger {
  constructor(context = {}) {
    this._context = context;
  }

  debug(message, meta = {})  { writeLog('DEBUG', message, meta, this._context); }
  info(message, meta = {})   { writeLog('INFO',  message, meta, this._context); }
  warn(message, meta = {})   { writeLog('WARN',  message, meta, this._context); }
  error(message, meta = {})  { writeLog('ERROR', message, meta, this._context); }
  fatal(message, meta = {})  { writeLog('FATAL', message, meta, this._context); }

  /**
   * Crea un logger hijo con contexto adicional (útil para peticiones HTTP).
   * @param {Object} extraContext - Contexto adicional (ej: { reqId, path, method })
   */
  child(extraContext = {}) {
    return new Logger({ ...this._context, ...extraContext });
  }

  /**
   * Loguea el inicio de una petición HTTP.
   */
  request(req) {
    const reqId = Math.random().toString(36).substring(2, 8);
    req._logId = reqId;
    req._startTime = Date.now();
    this.info(`→ ${req.method} ${req.originalUrl}`, {
      reqId,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent']?.substring(0, 60)
    });
    return reqId;
  }

  /**
   * Loguea el fin de una petición HTTP.
   */
  response(req, res, reqId) {
    const duration = req._startTime ? `${Date.now() - req._startTime}ms` : 'N/A';
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    writeLog(level, `← ${req.method} ${req.originalUrl} ${res.statusCode}`, { reqId, duration }, this._context);
  }

  get logFile() {
    return LOG_TO_FILE ? LOG_FILE : null;
  }
}

const logger = new Logger({ service: 'plugin-feedback-backend' });

export default logger;
export { Logger };
