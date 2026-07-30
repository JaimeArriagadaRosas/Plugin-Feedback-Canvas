import BaseRole from './BaseRole.js';

export default class TeacherRole extends BaseRole {
  constructor() {
    super();
    this.defaultPermissions = {
      view_feedback: true,
      edit_feedback: true,
      submit_feedback: true,
      config_llm: false // Por defecto un profe no configura el LLM general
    };

    // Estos permisos pueden ser alterados por el admin para el rol de profesor
    this.mutablePermissions = [
      'view_feedback',
      'edit_feedback',
      'submit_feedback',
      'config_llm'
    ];
  }
}
