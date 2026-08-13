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
        this.boot.warn('Se canceló la configuración de la CA local para HTTPS.');
        return false;
      }
      if (!(await this.certificateGenerator.ensureCertificates())) {
        this.boot.error('No se pudieron generar los certificados HTTPS locales.');
        return false;
      }
    }
    return this.platformInstaller.ensureBrowserTrust();
  }
}
