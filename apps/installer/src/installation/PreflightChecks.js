import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from './utils/Runner.js';
import { DockerRuntimeProbe, DockerRuntimeStatus } from '../platform/shared/DockerRuntimeProbe.js';

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
      { name: 'Canvas LMS clone', fn: () => this.checkCanvasClone() },
      { name: 'Node.js', fn: () => this.checkNode() },
      { name: 'NPM', fn: () => this.checkNpm() },
      { name: 'Plugin Feedback DB', fn: () => this.checkPluginDb() }
    ];

    const missing = {};
    let allOk = true;

    for (let i = 0; i < checks.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const check = checks[i];
      this.boot.info(`[${i + 1}/6] Verificando ${check.name}...`);
      const { ok, details } = await check.fn();
      
      if (!ok) {
        allOk = false;
        Object.assign(missing, details);
        this.boot.error(`${check.name}: no disponible`);
      } else {
        this.boot.success(check.name);
      }
    }

    this.boot.info(`Verificación completada.`);
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
    const assetsMarker = path.join(this.canvasDir, '.assets_built');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(assetsMarker)) {
      return { ok: false, details: { missing_canvas_assets: true } };
    }

    // Ping a la base de datos para asegurar que las tablas no se hayan perdido por un "docker compose down"
    try {
      await runCommand('docker', ['compose', 'up', '-d', 'postgres'], { cwd: this.canvasDir });
      // Esperar 2 segundos para asegurar que PostgreSQL acepte conexiones si se acaba de levantar
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      const { success, out } = await runCommand('docker', [
        'compose', 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'canvas_development', '-c',
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts' LIMIT 1;"
      ], { cwd: this.canvasDir, captureAll: true });

      if (!success || !out.includes('1')) {
        this.boot.warn('Se detectó que la base de datos de Canvas está vacía (posible volumen destruido).');
        return { ok: false, details: { missing_canvas_assets: true } };
      }
    } catch (err) {
      this.boot.warn('Error al verificar la base de datos de Canvas, se asumirá que requiere reconstrucción.');
      return { ok: false, details: { missing_canvas_assets: true } };
    }
    
    return { ok: true, details: {} };
  }

  async checkPluginDb() {
    if (process.env.KEYS_REGENERATED === 'true') {
      this.boot.warn('Se regeneraron llaves locales; los volúmenes Docker NO se eliminarán automáticamente.');
      this.boot.action('Si necesita reiniciar datos, use un procedimiento explícito de backup/reset después de verificar el entorno.');
    }

    const { success, out } = await runCommand('docker', ['compose', '-f', 'docker-compose.db.yml', 'ps', '-q', 'db'], { cwd: this.pluginDir, captureAll: true });
    const isRunning = success && out && out.trim().length > 0;
    return { ok: isRunning, details: isRunning ? {} : { missing_plugin_db: true } };
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
