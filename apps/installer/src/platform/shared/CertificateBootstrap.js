export class CertificateBootstrap {
  constructor({ boot, certificateGenerator, platformInstaller }) {
    this.boot = boot;
    this.certificateGenerator = certificateGenerator;
    this.platformInstaller = platformInstaller;
  }

  async ensure() {
    const certificatesReady = this.certificateGenerator.hasUsableCertificates?.() === true;
    if (!certificatesReady) {
      if (!(await this.platformInstaller.ensureTool())) return false;
      if (!(await this.platformInstaller.confirmCertificateAuthority())) {
        this.boot.warn('Local CA configuration for HTTPS was canceled.');
        return false;
      }
      if (!(await this.certificateGenerator.ensureCertificates())) {
        this.boot.error('Could not generate local HTTPS certificates.');
        return false;
      }
    }
    return this.platformInstaller.ensureBrowserTrust();
  }
}
