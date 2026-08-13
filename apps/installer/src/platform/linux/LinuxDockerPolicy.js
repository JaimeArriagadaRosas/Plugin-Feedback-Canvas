export class LinuxDockerPolicy {
  constructor(host) {
    this.host = host;
    this.id = 'linux';
    this.waitTimeoutSeconds = 60;
  }

  missing() {
    return {
      message: 'Docker Engine no está instalado en Linux.',
      action: 'Instale Docker Engine y el plugin Compose V2 con el gestor de paquetes de su distribución.',
      fix: 'Consulte https://docs.docker.com/engine/install/ y evite instalar Docker Desktop salvo que lo elija expresamente.'
    };
  }

  daemon() {
    return {
      message: 'El daemon de Docker Engine no está activo.',
      action: 'Inícielo con `sudo systemctl start docker` y revise `systemctl status docker`.',
      fix: 'Linux: sudo systemctl enable --now docker'
    };
  }

  permission() {
    return {
      message: 'El socket de Docker existe, pero el usuario no tiene permisos.',
      action: 'Agregue el usuario al grupo docker y abra una sesión nueva.',
      fix: 'Linux: sudo usermod -aG docker $USER; cierre sesión y vuelva a entrar.'
    };
  }

  memory() {
    return {
      action: 'Docker Engine usa la memoria del host. Amplíe la VM o reduzca los servicios de Canvas; no existen preferencias de Docker Desktop en este modo.'
    };
  }

  compose() {
    return 'Instale el paquete Compose V2 de su distribución (por ejemplo, `sudo apt-get install docker-compose-v2`).';
  }

  install() {
    return {
      target: 'paquetes del sistema Linux',
      prompt: '¿Deseas instalar Docker Engine y Compose V2 mediante el gestor de paquetes de Linux?',
      declined: 'Instala Docker Engine siguiendo https://docs.docker.com/engine/install/ y vuelve a ejecutar npm start.'
    };
  }
}
