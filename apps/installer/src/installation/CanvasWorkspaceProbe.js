import { runCommand } from './utils/Runner.js';

export class CanvasWorkspaceProbe {
  constructor(boot, canvasDir, { runner = runCommand } = {}) {
    this.boot = boot;
    this.canvasDir = canvasDir;
    this.runner = runner;
  }

  async runChecks() {
    this.boot.info('Verificando permisos y estado del workspace...');
    
    let ok = true;
    const errors = [];

    // Verificamos el usuario actual del contenedor (para reportar si somos root)
    const idCmd = await this.runner('docker', ['compose', 'exec', '-T', 'web', 'id', '-u'], {
      cwd: this.canvasDir,
      captureAll: true
    });
    
    const isRootUser = idCmd.success && idCmd.out.trim() === '0';

    // Verificamos propiedad de development.log
    const logStatCmd = await this.runner('docker', [
      'compose', 'exec', '-T', 'web', 'stat', '-c', '%U:%G %a', '/usr/src/app/log/development.log'
    ], { cwd: this.canvasDir, captureAll: true });

    if (logStatCmd.success) {
      const output = logStatCmd.out.trim();
      if (output.includes('root:root') && !isRootUser) {
        ok = false;
        errors.push({
          type: 'CANVAS_LOG_PERMISSION_DENIED',
          message: 'development.log tiene como propietario a root, pero el contenedor ejecuta como usuario normal. Esto provocará un EACCES al iniciar la aplicación.',
          details: output
        });
      }
    }

    // Verificamos si podemos escribir en tmp
    const tmpWriteCmd = await this.runner('docker', [
      'compose', 'exec', '-T', 'web', 'bash', '-c', 'touch /usr/src/app/tmp/.probe && rm /usr/src/app/tmp/.probe'
    ], { cwd: this.canvasDir, captureAll: true });

    if (!tmpWriteCmd.success) {
      ok = false;
      errors.push({
        type: 'CANVAS_TMP_PERMISSION_DENIED',
        message: 'No se tienen permisos de escritura en el directorio tmp.',
        details: tmpWriteCmd.err || tmpWriteCmd.out
      });
    }

    if (!ok) {
      this.boot.error('Se detectaron problemas de permisos en los volúmenes de Canvas.');
    } else {
      this.boot.success('Workspace verificado correctamente.');
    }

    return { ok, errors };
  }
}
