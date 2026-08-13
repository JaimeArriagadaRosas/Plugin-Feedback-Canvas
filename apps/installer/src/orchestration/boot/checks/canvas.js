import fs from 'node:fs';
import path from 'node:path';
import { runDockerCommand } from '../../../platform/shared/dockerRunner.js';
import { BootResult } from './../result.js';

/**
 * CanvasCheck — Verifica el estado del clon de Canvas LMS, sus Ruby gems,
 * dependencias Yarn, assets compilados, traducciones (i18n) y base de datos.
 *
 * Solo DETECTA. La instalación/compilación pesada queda delegada a la capa
 * Python de setup (verificar_entorno.py -> instalar_dependencias.py), que ya
 * implementa reintentos y diagnóstico. Aquí no repetimos work ni asumimos
 * estado: cada chequeo consulta al contenedor.
 */
export class CanvasCheck {
  constructor(canvasDir) {
    this.canvasDir = canvasDir;
  }

  async _docker(args) {
    try {
      const { stdout } = await runDockerCommand(args, { cwd: this.canvasDir });
      return { ok: true, out: stdout.trim() };
    } catch (e) {
      return { ok: false, out: '', err: e.message };
    }
  }

  isCloned() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync(path.join(this.canvasDir, 'docker-compose.yml'));
  }

  /** ¿Canvas está corriendo (contenedor web activo)? */
  async isRunning() {
    const r = await this._docker(['compose', 'ps', '-q', 'web']);
    return r.ok && r.out.length > 0;
  }

  async checkRubyGems() {
    const r = await this._docker(['compose', 'exec', '-T', 'web', 'bundle', 'check']);
    return r.ok;
  }

  async checkYarn() {
    // yarn check --verify-resolutions es caro; basta con que node_modules exista.
    const r = await this._docker(['compose', 'exec', '-T', 'web', 'test', '-d', 'node_modules']);
    return r.ok;
  }

  async checkAssets() {
    const dev = path.join(this.canvasDir, 'public', 'dist', 'webpack-dev', 'webpack-manifest.json');
    const prod = path.join(this.canvasDir, 'public', 'dist', 'webpack-manifest.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync(dev) || fs.existsSync(prod);
  }

  async checkI18n() {
    const r = await this._docker(['compose', 'exec', '-T', 'web', 'test', '-f', 'public/javascripts/translations/en.js']);
    return r.ok;
  }

  async checkDb() {
    const r = await this._docker(['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'db:version']);
    return r.ok && /\d+/.test(r.out);
  }

  /**
   * Ejecuta todos los chequeos de Canvas. No es crítico que fallen en un
   * primer arranque: la capa Python de setup los resolverá. Reporta el
   * subconjunto faltante para información del usuario.
   */
  async run(log) {
    if (!this.isCloned()) {
      log.warn('Clon de Canvas LMS no encontrado en el workspace.');
      log.action('El orquestador clonará Canvas LMS automáticamente al elegir el modo local.');
      return BootResult.warn('Canvas LMS no clonado',
        'Se clonará automáticamente al iniciar en modo local (Docker).');
    }

    const running = await this.isRunning();
    if (!running) {
      log.warn('Canvas LMS no está corriendo todavía.');
      return BootResult.warn('Canvas LMS detenido',
        'El orquestador levantará el stack con `docker compose up -d`.');
    }

    const checks = [
      ['Ruby gems', () => this.checkRubyGems()],
      ['Yarn deps', () => this.checkYarn()],
      ['Assets compilados', () => this.checkAssets()],
      ['Traducciones i18n', () => this.checkI18n()],
      ['Base de datos', () => this.checkDb()],
    ];

    const missing = [];
    for (const [label, fn] of checks) {
      try {
        const ok = await fn();
        if (ok) log.success(label);
        else { missing.push(label); log.warn(`${label}: faltante`); }
      } catch {
        missing.push(label);
        log.warn(`${label}: no verificable`);
      }
    }

    if (missing.length === 0) {
      return BootResult.ok({ complete: true });
    }
    return BootResult.warn(`Canvas LMS parcial (faltan: ${missing.join(', ')})`,
      'La capa de setup compilará/instalará lo faltante automáticamente.');
  }
}
