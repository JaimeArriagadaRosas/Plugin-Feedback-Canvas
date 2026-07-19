import logger from '../utils/logger.js';

/**
 * Renderiza una página HTML de error con estilos de la Universidad Andrés Bello.
 * Esta página intenta redirigir el top frame de Canvas automáticamente para recuperar la sesión.
 * Si el navegador bloquea la redirección cross-origin, el usuario puede usar el botón.
 *
 * @param {Object} res - Objeto de respuesta de Express.
 * @param {Error|String} error - El error original.
 * @param {String} referer - URL a la cual regresar (la página del curso en Canvas).
 */
export function handleLtiError(res, error, referer) {
  const errorMessage = error.message || error.toString();
  const safeReferer = referer || (process.env.CANVAS_BASE_URL || 'https://localhost:8443');

  logger.info('[LtiErrorHandler] Renderizando página de autorreparación LTI', { safeReferer });

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sesión Interrumpida - Recuperación</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f6f8;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      color: #333;
    }
    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      width: 90%;
      max-width: 450px;
      padding: 30px;
      text-align: center;
      border-top: 5px solid #0f2d53; /* Azul Institucional UNAB */
    }
    h2 {
      color: #0f2d53;
      margin-top: 0;
      font-size: 1.5rem;
    }
    p {
      color: #555;
      line-height: 1.5;
      font-size: 0.95rem;
      margin-bottom: 25px;
    }
    .error-detail {
      background: #f8d7da;
      color: #721c24;
      padding: 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85rem;
      margin-bottom: 25px;
      word-break: break-all;
    }
    .btn {
      display: inline-block;
      background-color: #0f2d53; /* Azul Institucional UNAB */
      color: white;
      text-decoration: none;
      padding: 12px 25px;
      border-radius: 4px;
      font-weight: 600;
      transition: background-color 0.2s ease;
    }
    .btn:hover {
      background-color: #0a1f3a;
    }
  </style>
</head>
<body>
  <div class="card">
    <div id="manual-action">
      <h2>Sesión Expirada</h2>
      <p>Por motivos de seguridad, la sesión de lanzamiento ha expirado tras un periodo de inactividad.</p>
      <div class="error-detail">${errorMessage}</div>
      <p><strong>Por favor, vuelva a hacer clic en la herramienta "Feedback" en el menú lateral de su curso para reanudar.</strong></p>
    </div>
  </div>
</body>
</html>
  `;

  res.status(401).send(html);
}
