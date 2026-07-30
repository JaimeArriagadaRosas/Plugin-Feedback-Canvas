export default class PermissionsService {
  constructor(permissionsRepo) {
    this.permissionsRepo = permissionsRepo;
  }

  async getAllPermissions() {
    return this.permissionsRepo.getPermissions();
  }

  async getRolePermissions(role) {
    return this.permissionsRepo.getPermissionsByRole(role);
  }

  async updatePermissions(role, permissions) {
    return this.permissionsRepo.updatePermissions(role, permissions);
  }
}
