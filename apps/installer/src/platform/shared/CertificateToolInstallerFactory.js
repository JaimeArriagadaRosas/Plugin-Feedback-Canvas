import { LinuxCertificateToolInstaller } from '../linux/LinuxCertificateToolInstaller.js';
import { WslCertificateToolInstaller } from '../linux/WslCertificateToolInstaller.js';
import { WindowsCertificateToolInstaller } from '../windows/WindowsCertificateToolInstaller.js';

export function createCertificateToolInstaller(platform, dependencies) {
  if (platform === 'win32') return new WindowsCertificateToolInstaller(dependencies);
  if (platform === 'linux' && dependencies.environment.WSL_DISTRO_NAME) {
    return new WslCertificateToolInstaller(dependencies);
  }
  if (platform === 'linux') return new LinuxCertificateToolInstaller(dependencies);
  throw new Error(`La instalación automática de certificados no está disponible para ${platform}.`);
}
