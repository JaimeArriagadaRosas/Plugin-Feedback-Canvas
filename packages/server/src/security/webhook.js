import crypto from 'node:crypto';

/**
 * Verificación de firma HMAC-SHA256 de webhooks de Canvas.
 *
 * CORRECCIÓN: Canvas firma el BODY CRUDO de la petición. La implementación
 * anterior hacía JSON.stringify(req.body), lo que puede alterar orden/espacios
 * y producir verificaciones incorrectas. Aquí se exige el raw body
 * (capturado con express.json({ verify }) en middleware.js).
 *
 * Usa timingSafeEqual para evitar ataques de tiempo.
 */
export function verifyCanvasWebhook(rawBody, signature, secret) {
  if (!secret) return false;
  if (!signature) return false;
  if (!Buffer.isBuffer(rawBody)) {
    rawBody = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64'); // Canvas envia la firma en Base64

  // Evitar length probing haciendo hash de ambas firmas antes de comparar
  const hashExpected = crypto.createHash('sha256').update(expected).digest();
  const hashReceived = crypto.createHash('sha256').update(signature || '').digest();

  return crypto.timingSafeEqual(hashExpected, hashReceived);
}
