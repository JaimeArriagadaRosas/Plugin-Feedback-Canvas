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
  } catch (err) { logger.debug('[BROWSER] Could not open browser automatically.', { error: err.message }); }
}

/**
 * Event channel for Canvas initialization status.
 *
 * `server.js`/`CanvasLocalManager` mutate `global.isCanvasInitializing`. Instead
 * of blindly polling localhost:3000 every 3s for 30min (which produces
 * fake "slowness warnings" and network waste), we expose this flag as an
 * in-process EventEmitter: the orchestrator waits for a real EVENT, not a timer.
 */
let canvasInitEmitter = null;

function getCanvasInitEmitter() {
  if (!canvasInitEmitter) {
    canvasInitEmitter = new EventEmitter();
    canvasInitEmitter.on('newListener', (event, listener) => {
      if (event === 'ready' && global.isCanvasInitializing === false) {
        // Already ready: notify in the next tick to not lose the listener.
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
 * Waits for Canvas LMS to be ready SUBSCRIBING to the real flag
 * (`global.isCanvasInitializing`), not polling.
 *
 * Strategy:
 *  1. If we are already in the same process as the backend and the flag is already false,
 *     we resolve immediately (no wait or polling).
 *  2. If the flag is true, we wait for the 'ready' event from the emitter.
 *  3. Defensive fallback: if for some reason the emitter is not used (e.g.
 *     startup in a separate process), we poll /api/config/startup-mode with
 *     exponential backoff and real timeout, measuring time to report
 *     anomalies based on real cause, not an arbitrary threshold.
 */
export async function waitForCanvasReady(timeoutMs = 30 * 60 * 1000) {
  // Happy in-process case: the backend already told us the status via global flag.
  if (typeof global.isCanvasInitializing === 'boolean' && global.isCanvasInitializing === false) {
    return;
  }

  if (typeof global.isCanvasInitializing === 'boolean' && global.isCanvasInitializing === true) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout waiting for Canvas LMS (ready event not received).'));
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

  // Fallback: flag not observable in this process. Smart polling with backoff.
  const start = Date.now();
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const poll = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Timeout waiting for Canvas LMS.'));
      }
      const delay = Math.min(2000 * 2 ** attempt, 10000);
      attempt++;
      
      // The local LTI flow requires HTTPS. A TLS failure is retried and reported;
      // it never silently degrades to HTTP.
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
            } catch (err) { logger.debug('[CANVAS_READY] Invalid JSON in polling startup-mode.', { error: err.message }); }
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
