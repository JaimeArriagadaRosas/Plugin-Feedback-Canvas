import BaseRole from './BaseRole.js';

export default class StudentRole extends BaseRole {
  constructor() {
    super();
    this.defaultPermissions = {
      view_feedback: true,
      edit_feedback: false,
      submit_feedback: false,
      config_llm: false
    };

    // Para el student, la mayoría de permisos no son mutables para proteger la integridad.
    // La vista está activa por defecto, pero el administrador puede deshabilitarla.
    this.mutablePermissions = [
      'view_feedback'
    ];
  }
}
