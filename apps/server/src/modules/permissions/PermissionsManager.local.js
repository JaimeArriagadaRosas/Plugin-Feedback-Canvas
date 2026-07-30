import PermissionsManager from './PermissionsManager.js';

export default class PermissionsManagerLocal extends PermissionsManager {
  constructor(permissionsRepo) {
    super(permissionsRepo);
  }

  /**
   * En el entorno local, podríamos simular roles que no están en BD o inyectar permisos forzados
   */
  async getPermissionsMatrix() {
    const matrix = await super.getPermissionsMatrix();
    // Ejemplo: en local, siempre permitimos todo al admin, sin importar la BD.
    const adminConfig = matrix.find(m => m.rol === 'admin');
    if (adminConfig) {
      for (const key of Object.keys(adminConfig.permisos)) {
        // eslint-disable-next-line security/detect-object-injection
        adminConfig.permisos[key].value = true;
      }
    }
    return matrix;
  }
}
