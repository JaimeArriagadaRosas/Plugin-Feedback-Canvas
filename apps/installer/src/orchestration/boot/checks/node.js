import { execFileSync } from 'node:child_process';
import { BootResult } from './../result.js';

/**
 * NodeCheck — Verifica Node.js y NPM con validación de versión mínima.
 *
 * No reinstala nada (la instalación de Node es competencia de la capa Python
 * de setup). Solo detecta y reporta.
 */
const REQUIRED_NPM_VERSION = '11.8.0';

function parseVersion(version) {
  return version.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10));
}

export function isSupportedNode(version) {
  const [major, minor] = parseVersion(version);
  return (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
}

export class NodeCheck {
  constructor({ run } = {}) {
    this.runCommand = run || this._run;
  }

  _run(cmd, args, timeoutMs = 8000) {
    try {
      const out = execFileSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] });
      return out.toString().trim();
    } catch (e) {
      return '';
    }
  }

  run(log) {
    const nodeVer = this.runCommand('node', ['--version']);
    if (!nodeVer) {
      log.error('Node.js no encontrado.');
      log.action('Instale Node.js 20.19+ o 22.12+ desde https://nodejs.org.');
      return BootResult.fail(true, 'Node.js no instalado',
        'Instale Node.js 20.19+ o 22.12+ desde https://nodejs.org');
    }

    const npmVer = this.runCommand('npm', ['--version']);
    if (!isSupportedNode(nodeVer)) {
      log.error(`Node.js ${nodeVer} no cumple ^20.19.0 || >=22.12.0.`);
      return BootResult.fail(true, 'Versión de Node.js incompatible',
        `Actualice Node.js; la versión detectada es ${nodeVer}.`);
    }
    if (npmVer !== REQUIRED_NPM_VERSION) {
      log.warn(`npm ${npmVer || 'no disponible'} no coincide con packageManager npm@${REQUIRED_NPM_VERSION}.`);
      return BootResult.warn('npm global distinto al fijado por el monorepo',
        `Para instalaciones manuales use: npx --yes npm@${REQUIRED_NPM_VERSION} ci.`);
    }

    log.success(`Node.js ${nodeVer} compatible${npmVer ? ` · npm ${npmVer}` : ''}.`);
    return BootResult.ok({ nodeVer, npmVer });
  }
}
