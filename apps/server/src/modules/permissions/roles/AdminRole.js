import BaseRole from './BaseRole.js';

export default class AdminRole extends BaseRole {
  constructor() {
    super();
    this.defaultPermissions = {
      view_feedback: true,
      edit_feedback: true,
      submit_feedback: true,
      config_llm: true
    };

    // Al admin no se le pueden quitar permisos globalmente desde la UI para evitar lock-out
    this.mutablePermissions = [];
  }
}
