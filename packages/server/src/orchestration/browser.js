import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import * as http from 'node:http';
import * as https from 'node:https';
import { isHttpsEnabled } from '../security/envGuard.js';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function openBrowser(url) {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      execFileSync('cmd.exe', ['/c', 'start', '""', url]);
    } else if (platform === 'darwin') {
      execFileSync('open', [url]);
    } else {
      execFileSync('xdg-open', [url]);
    }
  } catch { /* ignorar */ }
}

/**
 * Canal de eventos para el estado de inicialización de Canvas.
 *
 * `server.js`/`CanvasLocalManager` mutan `global.isCanvasInitializing`. En lugar
 * de sondear ciegamente localhost:3000 cada 3 s durante 30 min (lo que produce
 * los "avisa de lentitud" falsos y gasto de red), exponemos ese flag como un
 * EventEmitter en proceso: el orquestador espera por EVENTO real, no por timer.
 */
let canvasInitEmitter = null;

function getCanvasInitEmitter() {
  if (!canvasInitEmitter) {
    canvasInitEmitter = new EventEmitter();
    canvasInitEmitter.on('newListener', (event, listener) => {
      if (event === 'ready' && global.isCanvasInitializing === false) {
        // Ya está listo: notificar en el siguiente tick para no perder el listener.
        queueMicrotask(() => listener());
      }
    });
  }
  return canvasInitEmitter;
}

export function notifyCanvasReady() {
  getCanvasInitEmitter().emit('ready');
}

export function notifyCanvasError(err) {
  getCanvasInitEmitter().emit('error', err);
}

/** ¿El backend ya está escuchando en PORT? (espera por evento, no por timeout ciego) */
function waitForBackendListening(port, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryOnce = () => {
      const req = http.get({ host: 'localhost', port, path: '/api/config/startup-mode', timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('El backend no respondió tras iniciar.'));
        } else {
          setTimeout(tryOnce, 300);
        }
      });
      req.on('timeout', () => req.destroy());
    };
    tryOnce();
  });
}

/**
 * Espera a que Canvas LMS esté listo SUSCRIBIÉNDOSE al flag real
 * (`global.isCanvasInitializing`), no sondeando.
 *
 * Estrategia:
 *  1. Si ya estamos en el mismo proceso que el backend y el flag ya es false,
 *     resolvemos de inmediato (sin espera ni polling).
 *  2. Si el flag está en true, esperamos el evento 'ready' del emitter.
 *  3. Fallback defensivo: si por algún motivo el emitter no se usa (p. ej.
 *     arranque en proceso separado), sondeamos /api/config/startup-mode con
 *     backoff exponencial y timeout real, midiendo el tiempo para reportar
 *     anomalías basadas en causa real, no en un umbral arbitrario.
 */
export async function waitForCanvasReady(timeoutMs = 30 * 60 * 1000) {
  // Caso feliz en-proceso: el backend ya nos indicó el estado vía flag global.
  if (typeof global.isCanvasInitializing === 'boolean' && global.isCanvasInitializing === false) {
    return;
  }

  if (typeof global.isCanvasInitializing === 'boolean' && global.isCanvasInitializing === true) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout esperando a Canvas LMS (evento de listo no recibido).'));
      }, timeoutMs);
      const onReady = () => { cleanup(); resolve(); };
      const onErr = (err) => { cleanup(); reject(err); };
      const cleanup = () => {
        clearTimeout(timer);
        getCanvasInitEmitter().off('ready', onReady);
        getCanvasInitEmitter().off('error', onErr);
      };
      getCanvasInitEmitter().on('ready', onReady);
      getCanvasInitEmitter().on('error', onErr);
    });
    return;
  }

  // Fallback: flag no observable en este proceso. Sondeo inteligente con backoff.
  const start = Date.now();
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const poll = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Timeout esperando a Canvas LMS.'));
      }
      const delay = Math.min(2000 * 2 ** attempt, 10000);
      attempt++;
      
      // En el proceso orquestador _RUNTIME_IS_HTTPS podría no estar seteado, 
      // pero si el certificado mkcert existe, probablemente el hijo arrancó en HTTPS.
      // Así que probamos forzosamente con https ignorando certificado, o caemos a http.
      const protocol = https; 
      const agentOptions = { rejectUnauthorized: false };
      
      const req = protocol.get(
        'https://localhost:3000/api/config/startup-mode',
        agentOptions,
        (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.initializing === false) return resolve();
            } catch { /* ignora JSON inválido */ }
            setTimeout(poll, delay);
          });
        }
      );
      
      // Si falla en HTTPS, intentar silenciosamente en HTTP
      req.on('error', () => {
        const reqHttp = http.get('http://localhost:3000/api/config/startup-mode', (res2) => {
          let data = '';
          res2.on('data', (c) => { data += c; });
          res2.on('end', () => {
             try {
               const json = JSON.parse(data);
               if (json.initializing === false) return resolve();
             } catch {}
             setTimeout(poll, delay);
          });
        });
        reqHttp.on('error', () => setTimeout(poll, delay));
        reqHttp.setTimeout(2000, () => { reqHttp.destroy(); setTimeout(poll, delay); });
      });
      req.setTimeout(2000, () => { req.destroy(); setTimeout(poll, delay); });
    };
    poll();
  });
}
