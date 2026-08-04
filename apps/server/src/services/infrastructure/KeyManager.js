import crypto from 'crypto';
import { getEnvVar, updateEnvVars } from '../../orchestration/envWriter.js';

export default class KeyManager {
  /**
   * Garantiza que las claves de encriptación (ENCRYPTION_KEY, WEBHOOK_SECRET)
   * existan y sean criptográficamente seguras. Si no lo son, genera nuevas y 
   * las inyecta en el archivo .env automáticamente.
   * @param {string} pluginDir Directorio raíz donde se encuentra el .env
   * @param {object} log Interfaz de logging (opcional)
   */
  static ensureKeys(pluginDir, log) {
    const EXPECTED_KEY_HEX_LENGTH = 64; // 32 bytes en hex
    const keysToValidate = ['ENCRYPTION_KEY', 'WEBHOOK_SECRET', 'DEV_TOKEN_SECRET'];
    const keysToUpdate = {};
    let needsUpdate = false;

    for (const key of keysToValidate) {
      // Leer directamente desde el .env y variables de entorno
      // eslint-disable-next-line security/detect-object-injection
      const currentValue = process.env[key] || getEnvVar(pluginDir, key);
      
      // Validar si la clave es faltante o si es un placeholder (ej: "your_encryption_key_here")
      // o si su longitud es inválida.
      if (!currentValue || currentValue.length !== EXPECTED_KEY_HEX_LENGTH || currentValue.includes('your_')) {
        const newKey = crypto.randomBytes(32).toString('hex');
        // eslint-disable-next-line security/detect-object-injection
        keysToUpdate[key] = newKey;
        // eslint-disable-next-line security/detect-object-injection
        process.env[key] = newKey; // Actualizar la memoria también
        needsUpdate = true;
        
        if (log && log.warn) {
          log.warn(`Clave ${key} faltante, insegura o de longitud inválida. Se ha autogenerado una nueva clave.`);
        }
      }
    }

    if (needsUpdate) {
      process.env.KEYS_REGENERATED = 'true';
      updateEnvVars(pluginDir, keysToUpdate);
      if (log && log.success) {
        log.success('Claves criptográficas seguras guardadas en .env correctamente.');
      }
    } else {
      if (log && log.info) {
        log.info('Las claves criptográficas existentes (ENCRYPTION_KEY, WEBHOOK_SECRET) son válidas.');
      }
    }
  }
}
