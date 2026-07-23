/**
 * Proxy TLS inverso para Canvas LMS en desarrollo local.
 *
 * La imagen oficial de Canvas (docker-compose) sirve HTTP plano en el puerto
 * 8080 y su nginx de Passenger no expone TLS de forma soportada. Para que el
 * flujo LTI 1.3 funcione sin "respuesta no válida" / mixed content, el plugin
 * y Canvas deben verse como HTTPS.
 *
 * Este módulo levanta un proxy TLS mínimo en el HOST que:
 *   - Escucha HTTPS en TLS_LISTEN_PORT (por defecto 8443) con los certificados
 *     mkcert del plugin (localhost + 127.0.0.1).
 *   - Reenvía (proxy-pass) cada request a Canvas por HTTP en CANVAS_HTTP_HOST
 *     (por defecto http://localhost:8080, el contenedor Docker).
 *   - Mantiene el Host header y el esquema original para que Canvas genere
 *     URLs correctas.
 *
 * Así Canvas se accede como https://localhost:8443 mientras el contenedor
 * sigue en HTTP en 8080, sin tocar la imagen de Canvas.
 *
 * Uso:
 *   node scripts/tls-proxy/index.js            # usa defaults (8443 -> 8080)
 *   TLS_LISTEN_PORT=8443 CANVAS_HTTP_PORT=8080 node scripts/tls-proxy/index.js
 *
 * El orquestador (main.js) puede invocar startTlsProxy()/stopTlsProxy().
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const CERTS_DIR = path.join(PLUGIN_ROOT, 'packages', 'server', 'certs');

const TLS_LISTEN_PORT = parseInt(process.env.TLS_LISTEN_PORT || '8443', 10);
const CANVAS_HTTP_HOST = process.env.CANVAS_HTTP_HOST || '127.0.0.1';
const CANVAS_HTTP_PORT = parseInt(process.env.CANVAS_HTTP_PORT || '8080', 10);
const CERT_PEM = path.join(CERTS_DIR, 'localhost.pem');
const CERT_KEY = path.join(CERTS_DIR, 'localhost-key.pem');

/** Proxy http interno que reenvía al contenedor Canvas (HTTP plano). */
function createCanvasProxy() {
  return http.createServer((req, res) => {
    const target = new URL(req.url, `http://${CANVAS_HTTP_HOST}:${CANVAS_HTTP_PORT}`);
    const options = {
      host: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers: {
        ...req.headers,
        'x-forwarded-proto': 'https',
        'x-forwarded-host': req.headers.host,
        'host': req.headers.host,
      },
    };

    if (req.url.includes('/api/lti/')) {
      try {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const clientId = urlObj.searchParams.get('client_id') || 'N/A';
        const redirectUri = urlObj.searchParams.get('redirect_uri') || 'N/A';
        console.log(`[TLS-PROXY] ⚡ TÚNEL OIDC: ${req.method} ${urlObj.pathname} | Client: ${clientId} | Redirige a: ${redirectUri}`);
      } catch (e) {
        console.log(`[TLS-PROXY] ⚡ TÚNEL OIDC: ${req.method} ${req.url} (Host: ${req.headers.host})`);
      }
    }

    const proxyReq = http.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      if (headers.location && headers.location.includes(`${CANVAS_HTTP_HOST}:${CANVAS_HTTP_PORT}`)) {
        headers.location = headers.location.replace(`http://${CANVAS_HTTP_HOST}:${CANVAS_HTTP_PORT}`, `https://localhost:${TLS_LISTEN_PORT}`);
        headers.location = headers.location.replace(`https://${CANVAS_HTTP_HOST}:${CANVAS_HTTP_PORT}`, `https://localhost:${TLS_LISTEN_PORT}`);
        if (req.url.includes('/api/lti/')) {
          console.log(`[TLS-PROXY] [$] TÚNEL OIDC: Reescribiendo Location -> ${headers.location}`);
        }
      }
      res.writeHead(proxyRes.statusCode || 502, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[TLS-PROXY] Error reenviando a Canvas (${CANVAS_HTTP_HOST}:${CANVAS_HTTP_PORT}): ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      res.end('Bad Gateway: no se pudo contactar a Canvas Local en ' +
        `${CANVAS_HTTP_HOST}:${CANVAS_HTTP_PORT}`);
    });

    req.pipe(proxyReq);
  });
}

let serverInstance = null;

/** Inicia el proxy TLS. Devuelve el server https escuchando. */
export function startTlsProxy() {
  if (!fs.existsSync(CERT_PEM) || !fs.existsSync(CERT_KEY)) {
    throw new Error(`[TLS-PROXY] Certificados mkcert no encontrados en ${CERTS_DIR}. ` +
      'Ejecuta mkcert para localhost y 127.0.0.1.');
  }

  const sslOptions = {
    key: fs.readFileSync(CERT_KEY),
    cert: fs.readFileSync(CERT_PEM),
  };

  const proxy = createCanvasProxy();

  const server = https.createServer(sslOptions, (req, res) => {
    // Reenviamos todo al proxy HTTP interno que habla con Canvas.
    const proxyReq = http.request(
      {
        host: '127.0.0.1',
        port: proxy.address().port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      console.error(`[TLS-PROXY] Error interno: ${err.message}`);
      if (!res.headersSent) res.writeHead(502);
      res.end('Bad Gateway');
    });
    req.pipe(proxyReq);
  });

  server.setTimeout(300000);
  server.headersTimeout = 120000;
  server.keepAliveTimeout = 60000;

  proxy.listen(0, '127.0.0.1', () => {
    const internalPort = proxy.address().port;
    if (global.canvasSpinner) global.canvasSpinner.clear();
    console.info(`    [TLS-PROXY]    Proxy HTTP interno escuchando en 127.0.0.1:${internalPort}`);
    server.listen(TLS_LISTEN_PORT, () => {
      console.info(`    [TLS-PROXY]    HTTPS proxy activo: https://localhost:${TLS_LISTEN_PORT} -> HTTP ${CANVAS_HTTP_HOST}:${CANVAS_HTTP_PORT}`);
      if (global.canvasSpinner) global.canvasSpinner.start();
    });
    server.on('error', (err) => {
      console.error(`[TLS-PROXY] No se pudo escuchar en :${TLS_LISTEN_PORT}: ${err.message}`);
    });
  });

  serverInstance = server;
  return server;
}

/** Detiene el proxy si está corriendo. */
export function stopTlsProxy() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
    console.info('[TLS-PROXY] Proxy TLS detenido.');
  }
}

// Ejecución directa: `node scripts/tls-proxy/index.js`
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  startTlsProxy();
}
