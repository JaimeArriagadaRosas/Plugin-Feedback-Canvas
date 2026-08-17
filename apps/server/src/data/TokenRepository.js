import db from './db.js';
import EncryptionService from '../services/infrastructure/EncryptionService.js';

/**
 * Token and AI Key Repository (PostgreSQL + Encryption)
 */
export default class TokenRepository {
  async getActiveKey(service, quiet = false) {
    const res = await db.query(
      'SELECT api_key_encriptada, endpoint_personalizado FROM Llaves_API_IA WHERE servicio = $1 AND activo = TRUE',
      [service]
    );
    
    const row = res.rows[0];
    if (!row || !row.api_key_encriptada) return null;

    // Safely decrypt before returning
    const apiKey = EncryptionService.safeDecrypt(row.api_key_encriptada, `API Key IA (Uso) ${service}`, quiet);
    if (!apiKey) return null;

    return {
      apiKey,
      customEndpoint: row.endpoint_personalizado
    };
  }

  async hasActiveKey(service) {
    const keyInfo = await this.getActiveKey(service);
    return keyInfo !== null;
  }

  async registerKey(service, plainKey, customEndpoint = null) {
    // Validate service
    const validServices = ['openai', 'claude', 'gemini', 'custom', 'otros'];
    if (!validServices.includes(service.toLowerCase())) {
      throw new Error(`Unsupported service: ${service}`);
    }

    const normalizedService = service.toLowerCase();
    
    // Encrypt before saving to DB
    const encryptedKey = EncryptionService.encrypt(plainKey);
    
    // Use UPSERT: insert or update if already exists
    const res = await db.query(
      `INSERT INTO Llaves_API_IA (servicio, api_key_encriptada, endpoint_personalizado, activo) 
       VALUES ($1, $2, $3, TRUE) 
       ON CONFLICT (servicio) 
       DO UPDATE SET 
         api_key_encriptada = EXCLUDED.api_key_encriptada,
         endpoint_personalizado = EXCLUDED.endpoint_personalizado,
         activo = TRUE,
         ultima_verificacion = NOW()
       RETURNING id`,
      [normalizedService, encryptedKey, customEndpoint]
    );
    
    return res.rows[0];
  }

  async deactivateKey(id) {
    await db.query('UPDATE Llaves_API_IA SET activo = FALSE WHERE id = $1', [id]);
    return true;
  }

  async getAllActiveServices() {
    const res = await db.query(
      'SELECT servicio, api_key_encriptada FROM Llaves_API_IA WHERE activo = TRUE'
    );
    const validServices = [];
    for (const row of res.rows) {
      const decrypted = EncryptionService.safeDecrypt(row.api_key_encriptada, `API Key IA ${row.servicio}`);
      if (decrypted) {
        validServices.push(row.servicio);
      }
    }
    return validServices;
  }
}
