import jwt from 'jsonwebtoken';
import { isLaunchAllowed } from './roles.js';
import logger from './logger.js';

/**
 * Valida si un token LTI debe tener permiso para inicializar la aplicación frontend.
 * Acepta el objeto decoded (ya verificado) o, por compatibilidad, un JWT en bruto.
 * Bloquea a los estudiantes puros (sin capacidad docente/admin) como defensa en
 * profundidad. La visibilidad real la controla Canvas mediante los placements.
 * @param {object|string} tokenOrDecoded - El token JWT decodificado (o el JWT en bruto)
 * @returns {boolean} - true si el acceso es permitido, false si debe ser bloqueado
 */
export const validateLtiLaunch = (tokenOrDecoded) => {
  try {
    // Aceptar objeto decoded directamente para evitar doble decodificación JWT
    const decoded = (typeof tokenOrDecoded === 'string')
      ? jwt.decode(tokenOrDecoded)
      : tokenOrDecoded;

    if (!decoded) {
      logger.warn('[LTI] Null or malformed token received');
      return false;
    }

    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      logger.warn('[LTI] Expired token');
      return false;
    }

    const roles = decoded['https://purl.imsglobal.org/spec/lti/claim/roles'];
    if (!roles || !Array.isArray(roles)) {
      logger.warn('[LTI] Token without valid roles claim');
      return false;
    }

    return isLaunchAllowed(decoded);
  } catch (err) {
    logger.error('[LTI] Invalid token:', err.message);
    return false;
  }
}

/**
 * Renderiza la vista HTML de acceso denegado directamente en la respuesta.
 */
export const renderAccessDenied = (res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Access Denied</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .container { background-color: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
            h1 { color: #d32f2f; margin-bottom: 10px; }
            p { color: #555; font-size: 1.1em; line-height: 1.5; }
            .icon { font-size: 64px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">🚫</div>
            <h1>Access Denied</h1>
            <p>Sorry, the <b>Unida</b> panel in the main menu is designed to be used only by teachers and administrators.</p>
            <p>If you are a student, you will only be able to access the tool if your teacher has enabled it in your course.</p>
        </div>
    </body>
    </html>
    `;
    return res.status(403).send(html);
}
