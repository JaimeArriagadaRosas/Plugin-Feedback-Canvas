import { execa } from 'execa';
import path from 'node:path';

// This module never creates, stops, removes or renames containers.
const SHARED = Object.freeze([
  { service: 'db', name: 'feedback_plugin_db_local', image: 'postgres:15-alpine', port: '5432/tcp', hostPort: '5432' },
  { service: 'gotenberg', name: 'feedback_plugin_gotenberg_local', image: 'gotenberg/gotenberg:8', port: '3000/tcp', hostPort: '3001' }
]);
const getEnv = (items, key) => items.find(item => item.startsWith(key + '='))?.slice(key.length + 1);
const portMatches = (data, entry, expected) => {
  // For stopped containers Docker may omit active bindings. Never infer active
  // port health from HostConfig when a service is running.
  const published = data.State?.Running === false
    ? data.HostConfig?.PortBindings?.[entry.port]
    : data.NetworkSettings?.Ports?.[entry.port];
  return published?.some(port => String(port.HostPort) === String(expected)) === true;
};

export class SharedDependencyRecovery {
  constructor({ exec = execa, environment = process.env, composeFile = 'docker-compose.db.yml' } = {}) {
    this.exec = exec;
    this.environment = environment;
    this.composeFile = composeFile;
  }

