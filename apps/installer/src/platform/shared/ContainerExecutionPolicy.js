export class ContainerExecutionPolicy {
  constructor(dockerProfile) {
    this.profile = dockerProfile || {};
  }

  /**
   * Determina los argumentos básicos a inyectar en comandos `docker compose exec`.
   * La regla principal es NO usar `--user root` en el flujo normal, permitiendo
   * que el contenedor ejecute con el usuario nativo de la imagen (docker).
   */
  getExecutionArgs(context = 'default') {
    const args = [];
    
    // Antiguamente se inyectaban --user root y variables como HOME=/tmp.
    // Esto ya no se hace automáticamente. Si un consumidor particular requiere
    // variables, se deben pasar explícitamente, pero el usuario será el de la imagen.

    return args;
  }
}
