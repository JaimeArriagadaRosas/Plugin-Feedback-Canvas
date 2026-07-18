import db from './db.js';
import EncryptionService from '../services/infrastructure/EncryptionService.js';

/**
 * Repositorio de Tokens y Llaves de IA (PostgreSQL + Encryption)
 */
export default class TokenRepository {
  async getActiveKey(service) {
    const res = await db.query(
      'SELECT api_key_encriptada FROM Llaves_API_IA WHERE servicio = $1 AND activo = TRUE',
      [service]
    );
    
    const encryptedKey = res.rows[0]?.api_key_encriptada;
    if (!encryptedKey) return null;

    // Desencriptar antes de retornar a la capa de servicios
    return EncryptionService.decrypt(encryptedKey);
  }

  async hasActiveKey(service) {
    const res = await db.query(
      'SELECT id FROM Llaves_API_IA WHERE servicio = $1 AND activo = TRUE',
      [service]
    );
    return res.rowCount > 0;
  }

  async registerKey(service, plainKey) {
    // Validar servicio
    const validServices = ['openai', 'claude', 'gemini'];
    if (!validServices.includes(service.toLowerCase())) {
      throw new Error(`Servicio no soportado: ${service}`);
    }

    const normalizedService = service.toLowerCase();
    
    // Encriptar antes de guardar en la DB
    const encryptedKey = EncryptionService.encrypt(plainKey);
    
    // Usar UPSERT: insertar o actualizar si ya existe
    const res = await db.query(
      `INSERT INTO Llaves_API_IA (servicio, api_key_encriptada, activo) 
       VALUES ($1, $2, TRUE) 
       ON CONFLICT (servicio) 
       DO UPDATE SET 
         api_key_encriptada = EXCLUDED.api_key_encriptada,
         activo = TRUE,
         ultima_verificacion = NOW()
       RETURNING id`,
      [normalizedService, encryptedKey]
    );
    
    return res.rows[0];
  }

  async deactivateKey(id) {
    await db.query('UPDATE Llaves_API_IA SET activo = FALSE WHERE id = $1', [id]);
    return true;
  }
}
