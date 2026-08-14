import fs from 'node:fs';
import path from 'node:path';
import { runDockerCommand } from '../../../platform/shared/dockerRunner.js';
import { BootResult } from './../result.js';

/**
 * CanvasCheck — Verifies the state of the Canvas LMS clone, its Ruby gems,
 * Yarn dependencies, compiled assets, translations (i18n) and database.
 *
 * Only DETECTS. Heavy installation/compilation is delegated to the
 * Python setup layer (verificar_entorno.py -> instalar_dependencias.py), which already
 * implements retries and diagnosis. Here we do not repeat work or assume
 * state: each check queries the container.
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

  /** Is Canvas running (active web container)? */
  async isRunning() {
    const r = await this._docker(['compose', 'ps', '-q', 'web']);
    return r.ok && r.out.length > 0;
  }

  async checkRubyGems() {
    const r = await this._docker(['compose', 'exec', '-T', 'web', 'bundle', 'check']);
    return r.ok;
  }

  async checkYarn() {
    // yarn check --verify-resolutions is expensive; it's enough that node_modules exists.
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
   * Executes all Canvas checks. It is not critical if they fail on a
   * first boot: the Python setup layer will resolve them. Reports the
   * missing subset for user information.
   */
  async run(log) {
    if (!this.isCloned()) {
      log.warn('Canvas LMS clone not found in the workspace.');
      log.action('The orchestrator will automatically clone Canvas LMS when choosing local mode.');
      return BootResult.warn('Canvas LMS not cloned',
        'Will be cloned automatically when starting in local mode (Docker).');
    }

    const running = await this.isRunning();
    if (!running) {
      log.warn('Canvas LMS is not running yet.');
      return BootResult.warn('Canvas LMS stopped',
        'The orchestrator will bring up the stack with `docker compose up -d`.');
    }

    const checks = [
      ['Ruby gems', () => this.checkRubyGems()],
      ['Yarn deps', () => this.checkYarn()],
      ['Compiled assets', () => this.checkAssets()],
      ['i18n translations', () => this.checkI18n()],
      ['Database', () => this.checkDb()],
    ];

    const missing = [];
    for (const [label, fn] of checks) {
      try {
        const ok = await fn();
        if (ok) log.success(label);
        else { missing.push(label); log.warn(`${label}: missing`); }
      } catch {
        missing.push(label);
        log.warn(`${label}: not verifiable`);
      }
    }

    if (missing.length === 0) {
      return BootResult.ok({ complete: true });
    }
    return BootResult.warn(`Partial Canvas LMS (missing: ${missing.join(', ')})`,
      'The setup layer will automatically compile/install what is missing.');
  }
}
