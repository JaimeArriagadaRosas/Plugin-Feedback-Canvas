import { execFileSync } from 'node:child_process';
import { BootResult } from './../result.js';

/**
 * NodeCheck — Verifica Node.js y NPM con validación de versión mínima.
 *
 * No reinstala nada (la instalación de Node es competencia de la capa Python
 * de setup). Solo detecta y reporta.
 */
const MIN_NODE_MAJOR = 18;

export class NodeCheck {
  _run(cmd, args, timeoutMs = 8000) {
    try {
      const out = execFileSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] });
      return out.toString().trim();
    } catch (e) {
      return '';
    }
  }

  run(log) {
    const nodeVer = this._run('node', ['--version']);
    if (!nodeVer) {
      log.error('Node.js no encontrado.');
      log.action('Instale Node.js 18+ (https://nodejs.org) o ejecute el instalador del orquestador.');
      return BootResult.fail(true, 'Node.js no instalado',
        'Instale Node.js 18+ desde https://nodejs.org');
    }

    const major = parseInt(nodeVer.replace(/^v/, ''), 10);
    const npmVer = this._run('npm', ['--version']);
    if (major < MIN_NODE_MAJOR) {
      log.warn(`Node.js ${nodeVer} es más antiguo que ${MIN_NODE_MAJOR}+ recomendado.`);
      return BootResult.warn('Node.js desactualizado',
        `Actualice a Node.js ${MIN_NODE_MAJOR}+ (tiene ${nodeVer}).`);
    }

    log.success(`Node.js ${nodeVer} compatible${npmVer ? ` · npm ${npmVer}` : ''}.`);
    return BootResult.ok({ nodeVer, npmVer, major });
  }
}
