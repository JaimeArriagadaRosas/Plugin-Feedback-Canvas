import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { analyzeLogString } from '../installation/utils/Diagnostics.js';

const FK_CODE = 'CANVAS-DB-003';
const GENERIC_CODE = 'CANVAS-LOGIN-500';

/** Only predefined text: no request body, account IDs, cookies or tokens. */
export function classifyCanvasLoginIncident(responseHtml) {
  const normalized = String(responseHtml || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const signature = analyzeLogString(normalized);
  if (signature.type !== 'CANVAS_TERMS_FOREIGN_KEY') {
    return {
      code: GENERIC_CODE, severity: 'error',
      summary: 'Canvas devolvió un error interno durante el inicio de sesión.',
      possibleCauses: ['Es necesario revisar los registros de Rails.'],
      recovery: 'No se modificará la base de datos ni se repetirán credenciales automáticamente.',
      action: 'Conserve los registros de Rails y la configuración antes de reintentar.'
    };
  }
  return {
    code: FK_CODE, severity: 'error',
    summary: 'Canvas no pudo guardar términos de servicio: referencia de cuenta inexistente.',
    possibleCauses: [
      'Referencia de cuenta o shard incorrecta.',
      'Conexión a una base de datos diferente de la esperada.',
      'Datos persistentes o inicialización incompleta.'
    ],
    recovery: 'Bloqueada: alterar cuentas o claves foráneas de Canvas no es seguro.',
    action: 'Verifique cuenta, shard y base de datos efectiva. No elimine volúmenes.'
  };
}

export function safeCanvasIncidentRecord(incident, { timestamp = new Date().toISOString(), statusCode = 500 } = {}) {
  return {
    timestamp, code: incident.code, severity: incident.severity,
    component: 'Canvas LMS', endpoint: 'POST /login/canvas',
    httpStatus: statusCode, summary: incident.summary,
    possibleCauses: incident.possibleCauses, recovery: incident.recovery,
    action: incident.action, confirmedRootCause: false
  };
}

/** Report writing is best-effort; no impact on the upstream response. */
export function writeCanvasIncidentReport(record, { directory, logger = console } = {}) {
  if (!directory) return null;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const destination = path.join(directory, record.code + '-' + randomUUID() + '.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(destination, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return destination;
  } catch {
    logger.warn('[CANVAS-LOGIN] No fue posible guardar el informe; la respuesta de Canvas permanece intacta.');
    return null;
  }
}

export function printCanvasIncident(incident, { logger = console, reportPath = null } = {}) {
  logger.warn('[' + incident.code + '] ' + incident.summary);
  logger.warn('[' + incident.code + '] Hipótesis: ' + incident.possibleCauses.join(' / '));
  logger.warn('[' + incident.code + '] Recuperación: ' + incident.recovery);
  logger.warn('[' + incident.code + '] Acción: ' + incident.action);
  if (reportPath) logger.warn('[' + incident.code + '] Informe sin credenciales: ' + reportPath);
}