  async inspect(cwd) {
    const services = [];
    for (const original of SHARED) {
      const containerSetting = original.service === 'db' ? 'PLUGIN_DB_CONTAINER_NAME' : 'PLUGIN_GOTENBERG_CONTAINER_NAME';
      const configuredName = this.environment[containerSetting];
      if (configuredName && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,126}$/.test(configuredName)) {
        throw new Error('Invalid container name in ' + containerSetting);
      }
      const entry = { ...original, name: configuredName || original.name };
      let data;
      try {
        const result = await this.exec('docker', ['inspect', entry.name, '--format', '{{json .}}'], { cwd });
        data = JSON.parse(result.stdout);
      } catch (error) {
        if (/No such object|No such container/i.test(String(error.stderr || error.message))) {
          services.push({ service: entry.service, name: entry.name, state: 'absent' });
          continue;
        }
        throw new Error('Unable to inspect shared dependency ' + entry.name + ': ' + error.message);
      }

      const labels = data.Config?.Labels || {};
      const owner = labels['com.docker.compose.project'] || null;
      const actualService = labels['com.docker.compose.service'];
      const running = data.State?.Running === true;
      const healthy = data.State?.Health?.Status === 'healthy';
      const imageOk = data.Config?.Image === entry.image;
      const portOk = portMatches(data, entry, this.environment[entry.service === 'db' ? 'DB_PORT' : 'GOTENBERG_PORT'] || entry.hostPort);
      let configurationOk = true;

      if (entry.service === 'db') {
        const env = data.Config?.Env || [];
        const expected = {
          POSTGRES_USER: this.environment.DB_USER || 'postgres',
          POSTGRES_DB: this.environment.DB_NAME || 'feedback_plugin_db',
          POSTGRES_PASSWORD: this.environment.DB_PASSWORD || 'CHANGE_ME_db_password_strong'
        };
        configurationOk = Object.entries(expected).every(([key, value]) => getEnv(env, key) === value) &&
          data.Mounts?.some(m => m.Type === 'volume' && m.Destination === '/var/lib/postgresql/data') === true;
      }

      const identityOk = !!owner && (!this.environment.COMPOSE_PROJECT_NAME || owner === this.environment.COMPOSE_PROJECT_NAME) && actualService === entry.service && imageOk && portOk && configurationOk;
      services.push({
        service: entry.service, name: entry.name, owner,
        state: !identityOk ? 'conflict' : !running ? 'stopped' : !healthy ? 'unavailable' : 'healthy'
      });
    }
    return services;
  }


  /**
   * Read-only, fail-closed preview for an interactive local restart.
   * Compare Docker metadata against the actual Compose project definition, not
   * just labels supplied by a container. Never infer permission from Fast Boot.
   */
  async previewStoppedRecovery(cwd) {
    const current = await this.plan(cwd);
    const safeStates = current.services.every(s => ['healthy', 'stopped'].includes(s.state));
    const stopped = current.services.filter(s => s.state === 'stopped');
    if (!safeStates || stopped.length === 0) {
      return { ...current, kind: 'block', reason: 'No existen servicios propios detenidos verificables' };
    }
    let config;
    try {
      const output = await this.exec('docker',
        ['compose', '-f', this.composeFile, 'config', '--format', 'json'], { cwd, timeout: 15000 });
      config = JSON.parse(output.stdout);
    } catch {
      return { ...current, kind: 'block', reason: 'No se pudo verificar la identidad del proyecto Docker Compose' };
    }
    const owner = config?.name;
    if (!/^[a-z0-9][a-z0-9_.-]{0,125}$/.test(owner || '') ||
        !config.services?.db || !config.services?.gotenberg ||
        current.services.some(s => s.owner !== owner)) {
      return { ...current, kind: 'block', reason: 'Los servicios existentes no pertenecen al proyecto Compose actual' };
    }
    const expectedCompose = path.resolve(cwd, this.composeFile);
    for (const service of current.services) {
      const spec = config.services[service.service];
      const expectedName = spec.container_name || `${owner}-${service.service}-1`;
      if (service.name !== expectedName || spec.image !== SHARED.find(s => s.service === service.service).image) {
        return { ...current, kind: 'block', reason: 'Nombre o imagen de un contenedor diferente al proyecto Compose actual' };
      }
      let data;
      try {
        const inspected = await this.exec('docker',
          ['inspect', service.name, '--format', '{{json .}}'], { cwd, timeout: 15000 });
        data = JSON.parse(inspected.stdout);
      } catch {
        return { ...current, kind: 'block', reason: 'No se pudo verificar nuevamente el contenedor' };
      }
      const labels = data.Config?.Labels || {};
      const configFiles = (labels['com.docker.compose.project.config_files'] || '').split(',');
      if (labels['com.docker.compose.project.working_dir'] !== path.dirname(expectedCompose) ||
          !configFiles.includes(expectedCompose) ||
          labels['com.docker.compose.project'] !== owner ||
          labels['com.docker.compose.service'] !== service.service) {
        return { ...current, kind: 'block', reason: 'Los metadatos Compose no corresponden a este clon' };
      }
      if (service.service === 'db') {
        const volumeAlias = spec.volumes?.find(v => v.target === '/var/lib/postgresql/data')?.source;
        const volumeName = config.volumes?.[volumeAlias]?.name;
        if (!volumeName || !data.Mounts?.some(m => m.Type === 'volume' &&
            m.Destination === '/var/lib/postgresql/data' && m.Name === volumeName)) {
          return { ...current, kind: 'block', reason: 'El volumen de PostgreSQL no corresponde al proyecto Compose' };
        }
      }
    }
    return { kind: 'recoverable', services: current.services, owner,
      stopped: stopped.map(s => s.name) };
  }

  /** A separate authorization path for normal interactive users (default NO). */
  async recoverWithConsent(cwd, { confirm, ...options } = {}) {
    const preview = await this.previewStoppedRecovery(cwd);
    if (preview.kind !== 'recoverable') return preview;
    // main.js sets NON_INTERACTIVE=true *after* a person chooses a menu mode.
    // Only a captured, TTY-backed menu selection can authorize asking again.
    const attendedMenu = this.environment.PLUGIN_RECOVERY_MENU_INTERACTIVE === 'true' &&
      process.stdin.isTTY === true;
    if ((this.environment.NON_INTERACTIVE === 'true' && !attendedMenu) ||
        typeof confirm !== 'function') {
      return { ...preview, kind: 'block', reason: 'La recuperación requiere confirmación interactiva' };
    }
    const allowed = await confirm(
      `Servicios propios detenidos: ${preview.stopped.join(', ')}. ¿Iniciarlos sin recrear contenedores ni volúmenes?`, false);
    if (allowed !== true) {
      return { ...preview, kind: 'block', reason: 'Recuperación cancelada: no se modificaron servicios' };
    }
    // Re-evaluate after the user's decision. A changed owner or stopped set
    // invalidates consent; the low-level recoverer independently checks again.
    const fresh = await this.previewStoppedRecovery(cwd);
    if (fresh.kind !== 'recoverable' || fresh.owner !== preview.owner ||
        JSON.stringify(fresh.stopped) !== JSON.stringify(preview.stopped)) {
      return { ...fresh, kind: 'block', reason: 'El estado cambió antes de iniciar los contenedores' };
    }
    const permitted = new SharedDependencyRecovery({ exec: this.exec, composeFile: this.composeFile,
      environment: { ...this.environment, COMPOSE_PROJECT_NAME: fresh.owner,
        PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY: 'true' } });
    return permitted.recoverOwnedStopped(cwd, options);
  }

  /**
   * Only starts already-owned, identity-verified stopped containers; never deletes,
   * recreates, changes volumes or restarts an active service.
   * Requires an explicit environment opt-in and an exact Compose project label.
   */
  async recoverOwnedStopped(cwd, { maxPolls = 40, intervalMs = 1000, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    const before = await this.plan(cwd);
    if (before.kind === 'reuse') return { ...before, recovered: [] };
    const owner = this.environment.COMPOSE_PROJECT_NAME;
    if (this.environment.PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY !== 'true' || !owner) {
      return { ...before, kind: 'block', reason: 'Autorecuperación no habilitada o proyecto Compose no identificado' };
    }
    const stopped = before.services.filter(s => s.state === 'stopped');
    if (!stopped.length || before.services.some(s => !['healthy', 'stopped'].includes(s.state)) ||
        before.services.some(s => s.owner !== owner)) {
      return { ...before, kind: 'block', reason: 'Un servicio no está detenido o no pertenece inequívocamente a este proyecto' };
    }
    const recovered = [];
    try {
      for (const service of stopped) {
        const fresh = await this.inspect(cwd);
        // Services started during this same operation may still be in Docker's
        // healthcheck warm-up phase. They are not foreign unhealthy services.
        // Never ignore identity changes; require every service healthy at the end.
        const alreadyStarted = new Set(recovered);
        if (fresh.find(s => s.name === service.name)?.state !== 'stopped' ||
            fresh.some(s => s.owner !== owner || s.state === 'conflict' || s.state === 'absent' ||
              (alreadyStarted.has(s.name)
                ? s.state === 'stopped'
                : !['healthy', 'stopped'].includes(s.state)))) {
          return { kind: 'block', services: fresh, recovered, reason: 'El estado de los contenedores cambió durante la comprobación' };
        }
        await this.exec('docker', ['start', service.name], { cwd, timeout: 15000 });
        recovered.push(service.name);
      }
      for (let attempt = 0; attempt < maxPolls; attempt++) {
        const services = await this.inspect(cwd);
        if (services.every(s => s.state === 'healthy')) return { kind: 'reuse', services, recovered };
        if (services.some(s => ['conflict', 'absent'].includes(s.state))) {
          return { kind: 'block', services, recovered, reason: 'La identidad o disponibilidad cambió tras iniciar el servicio' };
        }
        if (attempt + 1 < maxPolls) await wait(intervalMs);
      }
      return { kind: 'block', services: await this.inspect(cwd), recovered, reason: 'El servicio no alcanzó un estado saludable dentro del límite' };
    } catch (error) {
      return { kind: 'block', services: await this.inspect(cwd), recovered, reason: 'Fallo en el inicio controlado: ' + error.message };
    }
  }

  async plan(cwd) {
    const services = await this.inspect(cwd);
    if (services.some(s => s.state === 'conflict'))
      return { kind: 'block', services, reason: 'Shared container identity, image, port, volume or database configuration does not match' };
    if (services.every(s => s.state === 'healthy'))
      return { kind: 'reuse', services };
    if (services.every(s => s.state === 'absent'))
      return { kind: 'normal', services };
    return { kind: 'block', services, reason: 'Partial, unhealthy or stopped shared services require manual diagnosis' };
  }
}
