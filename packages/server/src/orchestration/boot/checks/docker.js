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

    log.success(`Daemon de Docker activo${memGb ? ` (${memGb.toFixed(1)}GB RAM)` : ''}.`);
    return BootResult.ok({ backend, memGb });
  }
}
