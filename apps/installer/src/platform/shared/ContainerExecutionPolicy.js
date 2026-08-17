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
   * Determina el USER_ID a inyectar en la etapa de build (usualmente hostUid).
   * En entornos Rootless o usernsRemap, Docker mapea transparentemente los usuarios,
   * por lo que devolvemos null para omitir la inyeccion.
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
   * Determina los argumentos básicos a inyectar en comandos `docker compose exec`
   * dependiendo del contexto de ejecución.
   */
  getExecutionArgs(context = ExecutionContext.NATIVE) {
    const args = [];

    if (!this.profile.backend || !this.profile.capabilities) {
      return args;
    }

    const isLinuxEngine = this.profile.backend === 'docker-engine-linux';
    const { rootless } = this.profile.capabilities;

    // Solo Rootless tiene la politica comprobada de requerir 0:0 para escribir en el workspace
    if (isLinuxEngine && rootless && context === ExecutionContext.WORKSPACE_WRITE) {
      args.push('--user', '0:0');
    }

    return args;
  }
}
