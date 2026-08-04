import { runCommand } from '../../utils/Runner.js';

export class LinuxDockerInstaller {
  constructor(boot, logFile) {
    this.boot = boot;
    this.logFile = logFile;
  }

  async isInstalled() {
    const { success } = await runCommand('docker', ['--version']);
    return success;
  }

  async install() {
    this.boot.info('Analizando distribución de Linux para la instalación de Docker...');
    
    // Mitigación: Soporte nativo para Arch Linux (que falla con el script de Docker)
    const hasPacman = (await runCommand('which', ['pacman'])).success;
    
    if (hasPacman) {
      this.boot.info('Arch Linux detectado (pacman). Instalando paquetes nativos...');
      this.boot.warn('Se requerirán privilegios de root. Por favor, introduzca su contraseña si se le solicita.');
      
      const { success, err } = await runCommand('sudo', ['pacman', '-S', '--noconfirm', 'docker', 'docker-compose', 'docker-buildx'], { logFile: this.logFile });
      if (!success) {
        this.boot.error(`Fallo instalando vía pacman: ${err}`);
        return false;
      }
    } else {
      // Distribuciones soportadas por get.docker.com (Debian, Ubuntu, Fedora, RHEL, CentOS)
      this.boot.info('Distribución estándar detectada. Descargando script oficial de Docker...');
      this.boot.warn('Se requerirán privilegios de root (Sudo).');
      
      const { success: scriptSuccess, err: scriptErr } = await runCommand('curl', ['-fsSL', 'https://get.docker.com', '-o', 'get-docker.sh']);
      if (!scriptSuccess) {
        this.boot.error(`Fallo descargando get-docker.sh: ${scriptErr}`);
        return false;
      }

      this.boot.info('Ejecutando script oficial de instalación (esto instalará Docker Engine y Compose V2)...');
      const { success: installSuccess, err: installErr } = await runCommand('sudo', ['sh', 'get-docker.sh'], { logFile: this.logFile });
      if (!installSuccess) {
        this.boot.error(`Fallo instalando Docker: ${installErr}`);
        return false;
      }
    }

    this.boot.info('Iniciando y habilitando el servicio de Docker en systemd...');
    await runCommand('sudo', ['systemctl', 'start', 'docker']);
    await runCommand('sudo', ['systemctl', 'enable', 'docker']);
    
    this.boot.warn('IMPORTANTE: Es posible que necesite permisos para correr Docker sin sudo.');
    this.boot.action(`Ejecute manualmente: sudo usermod -aG docker $USER`);
    this.boot.action(`Y luego reinicie su sesión para aplicar los cambios.`);
    
    return true;
  }

  async isUpdating() {
    return false;
  }
}
