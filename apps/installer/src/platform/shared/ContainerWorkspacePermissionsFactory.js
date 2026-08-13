import { LinuxContainerWorkspacePermissions } from '../linux/LinuxContainerWorkspacePermissions.js';

const noopPermissions = { prepare: async () => [] };

export function createContainerWorkspacePermissions(platform, dependencies) {
  if (platform === 'linux') return new LinuxContainerWorkspacePermissions(dependencies);
  return noopPermissions;
}
