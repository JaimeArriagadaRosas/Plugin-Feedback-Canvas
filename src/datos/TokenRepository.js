import db from './db.js';
import EncryptionService from '../servicios/EncryptionService.js';

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

  async registerKey(service, plainKey) {
    // Validar servicio
    const validServices = ['openai', 'claude', 'gemini'];
    if (!validServices.includes(service.toLowerCase())) {
      throw new Error(`Servicio no soportado: ${service}`);
    }

    const normalizedService = service.toLowerCase();
    
    // Encriptar antes de guardar en la DB
    const encryptedKey = EncryptionService.encrypt(plainKey);
    
    // Consultar si la llave ya existe para el servicio dado que no hay índice único
    const existing = await db.query(
      'SELECT id FROM Llaves_API_IA WHERE servicio = $1',
      [normalizedService]
    );

    let res;
    if (existing.rows.length > 0) {
      res = await db.query(
        `UPDATE Llaves_API_IA 
         SET api_key_encriptada = $1, activo = TRUE, ultima_verificacion = NOW() 
         WHERE servicio = $2 
         RETURNING id`,
        [encryptedKey, normalizedService]
      );
    } else {
      res = await db.query(
        `INSERT INTO Llaves_API_IA (servicio, api_key_encriptada, activo, ultima_verificacion) 
         VALUES ($1, $2, TRUE, NOW()) 
         RETURNING id`,
        [normalizedService, encryptedKey]
      );
    }
    
    return res.rows[0];
  }

  async deactivateKey(id) {
    await db.query('UPDATE Llaves_API_IA SET activo = FALSE WHERE id = $1', [id]);
    return true;
  }
}
