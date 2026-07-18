import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';

/**
 * Helper de caja negra para simular un id_token LTI 1.3 emitido por Canvas.
 *
 * Genera un par RSA en memoria con un `kid` fijo y expone tanto la clave
 * pública (como si fuera el JWKS de Canvas) como la función para firmar tokens.
 *
 * Esto permite testear el flujo completo del botón Feedback (course_navigation)
 * sin depender de Docker/Canvas ni de red externa, y aislar la causa raíz del
 * ERR_EMPTY_RESPONSE ("localhost no ha enviado ningún dato").
 */

const KID = 'test-kid-unida';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicExponent: 0x10001
});

// JWKS que "expondría" este emisor de prueba (equivalente a /api/lti/security/jwks).
export function jwksForTestKid() {
  const pubJwk = publicKey.export({ format: 'jwk' });
  return {
    keys: [
      {
        kty: pubJwk.kty,
        e: pubJwk.e,
        n: pubJwk.n,
        alg: 'RS256',
        use: 'sig',
        kid: KID
      }
    ]
  };
}

/**
 * Firma un id_token LTI 1.3 con la clave de prueba.
 * @param {object} claims - Claims LTI (iss, sub, aud, roles, context, etc.)
 * @param {object} [opts] - override de kid/alg/key para simular casos erróneos.
 */
export function signLtiIdToken(claims, opts = {}) {
  const kid = opts.kid ?? KID;
  const key = opts.key ?? privateKey;
  const header = { alg: opts.alg ?? 'RS256', kid, typ: 'JWT' };
  return jwt.sign(claims, key, { algorithm: 'RS256', keyid: kid, header });
}

export const TEST_KID = KID;
