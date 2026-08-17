import { runCommand } from './utils/Runner.js';
import { ContainerExecutionPolicy, ExecutionContext } from '../platform/shared/ContainerExecutionPolicy.js';

export class CanvasWorkspaceProbe {
  constructor(boot, canvasDir, { runner = runCommand, dockerProfile = null } = {}) {
    this.boot = boot;
    this.canvasDir = canvasDir;
    this.runner = runner;
    this.executionPolicy = new ContainerExecutionPolicy(dockerProfile);
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

    const checkWrite = async (path, type, context) => {
      const userArgs = this.executionPolicy.getExecutionArgs(context);
      const probeCmd = await this.runner('docker', [
        'compose', 'exec', '-T', ...userArgs, 'web', 'bash', '-c', `touch ${path}/.probe && rm ${path}/.probe`
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

    // Bind-mount paths require WORKSPACE_WRITE context (uses --user 0:0 in Rootless)
    await checkWrite('/usr/src/app', 'CANVAS_WORKSPACE_PERMISSION_DENIED', ExecutionContext.WORKSPACE_WRITE);
    await checkWrite('/usr/src/app/log', 'CANVAS_LOG_PERMISSION_DENIED', ExecutionContext.WORKSPACE_WRITE);
    await checkWrite('/usr/src/app/tmp', 'CANVAS_TMP_PERMISSION_DENIED', ExecutionContext.WORKSPACE_WRITE);
    // Container-internal paths use CONTAINER_CACHE_WRITE context
    await checkWrite('/home/docker/.gem', 'CANVAS_GEM_PERMISSION_DENIED', ExecutionContext.CONTAINER_CACHE_WRITE);
    await checkWrite('/home/docker/.bundle', 'CANVAS_BUNDLE_PERMISSION_DENIED', ExecutionContext.CONTAINER_CACHE_WRITE);

    if (!ok) {
      this.boot.error('Se detectaron problemas de permisos en los volúmenes de Canvas.');
    } else {
      this.boot.success('Workspace verificado correctamente.');
    }

    return { ok, errors };
  }
}
