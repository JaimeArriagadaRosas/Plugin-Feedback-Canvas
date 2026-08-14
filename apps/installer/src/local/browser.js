import { spawn } from 'node:child_process';
import * as os from 'node:os';
import * as http from 'node:http';
import * as https from 'node:https';

function isWsl(environment) {
  return Boolean(environment.WSL_INTEROP || environment.WSL_DISTRO_NAME);
}

/**
 * Resolves the command that delegates a URL to the OS default browser.
 * Does not detect or force specific browsers: the preference belongs to the user.
 */
export function resolveDefaultBrowserLaunch(url, {
  platform = os.platform(),
  environment = process.env
} = {}) {
  if (platform === 'win32' || isWsl(environment)) {
    // start queries the HTTP(S) association configured by the user in Windows.
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
 * Opens a URL without blocking the installer and always using the
 * default browser of the host system.
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
 * Waits for Canvas LMS to be ready by polling its status endpoint.
 * Fails in a controlled manner (with a real timeout) so that the orchestrator
 * can suggest opening it manually, instead of hanging for 30 minutes.
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
        return reject(new Error('Timeout waiting for Canvas LMS.'));
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
          } catch { /* ignore invalid JSON */ }
          setTimeout(() => poll((idx + 1) % endpoints.length), 2000);
        });
      });
      req.on('error', () => setTimeout(() => poll((idx + 1) % endpoints.length), 2000));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(() => poll((idx + 1) % endpoints.length), 2000); });
    };
    poll();
  });
}
