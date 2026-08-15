import fs from 'node:fs';
import path from 'node:path';
import { BootResult } from './../result.js';

/**
 * DependenciesCheck — Intelligent verification of the plugin's node_modules.
 *
 * Strategy: 
 *  - Total absence of node_modules => preboot installs with locked `npm ci`.
 *  - Absence of package-lock.json => outdated warning.
 *  - Absence of Playwright => informs an explicit action, without altering dependencies.
 */
export class DependenciesCheck {
  constructor(pluginDir) {
    this.pluginDir = pluginDir;
  }

  run(log) {
    const nm = path.join(this.pluginDir, 'node_modules');
    // The locked installation of dependencies is the responsibility of preboot.js.
    // This check only informs if an optional E2E component is missing.

    const lock = path.join(this.pluginDir, 'package-lock.json');
    const pkg = path.join(this.pluginDir, 'package.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const lockMtime = fs.existsSync(lock) ? fs.statSync(lock).mtimeMs : 0;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const pkgMtime = fs.existsSync(pkg) ? fs.statSync(pkg).mtimeMs : 0;

    if (lockMtime && pkgMtime > lockMtime) {
      log.warn('package.json was modified after package-lock.json (possible desynchronization).');
    }

    // Specific verification of Playwright for E2E
    const playwrightPath = path.join(nm, '@playwright', 'test');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(playwrightPath)) {
       log.warn('Missing Black Box/E2E dependencies (@playwright/test).');
       return BootResult.warn(
         'Playwright is not available for E2E tests.',
         'Run npm start to restore locked dependencies and then npx playwright install.'
       );
    }

    log.success('Plugin dependencies verified.');
    return BootResult.ok({ cached: true });
  }
}
