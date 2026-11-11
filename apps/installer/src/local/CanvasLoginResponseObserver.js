import { analyzeLogString } from '../installation/utils/Diagnostics.js';

const MAX_CAPTURE_BYTES = 64 * 1024;

/** Inspect only failed Canvas login HTML, without logging or changing the response body. */
export function observeCanvasLoginFailure(request, upstream, logger = console) {
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
    const normalized = Buffer.concat(captured).toString('utf8').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const result = analyzeLogString(normalized);
    if (result.type !== 'CANVAS_TERMS_FOREIGN_KEY') return;
    logger.warn('[CANVAS-LOGIN] Canvas rechazó una referencia de cuenta al guardar términos de servicio.');
    logger.warn('[CANVAS-LOGIN] Es un error de Canvas/PostgreSQL, no una prueba de que Plugin Feedback haya fallado.');
    logger.warn('[CANVAS-LOGIN] Conserve los datos. Reiniciar la opción 3 permite verificar el entorno, pero no garantiza reparar la causa. No elimine volúmenes automáticamente.');
  });
  return true;
}
