export default class BaseRole {
  constructor() {
    // We define the base permission schema (standard nomenclature in English)
    // These are the default values if there are no overrides in the database.
    this.defaultPermissions = {
      view_feedback: false,
      edit_feedback: false,
      submit_feedback: false,
      config_llm: false
    };

    // Interface configuration (which permissions are globally mutable by admin)
    this.mutablePermissions = [];
  }

  /**
   * Returns the default base permissions for this role
   */
  getDefaults() {
    return this.defaultPermissions;
  }

  /**
   * Returns the list of permissions that can be modified by an administrator
   */
  getMutableKeys() {
    return this.mutablePermissions;
  }

  /**
   * Evaluates if a permission is granted, taking into account overrides
   * saved in the database.
   * @param {string} permissionKey Permission key
   * @param {object} overrides Overridden options in DB
   * @param {object} context Request context (e.g. courseId, userId)
   */
  hasPermission(permissionKey, overrides = {}, context = {}) {
    // If the permission is not mutable for this role, it always returns the default value
    if (!this.mutablePermissions.includes(permissionKey)) {
      // eslint-disable-next-line security/detect-object-injection
      return this.defaultPermissions[permissionKey] || false;
    }
    
    // If there is an explicit override, we use it. If not, we use the default value.
    const safeOverrides = overrides || {};
    // eslint-disable-next-line security/detect-object-injection
    if (safeOverrides[permissionKey] !== undefined) {
      // eslint-disable-next-line security/detect-object-injection
      return safeOverrides[permissionKey];
    }
    
    // eslint-disable-next-line security/detect-object-injection
    return this.defaultPermissions[permissionKey] || false;
  }
}
