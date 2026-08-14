import { LinuxCertificateToolInstaller } from './LinuxCertificateToolInstaller.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getPluginDirectory } from '../../installation/utils/LocalWorkspacePaths.js';

export function toWindowsWslPath(linuxPath, distribution) {
  const normalized = linuxPath.trim();
  if (!normalized.startsWith('/') || !distribution) return null;
  return `\\\\wsl.localhost\\${distribution}${normalized.replaceAll('/', '\\')}`;
}

export class WslCertificateToolInstaller extends LinuxCertificateToolInstaller {
  constructor(dependencies) {
    super(dependencies);
    this.environment = dependencies.environment;
    this.trustStatePath = path.join(
      getPluginDirectory(), 'apps', 'server', 'certs', '.wsl-windows-trust-fingerprint'
    );
  }

  async ensureBrowserTrust() {
    const rootDirectory = await this._getRootDirectory();
    if (!rootDirectory) return false;
    const linuxRootCaPath = path.join(rootDirectory, 'rootCA.pem');
    if (this._isTrusted(linuxRootCaPath)) return true;
    const accepted = await this.confirm(
      'Windows can share its trust with browsers that use its certificate store. Do you want to trust only the public CA rootCA.pem?',
      false
    );
    if (!accepted) {
      this.boot.action('Import rootCA.pem into the Windows user\'s Trusted Root Certification Authorities.');
      return false;
    }
    const rootCaPath = toWindowsWslPath(linuxRootCaPath, this.environment.WSL_DISTRO_NAME);
    if (!rootCaPath) {
      this.boot.error('Could not get rootCA.pem for the Windows certificate store.');
      return false;
    }

    const spinner = this.spinnerFactory('Trusting the public CA for Windows...').start();
    const imported = await this.runner('certutil.exe', [
      '-user', '-addstore', 'Root', rootCaPath
    ]);
    if (imported.success) {
      this._saveTrustedFingerprint(linuxRootCaPath);
      spinner.success({ text: 'Public CA trusted for Windows user.', mark: '  √' });
      return true;
    }
    spinner.error({ text: 'Windows could not trust rootCA.pem.', mark: '  ×' });
    const detail = String(imported.err || imported.out || '').trim().split('\n').at(-1);
    if (detail) this.boot.debug(detail);
    return false;
  }

  async _getRootDirectory() {
    const root = await this.runner('mkcert', ['-CAROOT'], { captureAll: true });
    const directory = String(root.out || '').trim();
    if (root.success && directory) return directory;
    this.boot.error('Could not get the local CA directory from mkcert.');
    return null;
  }

  _isTrusted(rootCaPath) {
    try {
      const fingerprint = crypto.createHash('sha256').update(fs.readFileSync(rootCaPath)).digest('hex');
      return fs.readFileSync(this.trustStatePath, 'utf8').trim() === fingerprint;
    } catch {
      return false;
    }
  }

  _saveTrustedFingerprint(rootCaPath) {
    const fingerprint = crypto.createHash('sha256').update(fs.readFileSync(rootCaPath)).digest('hex');
    fs.mkdirSync(path.dirname(this.trustStatePath), { recursive: true });
    fs.writeFileSync(this.trustStatePath, `${fingerprint}\n`);
  }
}
