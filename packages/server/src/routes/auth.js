import express from 'express';
import { verifySessionToken, signSessionToken, getSessionPublicKeyPem } from '../services/infrastructure/SessionTokenService.js';
import { getLTITokenService } from '../services/infrastructure/LTITokenService.js';
import { getRolesFromClaims, getEntryFromClaims } from '../utils/roles.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { asyncSafe } from '../routes/lti/index.js';

const router = express.Router();

router.post('/session', asyncSafe(async (req, res) => {
  const { id_token } = req.body || {};
  if (!id_token) {
    throw new AppError('id_token requerido', 400);
  }

  const ltiService = getLTITokenService();
  const decoded = await ltiService.verifyToken(id_token);

  const claims = {
    sub: decoded.sub,
    azp: decoded.azp,
    deploymentId: decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
    context: decoded['https://purl.imsglobal.org/spec/lti/claim/context'],
    lis: decoded['https://purl.imsglobal.org/spec/lti/claim/lis'],
    roles: getRolesFromClaims(decoded),
    entry: getEntryFromClaims(decoded),
  };

  const sessionToken = signSessionToken(claims);
  const sessionTokenExpiryMs = parseInt(process.env.SESSION_TOKEN_EXPIRY_MS || '28800000', 10);
  const exp = Math.floor(Date.now() / 1000) + Math.floor(sessionTokenExpiryMs / 1000);

  logger.info('[SESSION-TOKEN] Token de sesión emitido', { sub: claims.sub, exp });

  res.json({
    exito: true,
    session_token: sessionToken,
    exp,
  });
}));

router.get('/session-public-key', (req, res) => {
  const publicKeyPem = getSessionPublicKeyPem();
  res.set('Content-Type', 'text/plain');
  res.send(publicKeyPem);
});

export default router;
