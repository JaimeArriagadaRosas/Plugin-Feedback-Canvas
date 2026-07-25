import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { askConfirm } from '../../cli.js';
import { execFileSync, spawnSync } from 'node:child_process';
import { BootResult } from './../result.js';

/**
 * DockerCheck — Verificación robusta del entorno Docker sin suposiciones frágiles.
 *
 * Casos cubiertos:
 *  - CLI no instalada (docker --version falla).
 *  - CLI instalada pero daemon caído (docker info falla).
 *  - Daemon inaccesible por permisos (Linux sin grupo docker).
 *  - Memoria asignada insuficiente (< MIN_RAM_GB).
 *  - Backends alternativos: Docker Desktop, Colima, Rancher Desktop, Podman.
 */
export class DockerCheck {
  constructor(minRamGb = 7.5) {
    this.minRamGb = minRamGb;
  }

  _run(cmd, args, timeoutMs = 8000) {
    try {
      const result = spawnSync(cmd, args, {
        encoding: 'utf8',
        timeout: timeoutMs,
        shell: false
      });
      
      // En Windows, docker emite warnings inofensivos a stderr a veces
      if (result.status === 0) {
        return { ok: true, out: (result.stdout || '').toString().trim(), err: '' };
      }
      
      return {
        ok: false,
        out: (result.stdout || '').toString().trim(),
        err: (result.stderr || `Proceso falló con status ${result.status}`).toString().trim(),
      };
    } catch (e) {
      return {
        ok: false,
        out: '',
        err: (e.message || '').toString().trim(),
      };
    }
  }

  detectBackend() {
    if (process.env.DOCKER_HOST && process.env.DOCKER_HOST.length) {
      if (process.env.DOCKER_HOST.includes('colima')) return 'Colima';
      if (process.env.DOCKER_HOST.includes('rancher')) return 'Rancher Desktop';
      return `DOCKER_HOST (${process.env.DOCKER_HOST})`;
    }
    // Podman a menudo expone el socket de docker compat. Solo inferimos si docker falla.
    return 'Docker'; // Desktop / Engine por defecto
  }

  /** ¿Está la CLI de docker disponible? */
  checkCli() {
    const r = this._run('docker', ['--version'], 8000);
    return r.ok;
  }

  /** Ejecuta la verificación completa. No corrige automáticamente el SO. */
  async run(log) {
    const cli = this.checkCli();
    if (!cli) {
      log.error('Docker CLI no encontrado en el PATH.');
      log.action('Instale Docker Desktop (o Podman/Colima) y reinicie la terminal.');
      return BootResult.fail(true, 'Docker no instalado',
        'Instale Docker Desktop desde https://www.docker.com/products/docker-desktop/');
    }

    const backend = this.detectBackend();
    log.info(`Docker CLI disponible (backend detectado: ${backend}).`);

    const info = this._run('docker', ['info', '--format', '{{.MemTotal}}'], 10000);
    if (!info.ok) {
      const errLow = /permission denied|denied/i.test(info.err);
      if (errLow) {
        log.error('Daemon de Docker inaccesible por permisos.');
        log.action('Agregue su usuario al grupo "docker" (Linux) o reinicie Docker Desktop.');
        return BootResult.fail(true, 'Permisos insuficientes para Docker',
          'Linux: sudo usermod -aG docker $USER && reinicie sesión.');
      }
      log.error('Daemon de Docker no está corriendo.');
      log.action('Abra Docker Desktop (o `colima start` / `rancher-desktop` / `podman machine start`).');
      return BootResult.fail(true, 'Daemon de Docker detenido',
        'Inicie el daemon: Docker Desktop, `colima start`, `podman machine start`...');
    }

    const memGb = info.out && /^\d+$/.test(info.out)
      ? parseInt(info.out, 10) / 1024 ** 3
      : null;

    if (memGb !== null && memGb < 7.5) {
      log.warn(`RAM actual de Docker: ${memGb.toFixed(1)}GB (Recomendado: 8GB)`);
      const wantsRam = await askConfirm('  Docker tiene asignado menos de 8GB de RAM. ¿Configurar 8GB automáticamente para Canvas LMS?');
      if (wantsRam) {
        if (os.platform() === 'win32') {
          log.info('Configurando .wslconfig y reiniciando WSL...');
          const wslConfigPath = path.join(os.homedir(), '.wslconfig');
          let content = '';
          if (fs.existsSync(wslConfigPath)) {
            content = fs.readFileSync(wslConfigPath, 'utf8');
          }
          if (content.includes('memory=')) {
            content = content.replace(/^memory=.*$/m, 'memory=8GB');
          } else {
            if (!content.includes('[wsl2]')) {
              content += '\n[wsl2]\n';
            }
            content = content.replace('[wsl2]', '[wsl2]\nmemory=8GB');
          }
          fs.writeFileSync(wslConfigPath, content);
          try {
             execFileSync('wsl', ['--shutdown'], { stdio: 'ignore' });
          } catch(e) {}
          log.info('WSL reiniciado. Esperando a que Docker vuelva a arrancar (8s)...');
          await new Promise(r => setTimeout(r, 8000));
          
          const info2 = this._run('docker', ['info', '--format', '{{.MemTotal}}'], 10000);
          if (info2.ok) {
             const memGb2 = info2.out && /^\d+$/.test(info2.out) ? parseInt(info2.out, 10) / 1024 ** 3 : null;
             log.success(`Daemon de Docker activo${memGb2 ? ` (${memGb2.toFixed(1)}GB RAM)` : ''}.`);
             return BootResult.ok({ backend, memGb: memGb2 });
          }
        } else {
          log.action(`Por favor, ve a las preferencias de ${backend} -> Resources y asigna 8GB de RAM.`);
          await askConfirm('Presiona Y (Enter) cuando hayas aplicado el cambio y reiniciado el motor.');
        }
      }
    }

    log.success(`Daemon de Docker activo${memGb ? ` (${memGb.toFixed(1)}GB RAM)` : ''}.`);
    return BootResult.ok({ backend, memGb });
  }
}
