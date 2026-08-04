import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from './utils/Runner.js';

export class PreflightChecks {
  constructor(boot, canvasDir, pluginDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
    this.pluginDir = pluginDir;
    this.MIN_RAM_GB = 8;
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
        this.boot.error(`[FAIL] ${check.name}`);
      } else {
        this.boot.success(`[OK] ${check.name}`);
      }
    }

    this.boot.info(`Verificación completada.`);
    return { allOk, missing };
  }

  async checkDocker() {
    const { success, out } = await runCommand('docker', ['info'], { captureAll: true });
    if (success) {
      return { ok: true, details: {} };
    }

    const { success: cliSuccess } = await runCommand('docker', ['--version']);
    if (cliSuccess) {
      return { ok: false, details: { docker_daemon_down: true } };
    }
    return { ok: false, details: { missing_docker: true } };
  }

  async checkDockerCompose() {
    const { success } = await runCommand('docker', ['compose', 'version']);
    return { ok: success, details: success ? {} : { missing_compose: true } };
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
    
    return { ok: true, details: {} };
  }

  async checkPluginDb() {
    if (process.env.KEYS_REGENERATED === 'true') {
      await runCommand('docker', ['compose', 'down', '-v'], { cwd: this.pluginDir });
      this.boot.plain('  · Primera instalación detectada: Volúmenes Docker purgados automáticamente (Dirty Volume Prevention)');
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
