export const ExecutionContext = Object.freeze({
  NATIVE: 'native',
  WORKSPACE_WRITE: 'workspace-write',
  CONTAINER_CACHE_WRITE: 'container-cache-write'
});

export class ContainerExecutionPolicy {
  constructor(dockerProfile) {
    this.profile = dockerProfile || {};
  }

  /**
   * Determines the USER_ID to inject during the build stage (usually hostUid).
   * In Rootless or usernsRemap environments, Docker transparently maps users,
   * so we return null to skip injection.
   */
  getBuildUserId() {
    if (!this.profile.backend || !this.profile.capabilities) {
      return null;
    }

    const isLinuxEngine = this.profile.backend === 'docker-engine-linux';
    const { rootless, usernsRemap, hostUid, installerIsRoot } = this.profile.capabilities;

    if (!isLinuxEngine || installerIsRoot || rootless || usernsRemap) {
      return null;
    }

    if (hostUid && hostUid > 0) {
      return hostUid.toString();
    }

    return null;
  }

  /**
   * Determines the base arguments to inject into `docker compose exec` commands
   * depending on the execution context.
   */
  getExecutionArgs(context = ExecutionContext.NATIVE) {
    const args = [];

    if (!this.profile.backend || !this.profile.capabilities) {
      return args;
    }

    const isLinuxEngine = this.profile.backend === 'docker-engine-linux';
    const { rootless } = this.profile.capabilities;

    // Only Rootless has the verified policy of requiring 0:0 to write to the workspace
    if (isLinuxEngine && rootless && context === ExecutionContext.WORKSPACE_WRITE) {
      args.push('--user', '0:0');
    }

    return args;
  }
}
