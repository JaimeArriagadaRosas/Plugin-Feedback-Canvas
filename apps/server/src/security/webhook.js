import crypto from 'node:crypto';

/**
 * Verificación de firma HMAC-SHA256 de webhooks de Canvas.
 *
 * CORRECCIÓN: Canvas firma el BODY CRUDO de la petición. La implementación
 * anterior hacía JSON.stringify(req.body), lo que puede alterar orden/espacios
 * y producir verificaciones incorrectas. Aquí se exige el raw body
 * (capturado con express.json({ verify }) en middleware.js).
 *
 * Usa timingSafeEqual comparando directamente la firma esperada (Base64) con
 * la firma recibida, evitando el doble hash intermedio y el length probing.
 */
export function verifyCanvasWebhook(rawBody, signature, secret) {
  if (!secret) return false;
  if (!signature) return false;
  if (!Buffer.isBuffer(rawBody)) {
    rawBody = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
  }

  const expected = Buffer.from(
    crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64'), // Canvas envia la firma en Base64
    'utf8'
  );

  const received = Buffer.from(signature || '', 'utf8');

  // timingSafeEqual exige buffers de igual longitud; si difieren en longitud
  // la firma es inválida por definición.
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(expected, received);
}
