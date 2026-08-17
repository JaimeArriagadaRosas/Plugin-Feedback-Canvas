import { boot } from '../logger.js';
import { DockerCheck } from './docker.js';
import { NodeCheck } from './node.js';
import { DependenciesCheck } from './dependencies.js';
import { EnvironmentDetector } from '../environment.js';

export class StaticChecker {
  constructor(pluginDir) {
    this.pluginDir = pluginDir;
  }

  async runCheck(stageName, checkFn) {
    return boot.withStage(stageName, async () => {
      const result = await checkFn();
      if (result.degraded && result.ok) {
        boot.warn(result.message);
        if (result.fix) boot.action(result.fix);
      } else if (!result.ok) {
        boot.error(result.message);
        if (result.fix) boot.action(result.fix);
      }
      return result;
    });
  }

  async runAll(mode) {
    const env = new EnvironmentDetector(this.pluginDir);

    env.ensureEnvFile(boot);
    env.ensureStartupVars(mode);

    if (process.env.FAST_BOOT === 'true') {
      const envRes = await this.runCheck('Environment variables', () => Promise.resolve(env.validate(boot, mode)));
      return { envRes, env };
    }

    const docker = new DockerCheck();
    const nodeChk = new NodeCheck();
    const deps = new DependenciesCheck(this.pluginDir);

    const dockerRes = await this.runCheck('Docker environment', () => docker.run(boot));
    const nodeRes = await this.runCheck('Node.js / NPM', () => nodeChk.run(boot));
    const depsRes = await this.runCheck('Plugin dependencies', () => deps.run(boot));
    const envRes = await this.runCheck('Environment variables', () => Promise.resolve(env.validate(boot, mode)));

    return { dockerRes, nodeRes, depsRes, envRes, env };
  }
}
