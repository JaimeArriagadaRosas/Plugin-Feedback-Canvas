import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from './utils/Runner.js';
import { getPluginDirectory, getAssetsMarker } from './utils/LocalWorkspacePaths.js';
import { DockerRuntimeProbe, DockerRuntimeStatus } from '../platform/shared/DockerRuntimeProbe.js';
import { checkCanvasDatabasePreflight } from './CanvasDatabasePreflight.js';

export class PreflightChecks {
  constructor(boot, canvasDir, pluginDir, { dockerProbe = new DockerRuntimeProbe(), dockerState = null } = {}) {
    this.boot = boot;
    this.canvasDir = canvasDir;
    this.pluginDir = pluginDir;
    this.MIN_RAM_GB = 8;
    this.dockerProbe = dockerProbe;
    this.dockerState = dockerState;
  }

  async runChecks() {
    this.boot.info('Iniciando verificación de componentes estáticos');
    this.boot.plain('');
    this.boot.plain('=========================================================');
    this.boot.plain('   VERIFICACION DE COMPONENTES - CANVAS LMS LOCAL');
    this.boot.plain('=========================================================');

    const checks = [
      { name: 'Docker', fn: () => this.checkDocker() },
      { name: 'Docker Compose', fn: () => this.checkDockerCompose() },
      { name: 'Canvas LMS', fn: () => this.checkCanvasClone() },
      { name: 'Node.js', fn: () => this.checkNode() },
      { name: 'NPM', fn: () => this.checkNpm() },
      { name: 'Dependencias del plugin (DB/Gotenberg)', fn: () => this.checkPluginDb() }
    ];

    const missing = {};
    let allOk = true;

    for (let i = 0; i < checks.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const check = checks[i];
      const progress = `[${i + 1}/6] Verificando ${check.name}...`;
      if (typeof this.boot.beginInlineCheck === 'function') this.boot.beginInlineCheck(progress);
      else this.boot.info(progress);
      let result;
      try {
        result = await check.fn();
      } finally {
        this.boot.endInlineCheck?.();
      }
      const { ok, details } = result;

      if (!ok) {
        allOk = false;
        Object.assign(missing, details);
        this.boot.error(`[${i + 1}/6] ${check.name}: no disponible`);
      } else {
        this.boot.success(`[${i + 1}/6] ${check.name}`);
      }
    }

    this.boot.info('Verificación de componentes completada.');
    return { allOk, missing };
  }

  async checkDocker() {
    if (!this.dockerState) {
      this.dockerState = await this.dockerProbe.inspect();
    }
    if (this.dockerState.status === DockerRuntimeStatus.ACTIVE) return { ok: true, details: {} };
    if (this.dockerState.cliOrigin === 'windows-interop') {
      return {
        ok: false,
        details: {
          missing_docker: true,
          docker_state: this.dockerState,
          windows_docker_interop_unavailable: true
        }
      };
    }
    if (this.dockerState.status === DockerRuntimeStatus.MISSING) {
      return { ok: false, details: { missing_docker: true, docker_state: this.dockerState } };
    }
    if (this.dockerState.status === DockerRuntimeStatus.PERMISSION_DENIED) {
      return { ok: false, details: { docker_permission_denied: true, docker_state: this.dockerState } };
    }
    return { ok: false, details: { docker_daemon_down: true, docker_state: this.dockerState } };
  }

  async checkDockerCompose() {
    const state = this.dockerState || await this.dockerProbe.inspect();
    return {
      ok: state.composeAvailable,
      details: state.composeAvailable ? {} : { missing_compose: true }
    };
  }

  async checkCanvasClone() {
    const composeFile = path.join(this.canvasDir, 'docker-compose.yml');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const cloneExists = fs.existsSync(composeFile);
    
    if (!cloneExists) {
      return { ok: false, details: { missing_canvas_clone: true } };
    }
    
    // Si existe el clon, verificar que se haya completado el AssetBuilder exitosamente
    const assetsMarker = getAssetsMarker(this.canvasDir);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(assetsMarker)) {
      return { ok: false, details: { missing_canvas_assets: true } };
    }

    // Una comprobación previa no debe iniciar contenedores ni reconstruir datos.
    // Si PostgreSQL propio está detenido, el bringup normal puede iniciarlo;
    // solo entonces se comprobará su disponibilidad en la etapa postflight.
    const database = await checkCanvasDatabasePreflight(this.canvasDir);
    if (database.state === 'ready') return { ok: true, details: {} };
    if (database.state === 'stopped') {
      this.boot.warn('PostgreSQL de Canvas detenido y verificado; se comprobará al arrancar normalmente.');
      return { ok: true, details: {} };
    }
    if (database.state === 'schema_incomplete') {
      this.boot.error('El esquema de Canvas está incompleto. Se requiere respaldo y revisión; no se reconstruirán assets.');
      return { ok: false, details: { canvas_database_incomplete: true } };
    }
    this.boot.warn('No se pudo demostrar la identidad o disponibilidad de PostgreSQL de Canvas (' +
      database.state + '). Se bloquea la reparación automática.');
    return { ok: false, details: { canvas_database_unverified: true } };
  }

  async checkPluginDb() {
    if (process.env.KEYS_REGENERATED === 'true') {
      this.boot.warn('Se regeneraron llaves locales; los volúmenes Docker NO se eliminarán automáticamente.');
      this.boot.action('Si necesita reiniciar datos, use un procedimiento explícito de backup/reset después de verificar el entorno.');
    }

    const { success, out } = await runCommand('docker', ['compose', '-f', 'docker-compose.db.yml', 'ps', '--format', 'json', 'db', 'gotenberg'], { cwd: this.pluginDir, captureAll: true });

    let dbStatus = 'missing';
    let gotenbergStatus = 'missing';

    if (success && out) {
      const lines = out.trim().split('\n').filter(l => l.trim().length > 0);
      for (const line of lines) {
        try {
          const c = JSON.parse(line);
          if (c.Service === 'db') dbStatus = c.Health || c.State;
          if (c.Service === 'gotenberg') gotenbergStatus = c.Health || c.State;
        } catch { }
      }
    }

    const ok = dbStatus === 'healthy' && gotenbergStatus === 'healthy';
    const details = {};
    if (dbStatus !== 'healthy') details.plugin_db_status = dbStatus;
    if (gotenbergStatus !== 'healthy') details.gotenberg_status = gotenbergStatus;

    return { ok, details };
  }

  async checkNode() {
    const { success } = await runCommand('node', ['--version']);
    return { ok: success, details: success ? {} : { missing_node: true } };
  }

  async checkNpm() {
    const { success } = await runCommand('npm', ['--version']);
    return { ok: success, details: success ? {} : { missing_npm: true } };
  }
}
