import AdminRole from './roles/AdminRole.js';
import TeacherRole from './roles/TeacherRole.js';
import StudentRole from './roles/StudentRole.js';

export default class PermissionsManager {
  constructor(permissionsRepo) {
    this.permissionsRepo = permissionsRepo;
    
    // Instanciamos las estrategias por rol
    this.roleStrategies = {
      admin: new AdminRole(),
      teacher: new TeacherRole(),
      student: new StudentRole()
    };
    
    // Caché en memoria para los overrides de permisos por rol
    this.cache = new Map();
  }

  /**
   * Obtiene la matriz completa de permisos (defaults + overrides) para enviar al frontend
   */
  async getPermissionsMatrix() {
    // Obtenemos los overrides de la DB (lo que el admin modificó)
    const dbPermissions = await this.permissionsRepo.getPermissions();
    // Convertimos la lista de objetos de BD a un mapa { rol: permisos }
    const overridesMap = dbPermissions.reduce((acc, row) => {
      acc[row.rol] = row.permisos || {};
      return acc;
    }, {});

    const matrix = Object.keys(this.roleStrategies).map(roleKey => {
      // eslint-disable-next-line security/detect-object-injection
      const strategy = this.roleStrategies[roleKey];
      const defaults = strategy.getDefaults();
      const mutables = strategy.getMutableKeys();
      // eslint-disable-next-line security/detect-object-injection
      const overrides = overridesMap[roleKey] || {};

      const computedPermissions = {};
      
      // Construimos el estado actual del permiso basado en default y override
      for (const [permKey, defaultValue] of Object.entries(defaults)) {
        // eslint-disable-next-line security/detect-object-injection
        computedPermissions[permKey] = {
          value: strategy.hasPermission(permKey, overrides),
          isMutable: mutables.includes(permKey)
        };
      }

      return {
        rol: roleKey,
        permisos: computedPermissions
      };
    });

    return matrix;
  }

  /**
   * Obtiene los overrides cacheados para un rol, o consulta la BD si no están en caché.
   */
  async _getCachedOverrides(role) {
    if (this.cache.has(role)) {
      return this.cache.get(role);
    }
    const overrides = await this.permissionsRepo.getPermissionsByRole(role) || {};
    this.cache.set(role, overrides);
    return overrides;
  }

  /**
   * Valida si un rol tiene cierto permiso. Útil para middlewares o chequeos específicos.
   */
  async checkPermission(role, permissionKey, context = {}) {
    // eslint-disable-next-line security/detect-object-injection
    const strategy = this.roleStrategies[role];
    if (!strategy) return false;

    const overrides = await this._getCachedOverrides(role);
    return strategy.hasPermission(permissionKey, overrides, context);
  }

  /**
   * Actualiza los overrides en la BD para un rol específico.
   * Filtra las llaves para evitar guardar permisos inmutables.
   */
  async updateRoleOverrides(role, newPermissions) {
    // eslint-disable-next-line security/detect-object-injection
    const strategy = this.roleStrategies[role];
    if (!strategy) throw new Error(`Rol desconocido: ${role}`);

    const mutables = strategy.getMutableKeys();
    
    // Obtenemos los overrides actuales
    const currentOverrides = await this._getCachedOverrides(role);
    
    // Filtramos solo las llaves mutables para este rol
    const filteredUpdate = { ...currentOverrides };
    for (const [key, value] of Object.entries(newPermissions)) {
      if (mutables.includes(key)) {
        // eslint-disable-next-line security/detect-object-injection
        filteredUpdate[key] = value;
      }
    }

    const result = await this.permissionsRepo.updatePermissions(role, filteredUpdate);
    
    // Invalidamos la caché de este rol tras la actualización
    this.cache.delete(role);
    
    return result;
  }
}
