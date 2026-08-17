import { getEnv, getCanvasEnv } from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import CanvasClient from '../services/infrastructure/CanvasClient.js';
import { signOAuthState, verifyOAuthState } from '../security/crypto.js';
import { REQUIRED_CANVAS_SCOPES } from '../constants/canvasScopes.js';

export default class CanvasOAuthController {
  constructor(canvasTokenRepo, canvasClient) {
    this.canvasTokenRepo = canvasTokenRepo;
    this.canvasClient = canvasClient || new CanvasClient();
  }

  /**
   * Starts the OAuth flow by redirecting the user to Canvas.
   */
  async login(req, res, next) {
    try {
      const canvasBaseUrl = getCanvasEnv('CANVAS_BASE_URL', 'VITE_CANVAS_BASE_URL') || 'https://canvas.instructure.com';
      const clientId = getEnv('CANVAS_CLIENT_ID', getEnv('LTI_CLIENT_ID', '10000000000001'));
      
      // The return URL to our backend
      const redirectUri = `${getEnv('BACKEND_URL', `https://localhost:${getEnv('PORT', 3000)}`)}/api/oauth2/canvas/callback`;
      
      const canvasSub = req.appIdentity?.ltiUserId;
      
      if (!canvasSub) {
        throw new AppError('No LTI user identification provided for OAuth login', 400);
      }
      
      const canonicalUserId = req.appIdentity?.canonicalUserId || canvasSub;
      const state = signOAuthState({ canvasSub, canonicalUserId });
      
      const authUrl = new URL('/login/oauth2/auth', canvasBaseUrl);
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('state', state);
      
      const defaultScopes = REQUIRED_CANVAS_SCOPES.join(' ');

      const scopes = getEnv('CANVAS_OAUTH_SCOPES', defaultScopes);
      if (scopes) {
        authUrl.searchParams.append('scope', scopes);
      }

      logger.info(`[CanvasOAuth] Initiating OAuth flow for user ${canvasSub}, redirecting to Canvas.`);
      res.redirect(authUrl.toString());
    } catch (error) {
      next(error);
    }
  }

  /**
   * Receives the authorization code from Canvas and retrieves the token.
   */
  async callback(req, res, next) {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        logger.error(`[CanvasOAuth] Error returned by Canvas: ${error} - ${error_description}`);
        return res.redirect(`${getEnv('FRONTEND_URL', 'https://localhost:5173')}/error?msg=OAuth_Failed`);
      }

      if (!code || !state) {
        throw new AppError('Invalid parameters in OAuth callback', 400);
      }

      const decodedState = verifyOAuthState(state);
      if (!decodedState || !decodedState.canvasSub) {
        throw new AppError('Invalid or manipulated OAuth state', 400);
      }
      const canvasSub = decodedState.canvasSub;
      const canonicalUserId = decodedState.canonicalUserId || canvasSub;

      const canvasBaseUrl = getCanvasEnv('CANVAS_BASE_URL', 'VITE_CANVAS_BASE_URL') || 'https://canvas.instructure.com';
      const clientId = getEnv('CANVAS_CLIENT_ID', getEnv('LTI_CLIENT_ID', '10000000000001'));
      const clientSecret = getEnv('CANVAS_CLIENT_SECRET', getEnv('LTI_CLIENT_SECRET')); // Allow fallback to LTI secret
      const redirectUri = `${getEnv('BACKEND_URL', `https://localhost:${getEnv('PORT', 3000)}`)}/api/oauth2/canvas/callback`;

      if (!clientSecret) {
        logger.error('[CanvasOAuth] Critical failure: CANVAS_CLIENT_SECRET or LTI_CLIENT_SECRET are not configured on the server.');
        // If there is no client secret, we fail
        throw new AppError('Incomplete configuration: missing CANVAS_CLIENT_SECRET / LTI_CLIENT_SECRET', 500);
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
        logger.error(`[CanvasOAuth] Failed to exchange token: ${response.status} ${errText}`);
        throw new AppError('Failed to retrieve token from Canvas', 502);
      }

      const data = await response.json();
      
      // Save the token in the DB using canvasSub (LTI UUID)
      const expiresAt = new Date(Date.now() + (data.expires_in * 1000));
      await this.canvasTokenRepo.saveToken(canvasSub, data.access_token, data.refresh_token, expiresAt);

      logger.info(`[CanvasOAuth] OAuth token successfully saved for user (sub) ${canvasSub}`);

      // Redirect back to the frontend app
      res.redirect(`${getEnv('FRONTEND_URL', 'https://localhost:5173')}/`);
    } catch (err) {
      next(err);
    }
  }
}
