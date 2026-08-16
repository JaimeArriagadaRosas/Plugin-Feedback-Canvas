import jwt from 'jsonwebtoken';
import { getLTITokenService } from './LTITokenService.js';
import { validateLtiLaunch } from '../../utils/LtiAccessValidator.js';
import { getRolesFromClaims, getEntryFromClaims } from '../../utils/roles.js';
import { AppError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import { LTI_TOKEN_COOKIE } from '../../security/ltiCookie.js';
import { validateAndConsumeNonce } from '../../security/nonceStore.js';

const ltiService = getLTITokenService();

export async function validateLtiCallback(req) {
  const bodyData = (req.body && Object.keys(req.body).length > 0) ? req.body : req.query;
  const { id_token, state, error: oidcError } = bodyData;
  
  let expectedState = null;
  let expectedNonce = null;
  const launchCookieStr = req.cookies?.[`lti_${state}`];
  
  if (launchCookieStr) {
    try {
      const launchCookie = JSON.parse(launchCookieStr);
      expectedState = state; // If the lti_state cookie (indexed) exists, the state matches.
      expectedNonce = launchCookie.nonce;
    } catch (e) { logger.warn('Failed to parse launch cookie', { error: e.message }); }
  }

  logger.info(`[LTI-CALLBACK-VALIDATOR] Validation start | idToken=${!!id_token} state=${!!state} stateCookie=${!!expectedState} nonceCookie=${!!expectedNonce} error=${!!oidcError} canDecode=${!!id_token ? !!jwtDecodeSafe(id_token) : false}`);

  if (oidcError) {
    logger.error('[LTI-CALLBACK] Canvas returned an OIDC error', { error: oidcError });
    throw new AppError(`Canvas error: ${oidcError}`, 401);
  }

  if (!id_token) {
    logger.error('[LTI-CALLBACK] id_token missing in LTI callback', {
      bodyKeys: Object.keys(bodyData),
      hasState: !!state,
      hasNonce: !!expectedNonce,
      hasError: !!oidcError,
      cookiesReceived: !!expectedState
    });
    throw new AppError('id_token missing in LTI callback', 400);
  }

  const headerPreview = jwtDecodeSafe(id_token)?.header;
  logger.info('[LTI-CALLBACK-VALIDATOR] id_token header', {
    alg: headerPreview?.alg,
    kid: headerPreview?.kid,
    typ: headerPreview?.typ
  });

  if (!expectedState || state !== expectedState) {
    logger.error('[LTI-CALLBACK] OIDC state validation failed', {
      received: state?.substring(0, 20),
      expected: expectedState?.substring(0, 20),
      hasCookie: !!expectedState
    });
    throw new AppError('OIDC state validation failed. Possible CSRF attack.', 401);
  }

  let decoded;
  try {
    logger.info('[LTI-CALLBACK-VALIDATOR] BEFORE verifyToken (queries Canvas JWKS)');
    decoded = await ltiService.verifyToken(id_token);
    logger.info(`[LTI-CALLBACK-VALIDATOR] AFTER verifyToken (OK) | iss="${decoded.iss}" sub="${decoded.sub}" aud="${decoded.aud}" azp="${decoded.azp}" deploymentId="${decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id']}"`);
  } catch (err) {
    logger.error('[LTI-CALLBACK] Error verifying id_token', { error: err.message });
    throw new AppError('Invalid or expired LTI 1.3 token', 401);
  }

  if (!(await validateAndConsumeNonce(decoded.nonce))) {
    logger.error('[LTI-CALLBACK] Nonce validation failed (store)');
    throw new AppError('OIDC nonce validation failed. Possible replay.', 401);
  }

  if (!validateLtiLaunch(decoded)) {
    logger.warn('[LTI-CALLBACK] Launch blocked by validateLtiLaunch');
    throw new AppError('Access denied: Role not authorized for LTI launch.', 403);
  }

  const customClaims = decoded['https://purl.imsglobal.org/spec/lti/claim/custom'] || {};
  
  return {
    sub: decoded.sub,
    iss: decoded.iss,
    aud: decoded.aud,
    azp: decoded.azp,
    deploymentId: decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
    roles: getRolesFromClaims(decoded),
    entry: getEntryFromClaims(decoded),
    courseId: customClaims.canvas_course_id || decoded['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
    courseName: decoded['https://purl.imsglobal.org/spec/lti/claim/context']?.title,
    studentId: customClaims.canvas_user_id || customClaims.user_id || null,
    personName: decoded['https://purl.imsglobal.org/spec/lti/claim/lis']?.person_name || 'N/A',
    personEmail: decoded['https://purl.imsglobal.org/spec/lti/claim/lis']?.person_email || 'N/A'
  };
}

export function buildLtiCookie(token) {
  
  return {
    name: LTI_TOKEN_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      partitioned: true,
      maxAge: 3600 * 1000
    }
  };
}

/**
 * Decodes the header/payload of a JWT WITHOUT verifying the signature, securely.
 * Used only for inspection/diagnostics (kid, iss) before verifyToken.
 */
function jwtDecodeSafe(token) {
  try {
    return jwt.decode(token, { complete: true });
  } catch {
    return null;
  }
}
