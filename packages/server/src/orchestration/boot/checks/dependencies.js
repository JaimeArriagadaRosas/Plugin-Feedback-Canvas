import fs from 'node:fs';
import path from 'node:path';
import { BootResult } from './../result.js';

/**
 * DependenciesCheck — Verificación inteligente de node_modules del plugin.
 *
 * Estrategia: no reinstala nunca de forma ciega. Detecta:
 *  - Ausencia total de node_modules => requiere `npm install`.
 *  - Ausencia de package-lock.json (o desincronía con package.json) => advertencia de
 *    posible desactualización, pero NO reinstala para no romper un entorno funcional.
 *  - Presencia => reutiliza sin tocar disco.
 */
export class DependenciesCheck {
  constructor(pluginDir) {
    this.pluginDir = pluginDir;
  }

  run(log) {
    const nm = path.join(this.pluginDir, 'node_modules');
    if (!fs.existsSync(nm)) {
      log.warn('node_modules no encontrado.');
      log.action('Ejecute: npm install  (el orquestador lo hará si continúa).');
      return BootResult.fail(false, 'Faltan dependencias (node_modules)',
        'Ejecute `npm install` en la raíz del plugin.');
    }

    const lock = path.join(this.pluginDir, 'package-lock.json');
    const pkg = path.join(this.pluginDir, 'package.json');
    const lockMtime = fs.existsSync(lock) ? fs.statSync(lock).mtimeMs : 0;
    const pkgMtime = fs.existsSync(pkg) ? fs.statSync(pkg).mtimeMs : 0;

    if (lockMtime && pkgMtime > lockMtime) {
      log.warn('package.json fue modificado después del package-lock.json (posible desactualización).');
      return BootResult.warn('Dependencias posiblemente desactualizadas',
        'Ejecute `npm install` para sincronizar dependencias.');
    }

    // Verificación específica de Playwright para E2E
    const playwrightPath = path.join(nm, '@playwright', 'test');
    if (!fs.existsSync(playwrightPath)) {
       log.warn('Faltan dependencias de Caja Negra/E2E (@playwright/test).');
       return BootResult.warn('Falta Playwright para pruebas E2E',
         'Si usas la Opción 5, ejecuta `npm install` y luego `npx playwright install`.');
    }

    log.success('Dependencias del plugin instaladas (reutilizando node_modules).');
    return BootResult.ok({ cached: true });
  }
}
