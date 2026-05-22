import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { AppError } from '../middlewares/ErrorHandler.js';

/**
 * Servicio de Validación de Tokens LTI 1.3
 */
export default class LTITokenService {
  constructor() {
    this.client = jwksClient({
      jwksUri: 'https://canvas.instructure.com/api/lti/security/jwks' // URI estándar de Canvas
    });
  }

  /**
   * Obtiene la clave pública de Canvas para verificar la firma
   */
  async getPublicKey(header) {
    return new Promise((resolve, reject) => {
      this.client.getSigningKey(header.kid, (err, key) => {
        if (err) reject(err);
        else resolve(key.getPublicKey());
      });
    });
  }

  /**
   * Verifica un ID Token LTI 1.3
   */
  async verifyToken(token) {
    try {
      const decodedHeader = jwt.decode(token, { complete: true })?.header;
      if (!decodedHeader) throw new AppError('Token mal formado', 401);

      const publicKey = await this.getPublicKey(decodedHeader);
      
      return jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        audience: process.env.LTI_CLIENT_ID,
        issuer: 'https://canvas.instructure.com'
      });
    } catch (error) {
      console.error('[LTI] Error de verificación:', error.message);
      throw new AppError('Error verificando token LTI 1.3', 401);
    }
  }
}
