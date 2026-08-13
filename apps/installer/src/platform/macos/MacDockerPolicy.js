export class MacDockerPolicy {
  constructor(host) {
    this.host = host;
    this.id = 'mac';
    this.waitTimeoutSeconds = 180;
  }

  missing() {
    return {
      message: 'No se encontró un runtime Docker compatible en macOS.',
      action: 'Instale Docker Desktop u OrbStack de forma explícita.',
      fix: 'macOS: https://docs.docker.com/desktop/setup/install/mac-install/'
    };
  }

  daemon() {
    return {
      message: 'El runtime de contenedores de macOS no está activo.',
      action: 'Abra Docker Desktop u OrbStack y complete sus permisos iniciales.',
      fix: 'Inicie la aplicación de contenedores seleccionada.'
    };
  }

  permission() {
    return this.daemon();
  }

  memory() {
    return {
      action: 'Ajuste la memoria desde las preferencias del runtime de contenedores de macOS.'
    };
  }

  compose() {
    return 'Actualice el runtime seleccionado y verifique que exponga `docker compose`.';
  }

  install() {
    return {
      target: '/Applications',
      prompt: '¿Deseas instalar un runtime de contenedores compatible para macOS?',
      declined: 'Instala Docker Desktop u OrbStack y vuelve a ejecutar npm start.'
    };
  }
}
