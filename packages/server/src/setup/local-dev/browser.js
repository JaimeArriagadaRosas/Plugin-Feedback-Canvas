import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import * as http from 'node:http';
import * as https from 'node:https';

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
 * Espera a que Canvas LMS esté listo sondeando su endpoint de estado.
 * Falla de forma controlada (con un timeout real) para que el orquestador
 * pueda sugerir abrir manualmente, en lugar de colgarse 30 minutos.
 */
export async function waitForCanvasReady(timeoutMs = 30 * 60 * 1000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const endpoints = [
      { protocol: https, url: 'https://localhost:3000/api/config/startup-mode', opts: { rejectUnauthorized: false } },
      { protocol: http, url: 'http://localhost:3000/api/config/startup-mode', opts: {} },
    ];

    const poll = (idx = 0) => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Timeout esperando a Canvas LMS.'));
      }
      const ep = endpoints[idx];
      if (!ep) {
        return setTimeout(() => poll(0), 2000);
      }
      const req = ep.protocol.get(ep.url, ep.opts, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.initializing === false) return resolve();
          } catch { /* ignora JSON inválido */ }
          setTimeout(() => poll((idx + 1) % endpoints.length), 2000);
        });
      });
      req.on('error', () => setTimeout(() => poll((idx + 1) % endpoints.length), 2000));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(() => poll((idx + 1) % endpoints.length), 2000); });
    };
    poll();
  });
}
