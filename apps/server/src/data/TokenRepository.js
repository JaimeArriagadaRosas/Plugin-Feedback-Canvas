import db from './db.js';
import EncryptionService from '../services/infrastructure/EncryptionService.js';

/**
 * Repositorio de Tokens y Llaves de IA (PostgreSQL + Encryption)
 */
export default class TokenRepository {
  async getActiveKey(service) {
    const res = await db.query(
      'SELECT api_key_encriptada, endpoint_personalizado FROM Llaves_API_IA WHERE servicio = $1 AND activo = TRUE',
      [service]
    );
    
    const row = res.rows[0];
    if (!row || !row.api_key_encriptada) return null;

    // Desencriptar antes de retornar a la capa de servicios
    return {
      apiKey: EncryptionService.decrypt(row.api_key_encriptada),
      customEndpoint: row.endpoint_personalizado
    };
  }

  async hasActiveKey(service) {
    const res = await db.query(
      'SELECT id FROM Llaves_API_IA WHERE servicio = $1 AND activo = TRUE',
      [service]
    );
    return res.rowCount > 0;
  }

  async registerKey(service, plainKey, customEndpoint = null) {
    // Validar servicio
    const validServices = ['openai', 'claude', 'gemini', 'custom', 'otros'];
    if (!validServices.includes(service.toLowerCase())) {
      throw new Error(`Servicio no soportado: ${service}`);
    }

    const normalizedService = service.toLowerCase();
    
    // Encriptar antes de guardar en la DB
    const encryptedKey = EncryptionService.encrypt(plainKey);
    
    // Usar UPSERT: insertar o actualizar si ya existe
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
      'SELECT servicio FROM Llaves_API_IA WHERE activo = TRUE'
    );
    return res.rows.map(row => row.servicio);
  }
}
