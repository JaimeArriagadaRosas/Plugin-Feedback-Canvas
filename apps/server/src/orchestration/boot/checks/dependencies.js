import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BootResult } from './../result.js';

/**
 * DependenciesCheck — Verificación inteligente de node_modules del plugin.
 *
 * Estrategia: 
 *  - Ausencia total de node_modules => auto-instala con `npm install`.
 *  - Ausencia de package-lock.json => advertencia de desactualización.
 *  - Ausencia de Playwright => auto-instala binarios con `npx playwright install`.
 */
export class DependenciesCheck {
  constructor(pluginDir) {
    this.pluginDir = pluginDir;
  }

  run(log) {
    const nm = path.join(this.pluginDir, 'node_modules');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(nm)) {
      log.warn('node_modules no encontrado. Instalando dependencias (esto puede tardar unos minutos)...');
      try {
        execSync('npm install', { cwd: this.pluginDir, stdio: 'inherit' });
        log.success('Dependencias instaladas correctamente.');
      } catch (err) {
        return BootResult.fail(false, 'Fallo la instalación de dependencias (npm install)', err.message);
      }
    }

    const lock = path.join(this.pluginDir, 'package-lock.json');
    const pkg = path.join(this.pluginDir, 'package.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const lockMtime = fs.existsSync(lock) ? fs.statSync(lock).mtimeMs : 0;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const pkgMtime = fs.existsSync(pkg) ? fs.statSync(pkg).mtimeMs : 0;

    if (lockMtime && pkgMtime > lockMtime) {
      log.warn('package.json fue modificado después del package-lock.json (posible desactualización).');
    }

    // Verificación específica de Playwright para E2E
    const playwrightPath = path.join(nm, '@playwright', 'test');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(playwrightPath)) {
       log.warn('Faltan dependencias de Caja Negra/E2E (@playwright/test). Autoinstalando...');
       try {
         execSync('npm install', { cwd: this.pluginDir, stdio: 'ignore' });
         log.info('Instalando binarios de Playwright...');
         execSync('npx playwright install', { cwd: this.pluginDir, stdio: 'inherit' });
         log.success('Playwright instalado correctamente.');
       } catch (err) {
         log.warn('Falló la instalación automática de Playwright: ' + err.message);
       }
    }

    log.success('Dependencias del plugin verificadas.');
    return BootResult.ok({ cached: true });
  }
}
