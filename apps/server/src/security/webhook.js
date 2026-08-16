import crypto from 'node:crypto';

/**
 * HMAC-SHA256 signature verification of Canvas webhooks.
 *
 * FIX: Canvas signs the RAW BODY of the request. The previous
 * implementation did JSON.stringify(req.body), which can alter order/spaces
 * and produce incorrect verifications. Here the raw body is required
 * (captured with express.json({ verify }) in middleware.js).
 *
 * Uses timingSafeEqual directly comparing the expected signature (Base64) with
 * the received signature, avoiding the intermediate double hash and length probing.
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
      .digest('base64'), // Canvas sends the signature in Base64
    'utf8'
  );

  const received = Buffer.from(signature || '', 'utf8');

  // timingSafeEqual requires buffers of equal length; if they differ in length
  // the signature is invalid by definition.
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(expected, received);
}
