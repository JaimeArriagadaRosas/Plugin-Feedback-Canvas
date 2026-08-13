import fs from 'node:fs';
import path from 'node:path';
import { BootResult } from './../result.js';

/**
 * DependenciesCheck — Verificación inteligente de node_modules del plugin.
 *
 * Estrategia: 
 *  - Ausencia total de node_modules => preboot instala con `npm ci` bloqueado.
 *  - Ausencia de package-lock.json => advertencia de desactualización.
 *  - Ausencia de Playwright => informa una accion explicita, sin alterar dependencias.
 */
export class DependenciesCheck {
  constructor(pluginDir) {
    this.pluginDir = pluginDir;
  }

  run(log) {
    const nm = path.join(this.pluginDir, 'node_modules');
    // La instalacion bloqueada de dependencias es responsabilidad de preboot.js.
    // Este check solo informa si falta un componente opcional de E2E.

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
       log.warn('Faltan dependencias de Caja Negra/E2E (@playwright/test).');
       return BootResult.warn(
         'Playwright no esta disponible para las pruebas E2E.',
         'Ejecute npm start para restaurar dependencias bloqueadas y despues npx playwright install.'
       );
    }

    log.success('Dependencias del plugin verificadas.');
    return BootResult.ok({ cached: true });
  }
}
