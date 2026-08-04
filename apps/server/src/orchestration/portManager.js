import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import * as net from 'node:net';

/**
 * Verifica si un puerto está en uso. 
 * A diferencia del anterior, este método asegura la liberación real esperando el cierre del socket.
 */
export function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false)); // IMPORTANTE: Espera a que el OS libere el socket.
    });
    server.listen(port);
  });
}

function getPidsOnPort(port) {
  const pids = new Set();
  const platform = os.platform();
  
  if (platform === 'win32') {
    try {
      const stdout = execFileSync('netstat', ['-aon'], { encoding: 'utf8' });
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid) pids.add(pid); // Incluimos PID 0 porque podría ser proxy WSL/Hyper-V
        }
      }
    } catch { /* ignorar */ }
  } else {
    try {
      const stdout = execFileSync('lsof', [`-ti:${port}`], { encoding: 'utf8' });
      stdout.trim().split('\n').filter(Boolean).forEach(pid => pids.add(pid));
    } catch { /* ignorar */ }
  }
  return Array.from(pids);
}

function killPid(pid, port) {
  if (pid === '0') {
    console.warn(`  ! Advertencia: El proceso en el puerto ${port} tiene PID 0 (Posible proxy de sistema/Docker/Hyper-V).`);
    console.warn(`    Es posible que taskkill falle o esté denegado. Se recomienda detener los contenedores manualmente o reiniciar Docker.`);
    return; // Evitamos mandar kill a 0 en Windows
  }

  try {
    if (os.platform() === 'win32') {
      execFileSync('taskkill', ['/F', '/PID', pid], { encoding: 'utf8', stdio: 'ignore' });
    } else {
      process.kill(parseInt(pid, 10), 'SIGTERM');
    }
  } catch (e) {
    console.warn(`  ! Advertencia: No se pudo matar PID ${pid} con taskkill. ¿Faltan permisos de Administrador?`);
  }
}

/**
 * Libera un puerto de forma idempotente con reintentos.
 * @throws Error si no se puede liberar tras los intentos.
 */
export async function killProcessOnPort(port, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (!(await isPortInUse(port))) {
      return true; // Ya está libre
    }
    
    const pids = getPidsOnPort(port);
    if (pids.length > 0) {
      console.log(`  · [Intento ${attempt}/${maxRetries}] Terminando procesos en puerto ${port}: PIDs [${pids.join(', ')}]`);
      pids.forEach(pid => killPid(pid, port));
    } else {
      // El puerto está en uso pero no hay PIDs visibles (quizás un proceso zombie sin permisos para ver)
      console.log(`  · [Intento ${attempt}/${maxRetries}] Puerto ${port} ocupado, pero no se encontró PID visible.`);
    }

    // Esperar un poco para que el OS libere los handles
    await new Promise(r => setTimeout(r, 1000));
  }

  // Comprobación final
  if (await isPortInUse(port)) {
    throw new Error(`\n[CRÍTICO] FATAL: No se pudo liberar el puerto ${port} tras ${maxRetries} intentos.\nHay un proceso secuestrando el puerto. Si es Docker Desktop (PID 0), debes detenerlo manualmente.\nAbortando orquestación para evitar EADDRINUSE.\n`);
  }
  return true;
}

export async function clearPorts(vitePort, serverPort) {
  await killProcessOnPort(vitePort);
  await killProcessOnPort(serverPort);
}
