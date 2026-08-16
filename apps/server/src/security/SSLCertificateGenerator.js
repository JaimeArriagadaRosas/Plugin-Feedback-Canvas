import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import logger from '../utils/logger.js';
import { SSLConfig } from './SSLConfig.js';

const MINIMUM_VALIDITY_DAYS = 7;

export class SSLCertificateGenerator {
  static hasUsableCertificates() {
    const { CERT_PEM, CERT_KEY } = SSLConfig;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(CERT_PEM) || !fs.existsSync(CERT_KEY)) return false;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const certificate = new crypto.X509Certificate(fs.readFileSync(CERT_PEM));
      return this._getDaysRemaining(certificate) > MINIMUM_VALIDITY_DAYS;
    } catch {
      return false;
    }
  }

  static async ensureCertificates() {
    const environment = SSLConfig.getEnvironment();
    if (environment.isProduction) return false;

    if (this.hasUsableCertificates()) {
      logger.info('[SSL] The existing mkcert certificate is still valid.');
      return true;
    }

    this._logCertificateRenewalState();
    const temporaryPaths = this._getTemporaryCertificatePaths();
    try {
      this._prepareCertificatesDirectory();
      logger.info('[SSL] Running mkcert to configure local HTTPS...');
      execFileSync('mkcert', ['-install'], { stdio: 'ignore' });
      execFileSync('mkcert', [
        '-key-file', temporaryPaths.key,
        '-cert-file', temporaryPaths.certificate,
        'localhost', '127.0.0.1', 'host.docker.internal'
      ], { stdio: 'ignore' });
      this._replaceCertificates(temporaryPaths);
      logger.info('[SSL] New local certificates generated successfully.');
      return true;
    } catch (error) {
      logger.error('[SSL] mkcert is not available or failed.', { error: error.message });
      return false;
    } finally {
      this._removeTemporaryCertificates(temporaryPaths);
    }
  }

  static _logCertificateRenewalState() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(SSLConfig.CERT_PEM)) {
      logger.info('[SSL] Local certificates not found. They will be created now.');
      return;
    }
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const certificate = new crypto.X509Certificate(fs.readFileSync(SSLConfig.CERT_PEM));
      const days = this._getDaysRemaining(certificate);
      if (days <= 0) logger.info('[SSL] Local certificate expired. It will be regenerated.');
      else logger.info(`[SSL] Certificate will expire in ${Math.floor(days)} days. It will be regenerated.`);
    } catch (error) {
      logger.warn('[SSL] Local certificate is unreadable. It will be regenerated.', { error: error.message });
    }
  }

  static _prepareCertificatesDirectory() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.mkdirSync(path.dirname(SSLConfig.CERT_PEM), { recursive: true });
  }

  static _getTemporaryCertificatePaths() {
    const suffix = `.tmp-${process.pid}`;
    return {
      certificate: `${SSLConfig.CERT_PEM}${suffix}`,
      key: `${SSLConfig.CERT_KEY}${suffix}`
    };
  }

  static _replaceCertificates(temporaryPaths) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.rmSync(SSLConfig.CERT_PEM, { force: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.rmSync(SSLConfig.CERT_KEY, { force: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.renameSync(temporaryPaths.certificate, SSLConfig.CERT_PEM);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.renameSync(temporaryPaths.key, SSLConfig.CERT_KEY);
  }

  static _removeTemporaryCertificates(temporaryPaths) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.rmSync(temporaryPaths.certificate, { force: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.rmSync(temporaryPaths.key, { force: true });
  }

  static _getDaysRemaining(certificate) {
    return (new Date(certificate.validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  }
}
