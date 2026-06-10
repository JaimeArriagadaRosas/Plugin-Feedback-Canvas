import crypto from 'crypto';
import LTITokenService from '../servicios/LTITokenService.js';

/**
 * Controlador de Autenticación LTI 1.3 Advantage
 */
export default class LTIController {
  constructor() {
    this.ltiService = new LTITokenService();
  }

  /**
   * Inicio de Login OIDC LTI 1.3
   */
  async loginInitiation(req, res, next) {
    try {
      const {
        iss,
        login_hint,
        target_link_uri,
        lti_message_hint,
        client_id
      } = req.query || req.body;

      if (!iss || !login_hint || !target_link_uri) {
        const error = new Error('Parámetros de login LTI faltantes (iss, login_hint, target_link_uri)');
        error.statusCode = 400;
        return next(error);
      }

      // En un entorno de Canvas estándar, el endpoint de autorización suele ser:
      // [iss]/api/lti/authorize_redirect o una URL específica de Canvas
      const authEndpoint = `${iss}/api/lti/authorize_redirect`;

      // Generar state y nonce seguros para la sesión
      const state = crypto.randomBytes(16).toString('hex');
      const nonce = crypto.randomBytes(16).toString('hex');

      // Almacenar state/nonce en cookies para validarlos en la ruta de launch
      res.cookie('lti_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'None' });
      res.cookie('lti_nonce', nonce, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'None' });

      // Construir la URL de autorización OIDC
      const authUrl = new URL(authEndpoint);
      authUrl.searchParams.append('scope', 'openid');
      authUrl.searchParams.append('response_type', 'id_token');
      authUrl.searchParams.append('response_mode', 'form_post');
      authUrl.searchParams.append('prompt', 'none');
      authUrl.searchParams.append('client_id', client_id || process.env.LTI_CLIENT_ID);
      authUrl.searchParams.append('redirect_uri', target_link_uri);
      authUrl.searchParams.append('login_hint', login_hint);
      if (lti_message_hint) {
        authUrl.searchParams.append('lti_message_hint', lti_message_hint);
      }
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('nonce', nonce);

      // Redireccionar al usuario a Canvas
      return res.redirect(authUrl.toString());
    } catch (error) {
      next(error);
    }
  }

  /**
   * Recepción del ID Token LTI (Launch)
   */
  async launch(req, res, next) {
    try {
      const { id_token, state } = req.body;

      if (!id_token) {
        const error = new Error('Lanzamiento no válido: falta id_token');
        error.statusCode = 400;
        return next(error);
      }

      // Validar el state para mitigar ataques CSRF
      const cookieState = req.cookies?.lti_state;
      if (cookieState && state !== cookieState) {
        const error = new Error('Validación de estado CSRF fallida');
        error.statusCode = 400;
        return next(error);
      }

      // Verificar y decodificar el token con el servicio de firma JWKS
      const decodedToken = await this.ltiService.verifyToken(id_token);

      // Limpiar cookies de estado/nonce temporales
      res.clearCookie('lti_state');
      res.clearCookie('lti_nonce');

      // Guardar el token LTI verificado en una cookie persistente de sesión
      res.cookie('lti_token', id_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'None',
        maxAge: 3600 * 1000 // 1 hora de validez
      });

      // Redirigir al frontend del plugin pasándole el ID de la tarea y curso como query
      const courseId = decodedToken['https://purl.imsglobal.org/spec/lti/claim/context']?.id;
      const assignmentId = decodedToken['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.id;
      
      const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}?courseId=${courseId}&assignmentId=${assignmentId}`);
    } catch (error) {
      next(error);
    }
  }
}
