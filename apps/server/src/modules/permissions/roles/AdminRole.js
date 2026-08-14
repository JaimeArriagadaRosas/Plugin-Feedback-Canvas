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

    // Admin cannot have permissions removed globally from UI to prevent lock-out
    this.mutablePermissions = [];
  }
}
