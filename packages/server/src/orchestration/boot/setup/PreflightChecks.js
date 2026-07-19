import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from './utils/Runner.js';
import { createSpinner } from 'nanospinner';

export class PreflightChecks {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
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
      { name: 'Canvas Assets', fn: () => this.checkCanvasAssets() }
    ];

    const missing = {};
    let allOk = true;

    for (let i = 0; i < checks.length; i++) {
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

    this.boot.info(`Verificación completada. allOk=${allOk}`);
    return { allOk, missing };
  }

  async checkDocker() {
    const { success, out } = await runCommand('docker', ['info']);
    if (success) {
      const { success: memSuccess, out: memOut } = await runCommand('docker', ['info', '--format', '{{.MemTotal}}']);
      if (memSuccess) {
        const memBytes = parseInt(memOut.trim(), 10);
        if (!isNaN(memBytes)) {
          const memGb = memBytes / (1024 ** 3);
          if (memGb < this.MIN_RAM_GB) {
            this.boot.warn(`Docker en ejecución, pero solo tiene ${memGb.toFixed(1)}GB RAM asignados (Recomendado: 8GB+)`);
          }
        }
      }
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
    const exists = fs.existsSync(composeFile);
    return { ok: exists, details: exists ? {} : { missing_canvas_clone: true } };
  }

  async checkCanvasAssets() {
    const composeFile = path.join(this.canvasDir, 'docker-compose.yml');
    if (!fs.existsSync(composeFile)) return { ok: true, details: {} };

    const manifestDev = path.join(this.canvasDir, 'public', 'dist', 'webpack-dev', 'webpack-manifest.json');
    const manifestProd = path.join(this.canvasDir, 'public', 'dist', 'webpack-manifest.json');

    const exists = fs.existsSync(manifestDev) || fs.existsSync(manifestProd);
    return { ok: exists, details: exists ? {} : { missing_canvas_assets: true } };
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
