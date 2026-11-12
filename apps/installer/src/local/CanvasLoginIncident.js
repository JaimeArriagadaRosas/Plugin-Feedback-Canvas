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
      summary: 'Canvas returned an internal error during login.',
      possibleCauses: ['Es necesario revisar los registros de Rails.'],
      recovery: 'No database modifications or automatic credential retries will occur.',
      action: 'Preserve Rails logs and configuration before retrying.'
    };
  }
  return {
    code: FK_CODE, severity: 'error',
    summary: 'Canvas could not save terms of service: the referenced account does not exist.',
    possibleCauses: [
      'Referencia de cuenta o shard incorrecta.',
      'Connection to a different database than expected.',
      'Persisted data or incomplete initialization.'
    ],
    recovery: 'Blocked: modifying Canvas accounts or foreign keys is unsafe.',
    action: 'Verify account, shard and actual database. Do not delete volumes.'
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
    logger.warn('[CANVAS-LOGIN] Could not save the report; the Canvas response was left intact.');
    return null;
  }
}

export function printCanvasIncident(incident, { logger = console, reportPath = null } = {}) {
  logger.warn('[' + incident.code + '] ' + incident.summary);
  logger.warn('[' + incident.code + '] Possible causes: ' + incident.possibleCauses.join(' / '));
  logger.warn('[' + incident.code + '] Recovery: ' + incident.recovery);
  logger.warn('[' + incident.code + '] Action: ' + incident.action);
  if (reportPath) logger.warn('[' + incident.code + '] Report without credentials: ' + reportPath);
}
