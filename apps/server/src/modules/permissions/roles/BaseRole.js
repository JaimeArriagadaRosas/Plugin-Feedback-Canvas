export default class BaseRole {
  constructor() {
    // Definimos el esquema base de permisos (nomenclatura estándar en inglés)
    // Estos son los valores por defecto si no hay overrides en la base de datos.
    this.defaultPermissions = {
      view_feedback: false,
      edit_feedback: false,
      submit_feedback: false,
      config_llm: false
    };

    // Configuración de la interfaz (qué permisos son mutables por el admin globalmente)
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
    // Si el permiso no es mutable para este rol, siempre retorna el valor por defecto
    if (!this.mutablePermissions.includes(permissionKey)) {
      // eslint-disable-next-line security/detect-object-injection
      return this.defaultPermissions[permissionKey] || false;
    }
    
    // Si hay un override explícito, lo usamos. Si no, usamos el valor por defecto.
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
