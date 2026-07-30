import BaseRole from './BaseRole.js';

export default class StudentRole extends BaseRole {
  constructor() {
    super();
    this.defaultPermissions = {
      view_feedback: false, // Deshabilitado por ahora según requisitos del usuario (próximamente)
      edit_feedback: false,
      submit_feedback: false,
      config_llm: false
    };

    // Para el estudiante, la mayoría de permisos no son mutables para proteger la integridad.
    // Solo permitimos habilitar vista de feedback si el admin lo desea en el futuro.
    this.mutablePermissions = [
      'view_feedback'
    ];
  }
}
