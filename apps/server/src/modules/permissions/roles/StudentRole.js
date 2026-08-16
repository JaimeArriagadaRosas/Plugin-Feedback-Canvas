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

    // For the student, most permissions are not mutable to protect integrity.
    // The view is active by default, but the administrator can disable it.
    this.mutablePermissions = [
      'view_feedback'
    ];
  }
}
