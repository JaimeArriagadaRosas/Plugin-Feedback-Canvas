import { execFileSync } from 'node:child_process';
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
        const stdout = execFileSync('netstat', ['-aon'], { encoding: 'utf8' });
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (line.includes(`:${port}`) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              console.log(`  · Terminando proceso PID ${pid} en puerto ${port}`);
              execFileSync('taskkill', ['/F', '/PID', pid], { encoding: 'utf8' });
            }
          }
        }
      } catch { /* puerto libre */ }
    } else {
      try {
        const stdout = execFileSync('lsof', [`-ti:${port}`], { encoding: 'utf8' });
        const pids = stdout.trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          console.log(`  · Terminando proceso PID ${pid} en puerto ${port}`);
          process.kill(parseInt(pid, 10), 'SIGTERM');
        }
      } catch { /* puerto libre */ }
    }
  } catch (e) {
    console.error(`  × No se pudo liberar puerto ${port}: ${e.message}`);
  }
}

export async function clearPorts(vitePort, serverPort) {
  if (await isPortInUse(vitePort)) killProcessOnPort(vitePort);
  if (await isPortInUse(serverPort)) killProcessOnPort(serverPort);
}
