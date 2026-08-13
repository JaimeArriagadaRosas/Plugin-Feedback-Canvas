import { spawn } from 'node:child_process';
import * as os from 'node:os';
import * as http from 'node:http';
import * as https from 'node:https';

function isWsl(environment) {
  return Boolean(environment.WSL_INTEROP || environment.WSL_DISTRO_NAME);
}

/**
 * Resuelve el comando que delega una URL al navegador predeterminado del SO.
 * No detecta ni fuerza navegadores concretos: la preferencia pertenece al usuario.
 */
export function resolveDefaultBrowserLaunch(url, {
  platform = os.platform(),
  environment = process.env
} = {}) {
  if (platform === 'win32' || isWsl(environment)) {
    // start consulta la asociación HTTP(S) configurada por el usuario en Windows.
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'start', '', url] };
  }
  if (platform === 'darwin') return { command: 'open', args: [url] };
  return { command: 'xdg-open', args: [url] };
}

function launchDetached(command, args, spawnProcess = spawn) {
  return new Promise((resolve) => {
    const child = spawnProcess(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref?.();
      resolve(true);
    });
  });
}

/**
 * Abre una URL sin bloquear el instalador y usando siempre el navegador
 * predeterminado del sistema anfitrión.
 */
export async function openBrowser(url, options = {}) {
  try {
    const launch = resolveDefaultBrowserLaunch(url, options);
    const launcher = options.launcher || launchDetached;
    return await launcher(launch.command, launch.args, options.spawnProcess);
  } catch {
    return false;
  }
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
      // eslint-disable-next-line security/detect-object-injection
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
