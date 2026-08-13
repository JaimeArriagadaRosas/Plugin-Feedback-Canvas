import { LinuxDistributionProbe } from './LinuxDistributionProbe.js';

const CONFLICTING_PACKAGES = [
  'docker.io',
  'docker-compose',
  'docker-compose-v2',
  'docker-doc',
  'podman-docker',
  'containerd',
  'runc'
];

const DOCKER_PACKAGES = [
  'docker-ce',
  'docker-ce-cli',
  'containerd.io',
  'docker-buildx-plugin',
  'docker-compose-plugin',
  'docker-ce-rootless-extras'
];

export class LinuxAptDockerInstaller {
  constructor({ runner, logFile, distributionProbe = new LinuxDistributionProbe() }) {
    this.runner = runner;
    this.logFile = logFile;
    this.distributionProbe = distributionProbe;
  }

  async _runRoot(command, args, { input } = {}) {
    return this.runner('sudo', [command, ...args], {
      logFile: this.logFile,
      input,
      interactive: input === undefined
    });
  }

  async _findConflicts() {
    const installed = [];
    for (const packageName of CONFLICTING_PACKAGES) {
      const result = await this.runner('dpkg-query', ['-W', '-f=${Status}', packageName], {
        captureAll: true
      });
      if (result.success && result.out.includes('install ok installed')) installed.push(packageName);
    }
    return installed;
  }

  async _configureRepository(distribution) {
    const architecture = await this.runner('dpkg', ['--print-architecture'], { captureAll: true });
    if (!architecture.success || !architecture.out.trim()) return architecture;

    const keyDirectory = await this._runRoot('install', ['-m', '0755', '-d', '/etc/apt/keyrings']);
    if (!keyDirectory.success) return keyDirectory;
    const key = await this._runRoot('curl', [
      '-fsSL',
      `https://download.docker.com/linux/${distribution.repository}/gpg`,
      '-o',
      '/etc/apt/keyrings/docker.asc'
    ]);
    if (!key.success) return key;
    const permissions = await this._runRoot('chmod', ['a+r', '/etc/apt/keyrings/docker.asc']);
    if (!permissions.success) return permissions;

    const source = [
      'Types: deb',
      `URIs: https://download.docker.com/linux/${distribution.repository}`,
      `Suites: ${distribution.codename}`,
      'Components: stable',
      `Architectures: ${architecture.out.trim()}`,
      'Signed-By: /etc/apt/keyrings/docker.asc',
      ''
    ].join('\n');
    return this._runRoot('tee', ['/etc/apt/sources.list.d/docker.sources'], { input: source });
  }

  async install() {
    const distribution = this.distributionProbe.inspect();
    if (!distribution.repository || !distribution.codename) {
      return {
        success: false,
        err: 'La distribución APT no está soportada oficialmente por el repositorio Docker.'
      };
    }

    const conflicts = await this._findConflicts();
    if (conflicts.length > 0) {
      return {
        success: false,
        err: `Paquetes Docker conflictivos detectados: ${conflicts.join(', ')}. Elimínelos explícitamente antes de continuar.`
      };
    }

    const update = await this._runRoot('apt-get', ['update']);
    if (!update.success) return update;
    const prerequisites = await this._runRoot('apt-get', ['install', '-y', 'ca-certificates', 'curl']);
    if (!prerequisites.success) return prerequisites;
    const repository = await this._configureRepository(distribution);
    if (!repository.success) return repository;
    const refresh = await this._runRoot('apt-get', ['update']);
    if (!refresh.success) return refresh;
    return this._runRoot('apt-get', ['install', '-y', ...DOCKER_PACKAGES]);
  }
}
