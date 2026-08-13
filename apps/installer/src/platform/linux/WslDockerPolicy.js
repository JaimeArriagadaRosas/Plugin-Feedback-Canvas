export class WslDockerPolicy {
  constructor(host) {
    this.host = host;
    this.id = 'wsl';
    this.waitTimeoutSeconds = 90;
  }

  missing() {
    return {
      message: `Docker no está disponible dentro de ${this.host.distro}.`,
      action: 'Elija un solo modo: integración WSL de Docker Desktop o Docker Engine nativo dentro de la distro.',
      fix: 'Docker Desktop: habilite Resources > WSL Integration. Engine nativo: siga https://docs.docker.com/engine/install/ubuntu/.'
    };
  }

  daemon(state) {
    if (state.cliOrigin === 'windows-interop') {
      return {
        message: 'WSL encontró el cliente de Docker de Windows, pero Docker Desktop no expone un daemon utilizable.',
        action: `Inicie Docker Desktop y habilite la integración para ${this.host.distro}; no instale un segundo Engine automáticamente.`,
        fix: 'Windows: Docker Desktop > Settings > Resources > WSL Integration.'
      };
    }
    return {
      message: 'Docker Engine nativo está instalado dentro de WSL, pero su daemon no está activo.',
      action: 'Inicie el servicio Linux con `sudo systemctl start docker`.',
      fix: 'WSL/Linux: sudo systemctl enable --now docker'
    };
  }

  permission(state) {
    if (state.cliOrigin === 'windows-interop') return this.daemon(state);
    return {
      message: 'El usuario de WSL no tiene permisos sobre el socket Docker nativo.',
      action: 'Agregue el usuario al grupo docker y reinicie la distro WSL.',
      fix: 'sudo usermod -aG docker $USER; luego ejecute `wsl --shutdown` desde Windows.'
    };
  }

  memory() {
    return {
      action: 'Ajuste la memoria desde Docker Desktop o desde `%UserProfile%\\.wslconfig` en Windows y reinicie WSL.'
    };
  }

  compose(state) {
    return state.cliOrigin === 'windows-interop'
      ? 'Actualice Docker Desktop y verifique que `docker compose version` funcione dentro de WSL.'
      : 'Instale Compose V2 dentro de la distro junto con Docker Engine.';
  }

  install() {
    return {
      target: `Docker Engine nativo dentro de ${this.host.distro}`,
      prompt: `No se detectó integración de Docker Desktop. ¿Deseas instalar explícitamente Docker Engine dentro de ${this.host.distro}?`,
      declined: `Habilita Docker Desktop > Resources > WSL Integration para ${this.host.distro} y vuelve a ejecutar npm start.`
    };
  }
}
