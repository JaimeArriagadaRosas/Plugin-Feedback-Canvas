export class WindowsDockerPolicy {
  constructor(host) {
    this.host = host;
    this.id = 'windows';
    this.waitTimeoutSeconds = 180;
  }

  missing() {
    return {
      message: 'Docker Desktop no está instalado o su CLI no está en PATH.',
      action: 'Instale Docker Desktop para Windows y habilite el backend WSL2.',
      fix: 'Windows: https://docs.docker.com/desktop/setup/install/windows-install/'
    };
  }

  daemon() {
    return {
      message: 'Docker Desktop está instalado, pero su daemon no está disponible.',
      action: 'Abra Docker Desktop y espere hasta que indique que el Engine está activo.',
      fix: 'Inicie Docker Desktop y revise el backend WSL2.'
    };
  }

  permission() {
    return this.daemon();
  }

  memory() {
    return {
      action: 'Ajuste la memoria del backend WSL2 en `%UserProfile%\\.wslconfig` y reinicie Docker Desktop.'
    };
  }

  compose() {
    return 'Actualice o repare Docker Desktop; Compose V2 debe venir incluido.';
  }

  install() {
    return {
      target: 'C:\\Program Files\\Docker\\Docker',
      prompt: '¿Deseas descargar e instalar Docker Desktop para Windows?',
      declined: 'Instala Docker Desktop desde https://docs.docker.com/desktop/setup/install/windows-install/ y vuelve a ejecutar npm start.'
    };
  }
}
