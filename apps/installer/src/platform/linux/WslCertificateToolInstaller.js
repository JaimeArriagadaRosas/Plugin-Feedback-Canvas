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
      'Windows puede compartir su confianza con los navegadores que usan su almacén de certificados. ¿Desea confiar solo en la CA pública rootCA.pem?',
      false
    );
    if (!accepted) {
      this.boot.action('Importe rootCA.pem en Trusted Root Certification Authorities del usuario de Windows.');
      return false;
    }
    const rootCaPath = toWindowsWslPath(linuxRootCaPath, this.environment.WSL_DISTRO_NAME);
    if (!rootCaPath) {
      this.boot.error('No se pudo obtener rootCA.pem para el almacén de certificados de Windows.');
      return false;
    }

    const spinner = this.spinnerFactory('Confiando en la CA pública para Windows...').start();
    const imported = await this.runner('certutil.exe', [
      '-user', '-addstore', 'Root', rootCaPath
    ]);
    if (imported.success) {
      this._saveTrustedFingerprint(linuxRootCaPath);
      spinner.success({ text: 'CA pública confiada en el usuario de Windows.', mark: '  √' });
      return true;
    }
    spinner.error({ text: 'Windows no pudo confiar en rootCA.pem.', mark: '  ×' });
    const detail = String(imported.err || imported.out || '').trim().split('\n').at(-1);
    if (detail) this.boot.debug(detail);
    return false;
  }

  async _getRootDirectory() {
    const root = await this.runner('mkcert', ['-CAROOT'], { captureAll: true });
    const directory = String(root.out || '').trim();
    if (root.success && directory) return directory;
    this.boot.error('No se pudo obtener el directorio de la CA local de mkcert.');
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
