import { execa } from 'execa';

// This module never creates, stops, removes or renames containers.
const SHARED = Object.freeze([
  { service: 'db', name: 'feedback_plugin_db_local', image: 'postgres:15-alpine', port: '5432/tcp', hostPort: '5432' },
  { service: 'gotenberg', name: 'feedback_plugin_gotenberg_local', image: 'gotenberg/gotenberg:8', port: '3000/tcp', hostPort: '3001' }
]);
const getEnv = (items, key) => items.find(item => item.startsWith(key + '='))?.slice(key.length + 1);
const portMatches = (data, entry, expected) =>
  data.NetworkSettings?.Ports?.[entry.port]?.some(port => String(port.HostPort) === String(expected)) === true;

export class SharedDependencyRecovery {
  constructor({ exec = execa, environment = process.env } = {}) {
    this.exec = exec;
    this.environment = environment;
  }

  async inspect(cwd) {
    const services = [];
    for (const entry of SHARED) {
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

      const identityOk = !!owner && actualService === entry.service && imageOk && portOk && configurationOk;
      services.push({
        service: entry.service, name: entry.name, owner,
        state: !identityOk ? 'conflict' : !running || !healthy ? 'unavailable' : 'healthy'
      });
    }
    return services;
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
