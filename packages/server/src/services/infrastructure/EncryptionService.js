import crypto from 'crypto';
import dotenv from 'dotenv';
import { getSecret } from '../../config/secrets.js';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
// B6 FIX: NIST SP 800-38D recomienda IV de 12 bytes (96 bits) para AES-GCM.
// Con 16 bytes funciona pero es subóptimo (requiere operaciones GHASH adicionales).
const IV_LENGTH = 12;
const EXPECTED_KEY_HEX_LENGTH = 64;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  
  const KEY_HEX = getSecret('ENCRYPTION_KEY');
  if (!KEY_HEX || KEY_HEX.length !== EXPECTED_KEY_HEX_LENGTH) {
    throw new Error(`ENCRYPTION_KEY es requerida y debe tener ${EXPECTED_KEY_HEX_LENGTH} caracteres (hex). El KeyManager debería haberla generado. Recibido: ${KEY_HEX ? KEY_HEX.length : 0}`);
  }

  try {
    const KEY = Buffer.from(KEY_HEX, 'hex');
    if (KEY.length !== 32) throw new Error('Longitud de buffer incorrecta');
    cachedKey = KEY;
    return cachedKey;
  } catch (e) {
    throw new Error('ENCRYPTION_KEY contiene caracteres hexadecimales inválidos.');
  }
}

/**
 * Servicio de Encriptación (AES-256-GCM)
 * Asegura que las credenciales de API no se almacenen en texto plano.
 */
export default class EncryptionService {
  /**
   * Encripta un texto plano
   */
  static encrypt(text) {
    const KEY = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Retornamos IV + Tag + Texto Encriptado
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Desencripta un texto cifrado
   */
  static decrypt(encryptedData) {
    try {
      const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const KEY = getKey();
      const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Fallo al desencriptar los datos. La clave puede ser incorrecta o los datos estar corruptos.');
    }
  }
}
