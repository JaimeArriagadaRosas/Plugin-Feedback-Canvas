import { askConfirm } from '../../cli.js';
import { BootResult } from '../result.js';
import { createDockerPolicy } from '../../../platform/shared/DockerPolicyFactory.js';
import { DockerRuntimeProbe, DockerRuntimeStatus } from '../../../platform/shared/DockerRuntimeProbe.js';
import { WindowsDockerMemoryConfigurator } from '../../../platform/windows/WindowsDockerMemoryConfigurator.js';

export class DockerCheck {
  constructor(minRamGb = 7.5, {
    probe = new DockerRuntimeProbe(),
    confirm = askConfirm,
    memoryConfigurator = new WindowsDockerMemoryConfigurator()
  } = {}) {
    this.minRamGb = minRamGb;
    this.probe = probe;
    this.confirm = confirm;
    this.memoryConfigurator = memoryConfigurator;
  }

  _failure(log, state, guidance, message) {
    log.error(guidance.message);
    log.action(guidance.action);
    return BootResult.fail(true, message, guidance.fix, {
      platform: state.host.name,
      isWsl: state.host.isWsl,
      backend: state.backend || null,
      cliOrigin: state.cliOrigin
    });
  }

  async _handleLowMemory(log, state, policy) {
    if (state.memoryGb === null || state.memoryGb >= this.minRamGb) return state;
    log.warn(`Current Docker RAM: ${state.memoryGb.toFixed(1)}GB (recommended: 8GB).`);
    log.action(policy.memory(state).action);
    if (!state.host.isWindows) return state;

    const accepted = await this.confirm('Docker has less than 8GB. Configure 8GB in .wslconfig?');
    if (!accepted) return state;
    await this.memoryConfigurator.configure(log);
    return (await this.probe.waitUntilActive({ timeoutSeconds: 60 })) || state;
  }

  async run(log) {
    let state = await this.probe.inspect();
    const policy = createDockerPolicy(state.host);

    if (state.status === DockerRuntimeStatus.MISSING) {
      return this._failure(log, state, policy.missing(state), 'Docker not installed');
    }

    log.info(`Docker CLI available (${state.backend}; origin: ${state.cliOrigin}).`);
    if (state.status === DockerRuntimeStatus.PERMISSION_DENIED) {
      return this._failure(log, state, policy.permission(state), 'Insufficient permissions for Docker');
    }
    if (state.status === DockerRuntimeStatus.DAEMON_DOWN) {
      return this._failure(log, state, policy.daemon(state), 'Docker daemon stopped');
    }

    state = await this._handleLowMemory(log, state, policy);
    const memory = state.memoryGb === null ? '' : ` (${state.memoryGb.toFixed(1)}GB RAM)`;
    log.success(`Docker daemon active${memory}.`);
    return BootResult.ok({
      backend: state.backend,
      cliOrigin: state.cliOrigin,
      composeAvailable: state.composeAvailable,
      memoryGb: state.memoryGb,
      platform: state.host.name,
      isWsl: state.host.isWsl
    });
  }
}
