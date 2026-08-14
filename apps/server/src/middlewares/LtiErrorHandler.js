import logger from '../utils/logger.js';

// HTML escape utility (OWASP A03: Injection Prevention)
function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Renders an HTML error page with Andrés Bello University styles.
 * This page attempts to automatically redirect the Canvas top frame to recover the session.
 * If the browser blocks cross-origin redirection, the user can use the button.
 *
 * @param {Object} res - Express response object.
 * @param {Error|String} error - The original error.
 * @param {String} referer - URL to return to (the Canvas course page).
 */
export function handleLtiError(res, error, referer) {
  const errorMessage = error.message || error.toString();
  const safeReferer = referer || (process.env.CANVAS_BASE_URL || 'https://localhost:8443');

  logger.info('[LtiErrorHandler] Rendering LTI self-repair page', { safeReferer });

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Interrupted - Recovery</title>
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
      border-top: 5px solid #0f2d53; /* UNAB Institutional Blue */
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
      background-color: #0f2d53; /* UNAB Institutional Blue */
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
      <h2>Session Expired</h2>
      <p>For security reasons, the launch session has expired after a period of inactivity.</p>
      <div class="error-detail">${escapeHtml(errorMessage)}</div>
      <p><strong>Please click the "Feedback" tool again in the side menu of your course to resume.</strong></p>
    </div>
  </div>
</body>
</html>
  `;

  res.status(401).send(html);
}
