import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import * as yaml from 'js-yaml';

const ESSENTIAL_CONFIG_FILES = [
  'database.yml', 'domain.yml', 'security.yml', 'dynamic_settings.yml',
  'cache_store.yml', 'redis.yml', 'outgoing_mail.yml', 'delayed_jobs.yml'
];

const DEFAULT_VOLUMES = [
  '.:/usr/src/app',
  'canvas-bundle-gems:/home/docker/.gem',
  'canvas-bundle-plugin:/home/docker/.bundle',
  'canvas-log:/usr/src/app/log',
  'canvas-tmp:/usr/src/app/tmp'
];

export class CanvasLocalConfiguration {
  constructor(boot, canvasDir, { fileSystem = fs, yamlParser = yaml } = {}) {
    this.boot = boot;
    this.canvasDir = canvasDir;
    this.fs = fileSystem;
    this.yaml = yamlParser;
  }

  configure(resourceLimits) {
    this._ensureLocalConfig();
    this._patchDomainForLocalDev();
    this._writeComposeOverride(resourceLimits);
  }

  _patchDomainForLocalDev() {
    const domainYml = path.join(this.canvasDir, 'config', 'domain.yml');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!this.fs.existsSync(domainYml)) return;

    const canvasDomain = process.env.CANVAS_DOMAIN || 'localhost:8443';
    const content = [
      'test:',
      '  domain: localhost',
      '',
      'development:',
      `  domain: "${canvasDomain}"`,
      '  ssl: true',
      '',
      'production:',
      '  domain: "canvas.example.com"',
      '  ssl: true',
      ''
    ].join('\n');

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    this.fs.writeFileSync(domainYml, content, 'utf-8');
  }

  _ensureLocalConfig() {
    const configDir = path.join(this.canvasDir, 'config');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!this.fs.existsSync(configDir)) return;

    for (const name of ESSENTIAL_CONFIG_FILES) {
      const target = path.join(configDir, name);
      const example = path.join(configDir, `${name}.example`);
      const dockerTemplate = path.join(this.canvasDir, 'docker-compose', 'config', name);
      const source = this._getConfigSource(dockerTemplate, example);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (source && (!this.fs.existsSync(target) || this._matchesTemplate(target, example))) {
        this.fs.copyFileSync(source, target);
      }
    }
  }

  _getConfigSource(dockerTemplate, example) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (this.fs.existsSync(dockerTemplate)) return dockerTemplate;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return this.fs.existsSync(example) ? example : null;
  }

  _matchesTemplate(target, example) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!this.fs.existsSync(example)) return false;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      return this.fs.readFileSync(target, 'utf8') === this.fs.readFileSync(example, 'utf8');
    } catch (error) {
      this.boot.warn(`No se pudo verificar la plantilla de Canvas: ${error}`);
      return false;
    }
  }

  _writeComposeOverride(resourceLimits) {
    const overrideFile = path.join(this.canvasDir, 'docker-compose.override.yml');
    const override = this._readComposeOverride(overrideFile);
    if (!override) return;

    override.services = override.services || {};
    override.volumes = override.volumes || {};
    this._adoptExistingEncryptionKey(override.services);
    override.services.jobs = this._configureJobs(override.services.jobs, resourceLimits);
    override.services.web = this._configureWeb(override.services.web, resourceLimits);
    override.volumes['canvas-bundle-gems'] = override.volumes['canvas-bundle-gems'] || null;
    override.volumes['canvas-bundle-plugin'] = override.volumes['canvas-bundle-plugin'] || null;
    override.volumes['canvas-log'] = override.volumes['canvas-log'] || null;
    override.volumes['canvas-tmp'] = override.volumes['canvas-tmp'] || null;

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      this.fs.writeFileSync(overrideFile, this.yaml.dump(override));
    } catch (error) {
      this.boot.warn(`Error escribiendo docker-compose.override.yml: ${error}`);
    }
  }

  _readComposeOverride(overrideFile) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!this.fs.existsSync(overrideFile)) return { services: {}, volumes: {} };
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      return this.yaml.load(this.fs.readFileSync(overrideFile, 'utf8')) || { services: {}, volumes: {} };
    } catch (error) {
      this.boot.warn(`Error leyendo docker-compose.override.yml: ${error}`);
      return null;
    }
  }

  _configureJobs(service = {}, resourceLimits) {
    const configured = this._withResourceLimits(service, resourceLimits.jobs, '1');
    configured.environment = this._canvasEnvironment(configured.environment);
    return configured;
  }

  _configureWeb(service = {}, resourceLimits) {
    const configured = this._withResourceLimits(service, resourceLimits.web, '2');
    configured.ports = configured.ports || ['8080:80'];
    configured.environment = {
      ...this._canvasEnvironment(configured.environment),
      RSPACK: 'true',
      CANVAS_LTI_COURSE_NAVIGATION: 'true'
    };
    return configured;
  }

  _canvasEnvironment(environment = {}) {
    return {
      ...environment,
      ENCRYPTION_KEY: environment.ENCRYPTION_KEY || this._getCanvasEncryptionKey(),
      RAILS_ENV: environment.RAILS_ENV || 'development'
    };
  }

  _adoptExistingEncryptionKey(services) {
    const webKey = services.web?.environment?.ENCRYPTION_KEY;
    const jobsKey = services.jobs?.environment?.ENCRYPTION_KEY;
    const existingKey = webKey || jobsKey;
    if (typeof existingKey === 'string' && existingKey.trim()) {
      this.canvasEncryptionKey = existingKey;
    }
  }

  _getCanvasEncryptionKey() {
    if (!this.canvasEncryptionKey) this.canvasEncryptionKey = randomBytes(32).toString('hex');
    return this.canvasEncryptionKey;
  }

  _withResourceLimits(service, memory, cpus) {
    const deploy = service.deploy || {};
    const resources = deploy.resources || {};
    const limits = resources.limits || {};
    return {
      ...service,
      deploy: {
        ...deploy,
        resources: { ...resources, limits: { ...limits, memory, cpus } }
      },
      volumes: this._mergeVolumes(service.volumes)
    };
  }

  _mergeVolumes(volumes = []) {
    const configured = [...volumes];
    for (const volume of DEFAULT_VOLUMES) {
      const mountPath = volume.substring(volume.lastIndexOf(':') + 1);
      if (!configured.some((entry) => entry.endsWith(`:${mountPath}`))) configured.push(volume);
    }
    return configured;
  }
}
