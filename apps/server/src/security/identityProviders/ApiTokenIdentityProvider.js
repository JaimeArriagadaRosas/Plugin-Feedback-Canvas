import { toRoleURN, classifyRoles } from '../../utils/roles.js';
import CanvasClient from '../../services/infrastructure/CanvasClient.js';
import { AppIdentity } from '../../domain/identity/AppIdentity.js';

export class ApiTokenIdentityProvider {
  name = 'api-token';

  async authenticate(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    if (!token || token.startsWith('dev-token')) return null;

    try {
      let user = null;
      if (process.env.USE_LOCAL_DATA === 'true') {
         // Local mock: Admin role is NOT granted by default. The real role
         // is derived from the Canvas claim (USAR_LOCAL_ROL) or 'teacher' is assumed with
         // minimum privilege. Previously any non-dev Bearer token in local mode
         // granted admin role without validation (privilege escalation).
         const localRole = process.env.USE_LOCAL_API_ROLE || 'teacher';
         user = { id: 'local-user', roles: [localRole] };
      } else {
         const client = new CanvasClient();
         try {
           user = await client.apiFetch('/users/self', token);
         } catch (e) {
           user = null;
         }
      }

      if (!user) return null;

      const rawRoles = Array.isArray(user.roles) ? user.roles : [];
      const classification = classifyRoles(rawRoles);
      let role = 'teacher';
      if (classification.isAccountAdmin) role = 'admin';
      else if (classification.isInstructor || classification.isTA || classification.isDesigner) role = 'teacher';
      else if (classification.isLearner) role = 'student';
      const ltiRoles = [toRoleURN(role)];

      const userId = user.id || user.canvas_user_id;
      return new AppIdentity({
        ltiUserId: userId,
        numericUserId: userId,
        roles: ltiRoles,
        courseId: user.course_id || process.env.CANVAS_COURSE_ID || '1',
        source: 'api-token',
        entry: role,
        isLocalSession: false
      });
    } catch (e) {
      return null;
    }
  }
}
