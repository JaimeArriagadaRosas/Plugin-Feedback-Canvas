import { execSync } from 'node:child_process';
import * as os from 'node:os';
import * as net from 'node:net';

export function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

export function killProcessOnPort(port) {
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      try {
        const stdout = execSync(`netstat -aon | findstr :${port} | findstr LISTENING`, { encoding: 'utf8', shell: true });
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            console.log(`[run] Terminando proceso PID ${pid} en puerto ${port}`);
            execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8', shell: true });
          }
        }
      } catch { /* puerto libre */ }
    } else {
      try {
        const stdout = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
        const pids = stdout.trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          console.log(`[run] Terminando proceso PID ${pid} en puerto ${port}`);
          process.kill(parseInt(pid, 10), 'SIGTERM');
        }
      } catch { /* puerto libre */ }
    }
  } catch (e) {
    console.error(`[run] No se pudo liberar puerto ${port}: ${e.message}`);
  }
}

export async function clearPorts(vitePort, serverPort) {
  console.log(`[run] Limpiando procesos previos en puertos ${vitePort} y ${serverPort}...`);
  if (await isPortInUse(vitePort)) killProcessOnPort(vitePort);
  if (await isPortInUse(serverPort)) killProcessOnPort(serverPort);
  console.log('[run] Puertos liberados.');
}
