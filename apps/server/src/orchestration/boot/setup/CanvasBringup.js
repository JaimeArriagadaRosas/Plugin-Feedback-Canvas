import { runCommand } from './utils/Runner.js';

export class CanvasBringup {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
  }

  async bringup() {
    this.boot.info('Iniciando stack de Canvas LMS...');
    if (!(await this.startStack())) return false;
    
    if (!(await this.ensureRubyDependencies())) return false;
    
    if (!(await this.waitForReady())) return false;

    return true;
  }

  async startStack() {
    this.boot.info('Iniciando contenedores de Canvas LMS...');
    const { success, err } = await runCommand('docker', ['compose', 'up', '-d'], { cwd: this.canvasDir });
    
    if (success) {
      this.boot.success('Contenedores de Canvas LMS iniciados');
      return true;
    } else {
      this.boot.error(`Error al iniciar Canvas LMS: ${err}`);
      this.boot.error(`Error al iniciar Docker Compose: ${err}`);
      return false;
    }
  }

  async ensureRubyDependencies() {
    this.boot.info('Verificando dependencias Ruby de Canvas...');
    
    // Fall-fast check
    const checkRes = await runCommand('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'check'], { cwd: this.canvasDir });
    if (checkRes.success) {
      this.boot.success('Dependencias Ruby listas');
      return true;
    }

    this.boot.info('Dependencias Ruby incompletas. Instalando gems...');
    
    // Fix critical issue with missing bundler-multilock plugin
    const fixCmd = "bundle plugin install bundler-multilock"; // Or just install it
    await runCommand('docker', ['compose', 'exec', '-T', 'web', 'bash', '-c', fixCmd], { cwd: this.canvasDir });

    const installCmd = "bundle config set --local frozen false && bundle install --jobs=2";
    
    const { success, out, err } = await runCommand('docker', ['compose', 'exec', '-T', 'web', 'bash', '-c', installCmd], { cwd: this.canvasDir });
    if (success) {
      await runCommand('docker', ['compose', 'restart', 'jobs'], { cwd: this.canvasDir });
      this.boot.success('Dependencias Ruby instaladas');
      return true;
    } else {
      this.boot.error('Error instalando dependencias Ruby (bundle install)');
      this.boot.error(`bundle install falló: ${out} ${err}`);
      return false; // Fail fast!
    }
  }

  async waitForReady(timeout = 180, interval = 5) {
    this.boot.info('Esperando a que Canvas LMS esté listo...');
    let elapsed = 0;
    
    while (elapsed < timeout) {
      const { success, out } = await runCommand('docker', ['compose', 'ps', '-q', 'web'], { cwd: this.canvasDir, captureAll: true });
      if (success && out.trim()) {
        this.boot.success('Canvas LMS está corriendo');
        return true;
      }
      await new Promise(r => setTimeout(r, interval * 1000));
      elapsed += interval;
    }

    this.boot.error(`Timeout: Canvas LMS no inició en ${timeout}s`);
    return false;
  }
}
