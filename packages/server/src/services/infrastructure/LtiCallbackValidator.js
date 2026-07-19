import jwt from 'jsonwebtoken';
import { getLTITokenService } from './LTITokenService.js';
import { validateLtiLaunch } from '../../utils/LtiAccessValidator.js';
import { getRolesFromClaims, getEntryFromClaims } from '../../utils/roles.js';
import { AppError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import { LTI_TOKEN_COOKIE } from '../../security/ltiCookie.js';
import { isHttpsEnabled } from '../../security/envGuard.js';
import { validateAndConsumeNonce } from '../../security/nonceStore.js';

const ltiService = getLTITokenService();

export async function validateLtiCallback(req) {
  const bodyData = (req.body && Object.keys(req.body).length > 0) ? req.body : req.query;
  const { id_token, state, error: oidcError } = bodyData;
  const expectedState = req.cookies?.['lti_state'];
  const expectedNonce = req.cookies?.['lti_nonce'];

  logger.info(`[LTI-CALLBACK-VALIDATOR] Inicio validación | idToken=${!!id_token} state=${!!state} stateCookie=${!!expectedState} nonceCookie=${!!expectedNonce} error=${!!oidcError} canDecode=${!!id_token ? !!jwtDecodeSafe(id_token) : false}`);

  if (oidcError) {
    logger.error('[LTI-CALLBACK] Canvas devolvió error en OIDC', { error: oidcError });
    throw new AppError(`Error de Canvas: ${oidcError}`, 401);
  }

  if (!id_token) {
    logger.error('[LTI-CALLBACK] id_token ausente en el callback LTI', {
      bodyKeys: Object.keys(bodyData),
      hasState: !!state,
      hasNonce: !!expectedNonce,
      hasError: !!oidcError,
      cookiesReceived: !!expectedState
    });
    throw new AppError('id_token ausente en el callback LTI', 400);
  }

  const headerPreview = jwtDecodeSafe(id_token)?.header;
  logger.info('[LTI-CALLBACK-VALIDATOR] Header del id_token', {
    alg: headerPreview?.alg,
    kid: headerPreview?.kid,
    typ: headerPreview?.typ
  });

  if (!expectedState || state !== expectedState) {
    logger.error('[LTI-CALLBACK] Validación de state OIDC fallida', {
      received: state?.substring(0, 20),
      expected: expectedState?.substring(0, 20),
      hasCookie: !!expectedState
    });
    throw new AppError('Validación de state OIDC fallida. Posible ataque CSRF.', 401);
  }

  let decoded;
  try {
    logger.info('[LTI-CALLBACK-VALIDATOR] ANTES verifyToken (consulta JWKS de Canvas)');
    decoded = await ltiService.verifyToken(id_token);
    logger.info(`[LTI-CALLBACK-VALIDATOR] DESPUÉS verifyToken (OK) | iss="${decoded.iss}" sub="${decoded.sub}" aud="${decoded.aud}" azp="${decoded.azp}" deploymentId="${decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id']}"`);
  } catch (err) {
    logger.error('[LTI-CALLBACK] Error verificando id_token', { error: err.message });
    throw new AppError('Token LTI 1.3 inválido o expirado', 401);
  }

  if (!(await validateAndConsumeNonce(decoded.nonce))) {
    logger.error('[LTI-CALLBACK] Validación de nonce fallida (store)');
    throw new AppError('Validación de nonce OIDC fallida. Posible replay.', 401);
  }

  if (!validateLtiLaunch(decoded)) {
    logger.warn('[LTI-CALLBACK] Launch bloqueado por validateLtiLaunch');
    throw new AppError('Acceso denegado: Rol no autorizado para lanzamiento LTI.', 403);
  }

  return {
    sub: decoded.sub,
    iss: decoded.iss,
    aud: decoded.aud,
    azp: decoded.azp,
    deploymentId: decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
    roles: getRolesFromClaims(decoded),
    entry: getEntryFromClaims(decoded),
    courseId: decoded['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
    personName: decoded['https://purl.imsglobal.org/spec/lti/claim/lis']?.person_name || 'N/A',
    personEmail: decoded['https://purl.imsglobal.org/spec/lti/claim/lis']?.person_email || 'N/A'
  };
}

export function buildLtiCookie(token) {
  const isProduction = isHttpsEnabled();
  return {
    name: LTI_TOKEN_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax',
      maxAge: 3600 * 1000
    }
  };
}

/**
 * Decodifica el header/payload de un JWT SIN verificar firma, de forma segura.
 * Se usa solo para inspección/diagnóstico (kid, iss) antes de verifyToken.
 */
function jwtDecodeSafe(token) {
  try {
    return jwt.decode(token, { complete: true });
  } catch {
    return null;
  }
}
