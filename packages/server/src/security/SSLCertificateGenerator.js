import fs from 'node:fs';
import crypto from 'node:crypto';
import logger from '../utils/logger.js';
import { SSLConfig } from './SSLConfig.js';

export class SSLCertificateGenerator {
  /**
   * Intenta generar certificados mkcert si el binario está disponible.
   * Realiza una validación profunda para comprobar que no hayan caducado.
   * @returns {Promise<boolean>}
   */
  static async ensureCertificates() {
    const env = SSLConfig.getEnvironment();

    if (env.isProduction) {
      return false; // Producción no usa mkcert
    }

    const { CERT_PEM, CERT_KEY } = SSLConfig;
    const certsExist = fs.existsSync(CERT_PEM) && fs.existsSync(CERT_KEY);
    let needsGeneration = true;

    if (certsExist) {
      try {
        const certBuffer = fs.readFileSync(CERT_PEM);
        const cert = new crypto.X509Certificate(certBuffer);
        const validTo = new Date(cert.validTo).getTime();
        const now = Date.now();
        const daysRemaining = (validTo - now) / (1000 * 60 * 60 * 24);

        if (daysRemaining > 7) {
          logger.info('[SSLGenerator] ✅ El certificado actual es válido y aceptable.', { 
            daysRemaining: Math.floor(daysRemaining) 
          });
          needsGeneration = false;
        } else if (daysRemaining <= 0) {
          logger.info('[SSLGenerator] ❌ El certificado actual ha expirado. Iniciando regeneración automática...');
        } else {
          logger.info(`[SSLGenerator] ⚠️ El certificado expirará en ${Math.floor(daysRemaining)} días. Iniciando regeneración preventiva...`);
        }
      } catch (err) {
        logger.warn('[SSLGenerator] ❌ El certificado actual está corrupto o es ilegible. Regenerando...', { error: err.message });
      }
    } else {
      logger.info('[SSLGenerator] 🔍 No se encontraron certificados locales. Iniciando creación automática...');
    }

    if (!needsGeneration) {
      return true;
    }

    // Proceso de Generación / Regeneración
    try {
      const { execSync } = await import('node:child_process');
      
      // Limpiar certificados obsoletos si existen
      if (fs.existsSync(CERT_PEM)) fs.unlinkSync(CERT_PEM);
      if (fs.existsSync(CERT_KEY)) fs.unlinkSync(CERT_KEY);

      logger.info('[SSLGenerator] ⏳ Ejecutando mkcert (Presta atención, Windows podría pedirte permisos de Administrador para confiar en la Autoridad Raíz)...');
      execSync('mkcert -install', { stdio: 'inherit' });
      execSync(`mkcert -key-file "${CERT_KEY}" -cert-file "${CERT_PEM}" localhost 127.0.0.1 host.docker.internal`, {
        stdio: 'ignore'
      });
      
      logger.info('[SSLGenerator] ✨ Nuevos certificados generados exitosamente con mkcert.');
      return true;
    } catch (e) {
      logger.error('[SSLGenerator] 🚨 mkcert no está disponible o falló. Revise si tiene mkcert instalado en su PATH.', { error: e.message });
      return false;
    }
  }
}
