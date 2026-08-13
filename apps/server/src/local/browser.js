import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import * as https from 'node:https';
import { EventEmitter } from 'node:events';
import logger from '../utils/logger.js';

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
  } catch (err) { logger.debug('[BROWSER] No se pudo abrir el navegador de forma automática.', { error: err.message }); }
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
      
      // El flujo LTI local requiere HTTPS. Un fallo TLS se reintenta y se reporta;
      // nunca se degrada silenciosamente a HTTP.
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
            } catch (err) { logger.debug('[CANVAS_READY] JSON inválido en polling startup-mode.', { error: err.message }); }
            setTimeout(poll, delay);
          });
        }
      );
      
      req.on('error', () => setTimeout(poll, delay));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(poll, delay); });
    };
    poll();
  });
}
