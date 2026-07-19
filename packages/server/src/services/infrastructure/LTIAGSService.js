import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import logger from '../../utils/logger.js';
import CanvasClient from './CanvasClient.js';


/**
 * Servicio de Integración con LTI AGS (Assignment and Grade Services)
 * Permite enviar calificaciones y comentarios a SpeedGrader sin API Keys individuales.
 */
export default class LTIAGSService {
  constructor(clientId, authUrl, privateKey = null, useLocalMode = false, canvasClient = null) {
    this.clientId = clientId;
    this.authUrl = authUrl || 'https://canvas.instructure.com/login/oauth2/token';
    this.privateKey = privateKey;
    this.useLocalMode = useLocalMode;
    this.canvasClient = canvasClient || new CanvasClient();
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  /**
   * Obtiene un token de acceso LTI Advantage (oauth2/token) usando Client Credentials y JWT
   */
  async getAccessToken() {
    // Si ya tenemos un token válido, lo reutilizamos
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (this.useLocalMode || !this.privateKey) {
      logger.debug('[LTI-AGS] Utilizando Access Token local (Modo Local)');
      this.accessToken = 'local-ags-token-12345';
      this.tokenExpiry = Date.now() + 3600 * 1000;
      return this.accessToken;
    }

    try {
      // Generar el Client Assertion JWT firmado con la clave privada RS256
      const payload = {
        iss: this.clientId,
        sub: this.clientId,
        aud: this.authUrl,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutos de expiración
        jti: randomBytes(16).toString('hex')
      };

      const signedAssertion = jwt.sign(payload, this.privateKey, {
        algorithm: 'RS256',
        keyid: process.env.LTI_KEY_ID || 'lti-key-1'
      });

      try {
        const response = await this.canvasClient.rawFetch(this.authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: signedAssertion,
            scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score'
          }),
          returnFullResponse: true,
          timeoutMs: 15000
        });

        if (!response.ok) {
          throw new Error(`Error en token LTI [${response.status}]: ${response.statusText}`);
        }

        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
        return this.accessToken;
      } catch (error) {
      logger.error('[LTI-AGS] Error obteniendo access token:', { error: error.message });
      throw new Error('No se pudo autenticar con LTI AGS de Canvas');
    }
  }

  /**
   * Envía la nota y comentarios a SpeedGrader usando AGS
   * @param {string} scoresUrl Endpoint de scores (generalmente viene en la claim de AGS del token launch)
   * @param {string} studentId ID del estudiante a evaluar
   * @param {number|string} score Nota asignada
   * @param {number|string} maxScore Nota máxima posible
   * @param {string} comment Comentario de feedback
   */
  async submitScoreAndComment(scoresUrl, studentId, score, maxScore, comment) {
    if (this.useLocalMode) {
      logger.debug(`[LTI-AGS] [LOCAL] Enviando nota a Canvas SpeedGrader:\n        URL: ${scoresUrl}\n        Estudiante: ${studentId}\n        Nota: ${score}/${maxScore}\n        Comentario: ${comment.substring(0, 60)}...`);
      return { success: true, message: 'Calificación de pruebas enviada exitosamente (Local)' };
    }

    try {
      const token = await this.getAccessToken();
      
      const payload = {
        userId: studentId,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        scoreGiven: parseFloat(score),
        scoreMaximum: parseFloat(maxScore),
        comment: comment
      };

      try {
        const response = await this.canvasClient.rawFetch(scoresUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/vnd.ims.lis.v1.score+json'
          },
          body: JSON.stringify(payload),
          returnFullResponse: true,
          timeoutMs: 15000
        });

        if (!response.ok) {
          throw new Error(`Error al enviar calificación [${response.status}]: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        }
        return {};
      } catch (error) {
      logger.error('[LTI-AGS] Error al publicar score en Canvas:', { error: error.message });
      throw error;
    }
  }
}
