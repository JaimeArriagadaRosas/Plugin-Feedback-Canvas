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
      'Chrome usa el almacén de Windows. ¿Desea confiar en Windows solo el certificado público rootCA.pem?',
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

    this.boot.info('Importando la CA pública de desarrollo en el almacén del usuario de Windows...');
    const imported = await this.interactiveRunner('certutil.exe', [
      '-user', '-addstore', 'Root', rootCaPath
    ]);
    if (imported) {
      this._saveTrustedFingerprint(linuxRootCaPath);
      return true;
    }
    this.boot.error('Windows no pudo confiar en rootCA.pem. El certificado no se importó automáticamente.');
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
