import { classifyCanvasLoginIncident, safeCanvasIncidentRecord, printCanvasIncident, writeCanvasIncidentReport } from './CanvasLoginIncident.js';

const MAX_CAPTURE_BYTES = 64 * 1024;

/** Inspect only failed Canvas login HTML, without logging or changing the response body. */
export function observeCanvasLoginFailure(request, upstream, logger = console, { reportDirectory } = {}) {
  const pathname = String(request?.url || '').split('?')[0];
  if (request?.method !== 'POST' || pathname !== '/login/canvas' || Number(upstream?.statusCode || 0) < 500) return false;

  const captured = [];
  let collected = 0;
  upstream.on('data', chunk => {
    if (collected >= MAX_CAPTURE_BYTES) return;
    const fragment = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const available = MAX_CAPTURE_BYTES - collected;
    const sample = fragment.subarray(0, available);
    collected += sample.length;
    captured.push(sample);
  });
  upstream.once('end', () => {
    const incident = classifyCanvasLoginIncident(Buffer.concat(captured).toString('utf8'));
    const record = safeCanvasIncidentRecord(incident, { statusCode: upstream.statusCode });
    const reportPath = writeCanvasIncidentReport(record, { directory: reportDirectory, logger });
    printCanvasIncident(incident, { logger, reportPath });
  });
  return true;
}
