import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CanvasLocalConfiguration } from '../../src/installation/installers/CanvasLocalConfiguration.js';

const temporaryDirectories = [];

function createCanvasDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-local-config-'));
  temporaryDirectories.push(directory);
  fs.mkdirSync(path.join(directory, 'config'));
  return directory;
}

afterEach(() => {
  while (temporaryDirectories.length) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

describe('CanvasLocalConfiguration', () => {
  it('solo crea configuracion ausente y conserva la configuracion local existente', () => {
    const canvasDir = createCanvasDirectory();
    const configDir = path.join(canvasDir, 'config');
    fs.writeFileSync(path.join(configDir, 'database.yml'), 'development:\n  host: custom-db\n');
    fs.writeFileSync(path.join(configDir, 'consul.yml'), 'preserve: true\n');
    fs.writeFileSync(path.join(configDir, 'domain.yml.example'), 'development:\n  domain: example.test\n');
    fs.writeFileSync(path.join(configDir, 'redis.yml.example'), 'development:\n  host: redis\n');
    fs.writeFileSync(path.join(canvasDir, 'docker-compose.override.yml'), yaml.dump({
      services: { web: { deploy: { labels: ['keep-me'] }, environment: { CUSTOM: 'true' } } }
    }));
    const boot = { warn: vi.fn() };

    new CanvasLocalConfiguration(boot, canvasDir).configure({ web: '4G', jobs: '1G' });

    expect(fs.readFileSync(path.join(configDir, 'database.yml'), 'utf8')).toContain('custom-db');
    expect(fs.readFileSync(path.join(configDir, 'consul.yml'), 'utf8')).toContain('preserve: true');
    expect(fs.existsSync(path.join(configDir, 'domain.yml'))).toBe(true);
    expect(fs.existsSync(path.join(configDir, 'redis.yml'))).toBe(true);
    const override = yaml.load(fs.readFileSync(path.join(canvasDir, 'docker-compose.override.yml'), 'utf8'));
    expect(override.services.web.deploy.labels).toEqual(['keep-me']);
    expect(override.services.web.deploy.resources.limits).toMatchObject({ memory: '4G', cpus: '2' });
    expect(override.services.web.environment).toMatchObject({ CUSTOM: 'true', RSPACK: 'true' });
    expect(override.services.web.environment.ENCRYPTION_KEY).toMatch(/^[a-f0-9]{64}$/);
    expect(override.services.jobs.environment.ENCRYPTION_KEY)
      .toBe(override.services.web.environment.ENCRYPTION_KEY);
    expect(override.services.jobs.deploy.resources.limits).toMatchObject({ memory: '1G', cpus: '1' });
    expect(override.services.web.volumes).toContain('canvas-bundle-plugin:/home/docker/.bundle');
    expect(override.services.jobs.volumes).toContain('canvas-log:/usr/src/app/log');
    expect(override.volumes).toMatchObject({ 'canvas-log': null, 'canvas-tmp': null });
  });

  it('no reemplaza un override que no puede interpretar', () => {
    const canvasDir = createCanvasDirectory();
    const overrideFile = path.join(canvasDir, 'docker-compose.override.yml');
    fs.writeFileSync(overrideFile, 'services: [invalid');
    const boot = { warn: vi.fn() };

    new CanvasLocalConfiguration(boot, canvasDir).configure({ web: '4G', jobs: '1G' });

    expect(fs.readFileSync(overrideFile, 'utf8')).toBe('services: [invalid');
    expect(boot.warn).toHaveBeenCalledOnce();
  });

  it('conserva la clave de cifrado existente y la comparte con jobs', () => {
    const canvasDir = createCanvasDirectory();
    const key = 'a'.repeat(64);
    fs.writeFileSync(path.join(canvasDir, 'docker-compose.override.yml'), yaml.dump({
      services: { web: { environment: { ENCRYPTION_KEY: key } } }
    }));

    new CanvasLocalConfiguration({ warn: vi.fn() }, canvasDir).configure({ web: '4G', jobs: '1G' });

    const override = yaml.load(fs.readFileSync(path.join(canvasDir, 'docker-compose.override.yml'), 'utf8'));
    expect(override.services.web.environment.ENCRYPTION_KEY).toBe(key);
    expect(override.services.jobs.environment.ENCRYPTION_KEY).toBe(key);
  });

  it('prefiere las plantillas Docker oficiales y reemplaza solo una copia intacta del ejemplo', () => {
    const canvasDir = createCanvasDirectory();
    const configDir = path.join(canvasDir, 'config');
    const dockerConfigDir = path.join(canvasDir, 'docker-compose', 'config');
    fs.mkdirSync(dockerConfigDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'database.yml.example'), 'development:\n  host: localhost\n');
    fs.writeFileSync(path.join(configDir, 'database.yml'), 'development:\n  host: localhost\n');
    fs.writeFileSync(path.join(dockerConfigDir, 'database.yml'), 'development:\n  host: postgres\n');
    const boot = { warn: vi.fn() };

    new CanvasLocalConfiguration(boot, canvasDir).configure({ web: '4G', jobs: '1G' });

    expect(fs.readFileSync(path.join(configDir, 'database.yml'), 'utf8')).toContain('postgres');
  });
});
