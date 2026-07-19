import { getEnv, getCanvasEnv } from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import CanvasClient from '../services/infrastructure/CanvasClient.js';

export default class CanvasOAuthController {
  constructor(canvasTokenRepo, canvasClient) {
    this.canvasTokenRepo = canvasTokenRepo;
    this.canvasClient = canvasClient || new CanvasClient();
  }

  /**
   * Inicia el flujo OAuth redirigiendo al usuario a Canvas.
   */
  async login(req, res, next) {
    try {
      const canvasBaseUrl = getCanvasEnv('CANVAS_BASE_URL', 'VITE_CANVAS_BASE_URL') || 'https://canvas.instructure.com';
      const clientId = getEnv('CANVAS_CLIENT_ID', getEnv('LTI_CLIENT_ID', '10000000000001'));
      
      // La URL de retorno a nuestro backend
      const redirectUri = `${getEnv('BACKEND_URL', `https://localhost:${getEnv('PORT', 3000)}`)}/api/oauth2/canvas/callback`;
      
      // Si tenemos el sub del usuario en la sesión o cookie LTI, lo pasamos como estado para recuperarlo luego
      // Nota: En un entorno de producción real, 'state' debería ser firmado o guardado en sesión/DB para evitar CSRF.
      const canvasSub = req.ltiContext?.user || req.user?.id || req.query.user_id;
      
      if (!canvasSub) {
        throw new AppError('No se proporcionó identificación de usuario para el inicio de sesión OAuth', 400);
      }
      
      const state = Buffer.from(JSON.stringify({ canvasSub })).toString('base64');
      
      const authUrl = new URL('/login/oauth2/auth', canvasBaseUrl);
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('state', state);
      // Podemos pedir scopes específicos si es necesario, pero si omitimos, pide los globales del Developer Key

      logger.info(`[CanvasOAuth] Iniciando flujo OAuth para el usuario ${canvasSub}, redirigiendo a Canvas.`);
      res.redirect(authUrl.toString());
    } catch (error) {
      next(error);
    }
  }

  /**
   * Recibe el código de autorización de Canvas y obtiene el token.
   */
  async callback(req, res, next) {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        logger.error(`[CanvasOAuth] Error devuelto por Canvas: ${error} - ${error_description}`);
        return res.redirect(`${getEnv('FRONTEND_URL', 'https://localhost:5173')}/error?msg=OAuth_Failed`);
      }

      if (!code || !state) {
        throw new AppError('Parámetros inválidos en el callback OAuth', 400);
      }

      let canvasSub;
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        canvasSub = decodedState.canvasSub;
      } catch (e) {
        throw new AppError('Estado OAuth inválido', 400);
      }

      const canvasBaseUrl = getCanvasEnv('CANVAS_BASE_URL', 'VITE_CANVAS_BASE_URL') || 'https://canvas.instructure.com';
      const clientId = getEnv('CANVAS_CLIENT_ID', getEnv('LTI_CLIENT_ID', '10000000000001'));
      const clientSecret = getEnv('CANVAS_CLIENT_SECRET'); // DEBE configurarse en el .env
      const redirectUri = `${getEnv('BACKEND_URL', `https://localhost:${getEnv('PORT', 3000)}`)}/api/oauth2/canvas/callback`;

      if (!clientSecret) {
        logger.error('[CanvasOAuth] Falla crítica: CANVAS_CLIENT_SECRET no está configurado en el servidor.');
        // Si no hay client secret, fallamos
        throw new AppError('Configuración incompleta: falta CANVAS_CLIENT_SECRET', 500);
      }

      const response = await this.canvasClient.oauthFetch('/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code
        }),
        returnFullResponse: true
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error(`[CanvasOAuth] Fallo al intercambiar token: ${response.status} ${errText}`);
        throw new AppError('Fallo al obtener token de Canvas', 502);
      }

      const data = await response.json();
      
      // Guardar el token en la BD
      const expiresAt = new Date(Date.now() + (data.expires_in * 1000));
      await this.canvasTokenRepo.saveToken(canvasSub, data.access_token, data.refresh_token, expiresAt);

      logger.info(`[CanvasOAuth] Token OAuth guardado exitosamente para el usuario ${canvasSub}`);

      // Redirigir de vuelta a la app frontend
      res.redirect(`${getEnv('FRONTEND_URL', 'https://localhost:5173')}/`);
    } catch (err) {
      next(err);
    }
  }
}
