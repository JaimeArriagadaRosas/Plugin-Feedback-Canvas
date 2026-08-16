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

    const idCmd = await this.runner('docker', ['compose', 'exec', '-T', 'web', 'id', '-u'], {
      cwd: this.canvasDir,
      captureAll: true
    });
    const uid = idCmd.success ? idCmd.out.trim() : 'unknown';

    const checkWrite = async (path, type) => {
      const probeCmd = await this.runner('docker', [
        'compose', 'exec', '-T', 'web', 'bash', '-c', `touch ${path}/.probe && rm ${path}/.probe`
      ], { cwd: this.canvasDir, captureAll: true });

      if (!probeCmd.success) {
        ok = false;
        const statCmd = await this.runner('docker', [
          'compose', 'exec', '-T', 'web', 'stat', '-c', '%u:%g %a', path
        ], { cwd: this.canvasDir, captureAll: true });
        
        const statOutput = statCmd.success ? statCmd.out.trim() : 'unknown';
        
        errors.push({
          type,
          message: `No se tienen permisos de escritura en ${path} (ejecutando como UID ${uid}).`,
          details: `Stat: ${statOutput}\nError: ${probeCmd.err || probeCmd.out}`
        });
      }
    };

    await checkWrite('/usr/src/app', 'CANVAS_WORKSPACE_PERMISSION_DENIED');
    await checkWrite('/usr/src/app/log', 'CANVAS_LOG_PERMISSION_DENIED');
    await checkWrite('/usr/src/app/tmp', 'CANVAS_TMP_PERMISSION_DENIED');
    await checkWrite('/home/docker/.gem', 'CANVAS_GEM_PERMISSION_DENIED');
    await checkWrite('/home/docker/.bundle', 'CANVAS_BUNDLE_PERMISSION_DENIED');

    if (!ok) {
      this.boot.error('Se detectaron problemas de permisos en los volúmenes de Canvas.');
    } else {
      this.boot.success('Workspace verificado correctamente.');
    }

    return { ok, errors };
  }
}
