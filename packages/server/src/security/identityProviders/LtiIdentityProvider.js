import { getLTITokenService } from '../../services/infrastructure/LTITokenService.js';
import { extractLtiToken } from '../ltiCookie.js';
import { isDevToken } from '../ltiCookie_local.js';
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
        // En lugar de lanzar 401 y abortar la autenticación (Error Shadowing), 
        // silenciamos el error para probar el siguiente Identity Provider.
        // Si el error es 403 (Deployment ID bloqueado), sí debemos abortar.
        if (e instanceof AppError && e.statusCode === 403) {
          throw e;
        }
      }
    }
    return null;
  }
}
