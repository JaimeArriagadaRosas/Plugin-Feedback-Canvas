import logger from '../../utils/logger.js';
import CanvasLmsAdapter from '../CanvasLmsAdapter.js';

/**
 * Adaptador local para Canvas. Extiende CanvasLmsAdapter.
 * Sobrescribe la forma en que se resuelve el token, buscando en la caché
 * local en lugar del repositorio oficial OAuth2, ya que en el entorno de docker
 * no hay flujo OAuth real.
 * Implementa la directiva 1: Separación de Lógica Exclusiva de Desarrollo Local.
 */
export default class CanvasLmsAdapterLocal extends CanvasLmsAdapter {
  constructor(canvasHttpClient, canvasTokenManager, env) {
    super(canvasHttpClient, canvasTokenManager, env);
    this.isLocalMode = true;
  }

  async _resolveLocalToken(teacherId) {
    try {
      const token = await this.tokenManager.getValidToken(teacherId);
      if (token) return token;
    } catch (e) {
      logger.warn(`[CanvasLmsAdapterLocal] No se encontró token en BD para sub ${teacherId}.`);
    }
    return null;
  }

  /**
   * Sobrescribe el resolveToken del padre para usar la lógica local.
   */
  async resolveToken(teacherId) {
    return await this._resolveLocalToken(teacherId);
  }
}
