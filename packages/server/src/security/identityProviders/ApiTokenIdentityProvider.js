import CanvasService from '../../services/infrastructure/CanvasService.js';
import CanvasServiceLocal from '../../services/infrastructure/CanvasService_local.js';
import { toRoleURN } from '../../utils/roles.js';

export class ApiTokenIdentityProvider {
  name = 'api-token';

  async authenticate(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    if (!token || token.startsWith('dev-token')) return null;

    const canvasService = process.env.USE_LOCAL_DATA === 'true'
      ? new CanvasServiceLocal()
      : new CanvasService();

    try {
      const user = await canvasService.getUserInfo(token);
      if (!user) return null;

      const role = user.roles?.includes('admin') ? 'admin' : 'teacher';
      const ltiRoles = [toRoleURN(role)];

      return {
        user: user.id || user.canvas_user_id,
        role: ltiRoles,
        courseId: user.course_id || process.env.CANVAS_COURSE_ID || '1',
        isLocalSession: false,
        localRole: role,
        source: 'api-token'
      };
    } catch (e) {
      return null;
    }
  }
}
