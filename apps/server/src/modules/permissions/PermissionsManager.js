import AdminRole from './roles/AdminRole.js';
import TeacherRole from './roles/TeacherRole.js';
import StudentRole from './roles/StudentRole.js';

export default class PermissionsManager {
  constructor(permissionsRepo) {
    this.permissionsRepo = permissionsRepo;
    
    // Instantiate role strategies
    this.roleStrategies = {
      admin: new AdminRole(),
      teacher: new TeacherRole(),
      student: new StudentRole()
    };
    
    // In-memory cache for role permission overrides
    this.cache = new Map();
  }

  /**
   * Gets the complete permission matrix (defaults + overrides) to send to frontend
   */
  async getPermissionsMatrix() {
    // Get overrides from DB (what the admin modified)
    const dbPermissions = await this.permissionsRepo.getPermissions();
    // Convert DB object list to map { role: permissions }
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
      
      // Build current permission state based on default and override
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
   * Gets cached overrides for a role, or queries DB if not in cache.
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
   * Validates if a role has a certain permission. Useful for middlewares or specific checks.
   */
  async checkPermission(role, permissionKey, context = {}) {
    // eslint-disable-next-line security/detect-object-injection
    const strategy = this.roleStrategies[role];
    if (!strategy) return false;

    const overrides = await this._getCachedOverrides(role);
    return strategy.hasPermission(permissionKey, overrides, context);
  }

  /**
   * Updates DB overrides for a specific role.
   * Filters keys to avoid saving immutable permissions.
   */
  async updateRoleOverrides(role, newPermissions) {
    // eslint-disable-next-line security/detect-object-injection
    const strategy = this.roleStrategies[role];
    if (!strategy) throw new Error(`Unknown role: ${role}`);

    const mutables = strategy.getMutableKeys();
    
    // Get current overrides
    const currentOverrides = await this._getCachedOverrides(role);
    
    // Filter only mutable keys for this role
    const filteredUpdate = { ...currentOverrides };
    for (const [key, value] of Object.entries(newPermissions)) {
      if (mutables.includes(key)) {
        // eslint-disable-next-line security/detect-object-injection
        filteredUpdate[key] = value;
      }
    }

    const result = await this.permissionsRepo.updatePermissions(role, filteredUpdate);
    
    // Invalidate cache for this role after update
    this.cache.delete(role);
    
    return result;
  }
}
