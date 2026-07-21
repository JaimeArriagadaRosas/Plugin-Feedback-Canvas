import { getLTITokenService } from '../../services/infrastructure/LTITokenService.js';
import { extractLtiToken, isDevToken } from '../ltiCookie.js';
import { getRolesFromClaims, getEntryFromClaims } from '../../utils/roles.js';
import { AppError } from '../../utils/errors.js';

const ltiService = getLTITokenService();

export class LtiIdentityProvider {
  name = 'lti';

  async authenticate(req) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const cookieToken = req.cookies?.['lti-token'] || null;

    // Probar primero el cookie, ya que es la forma segura y oficial de LTI 1.3
    const tokensToTry = [cookieToken, bearerToken].filter(t => t && !isDevToken(t));

    for (const token of tokensToTry) {
      try {
        const decoded = await ltiService.verifyToken(token);
        const deploymentId = decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
        const allowedDeploymentIds = (process.env.LTI_DEPLOYMENT_IDS || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        if (allowedDeploymentIds.length > 0 && !allowedDeploymentIds.includes(deploymentId)) {
          throw new AppError('Deployment ID no permitido', 403);
        }

        const ltiRoles = getRolesFromClaims(decoded);
        return {
          user: decoded.sub,
          role: ltiRoles,
          courseId: decoded['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
          deploymentId,
          isLocalSession: false,
          entry: getEntryFromClaims(decoded)
        };
      } catch (e) {
        if (e instanceof AppError && [401, 403].includes(e.statusCode)) {
          throw e;
        }
      }
    }
    return null;
  }
}
