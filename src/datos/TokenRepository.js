import db from './db.js';
import EncryptionService from '../servicios/EncryptionService.js';

/**
 * Repositorio de Tokens y Llaves de IA (PostgreSQL + Encryption)
 */
export default class TokenRepository {
  async getActiveKey(service) {
    const res = await db.query(
      'SELECT api_key_encriptada FROM tokens_ia WHERE servicio = $1 AND activo = TRUE',
      [service]
    );
    
    const encryptedKey = res.rows[0]?.api_key_encriptada;
    if (!encryptedKey) return null;

    // Desencriptar antes de retornar a la capa de servicios
    return EncryptionService.decrypt(encryptedKey);
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
      `INSERT INTO tokens_ia (servicio, api_key_encriptada, activo) 
       VALUES ($1, $2, TRUE) 
       ON CONFLICT (servicio) 
       DO UPDATE SET 
         api_key_encriptada = EXCLUDED.api_key_encriptada,
         activo = TRUE,
         fecha_actualizacion = NOW()
       RETURNING id`,
      [normalizedService, encryptedKey]
    );
    
    return res.rows[0];
  }

  async deactivateKey(id) {
    await db.query('UPDATE tokens_ia SET activo = FALSE WHERE id = $1', [id]);
    return true;
  }
}
