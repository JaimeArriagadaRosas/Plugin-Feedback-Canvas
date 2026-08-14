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
   * Retorna los permisos base por defecto de este rol
   */
  getDefaults() {
    return this.defaultPermissions;
  }

  /**
   * Retorna la lista de permisos que pueden ser modificados por un administrador
   */
  getMutableKeys() {
    return this.mutablePermissions;
  }

  /**
   * Evalúa si un permiso está concedido, tomando en cuenta las excepciones (overrides)
   * guardadas en base de datos.
   * @param {string} permissionKey Clave del permiso
   * @param {object} overrides Opciones sobreescritas en DB
   * @param {object} context Contexto de la petición (ej. courseId, userId)
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
