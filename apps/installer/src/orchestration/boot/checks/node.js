import { execFileSync } from 'node:child_process';
import { BootResult } from './../result.js';

/**
 * NodeCheck — Verifies Node.js and NPM with minimum version validation.
 *
 * Does not reinstall anything (Node installation is handled by the Python layer
 * setup). It only detects and reports.
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
      log.error('Node.js not found.');
      log.action('Install Node.js 20.19+ or 22.12+ from https://nodejs.org.');
      return BootResult.fail(true, 'Node.js not installed',
        'Install Node.js 20.19+ or 22.12+ from https://nodejs.org');
    }

    const npmVer = this.runCommand('npm', ['--version']);
    if (!isSupportedNode(nodeVer)) {
      log.error(`Node.js ${nodeVer} does not meet ^20.19.0 || >=22.12.0.`);
      return BootResult.fail(true, 'Incompatible Node.js version',
        `Update Node.js; the detected version is ${nodeVer}.`);
    }
    if (npmVer !== REQUIRED_NPM_VERSION) {
      log.warn(`npm ${npmVer || 'not available'} does not match packageManager npm@${REQUIRED_NPM_VERSION}.`);
      return BootResult.warn('global npm different from the one set by the monorepo',
        `For manual installations use: npx --yes npm@${REQUIRED_NPM_VERSION} ci.`);
    }

    log.success(`Node.js ${nodeVer} compatible${npmVer ? ` · npm ${npmVer}` : ''}.`);
    return BootResult.ok({ nodeVer, npmVer });
  }
}
