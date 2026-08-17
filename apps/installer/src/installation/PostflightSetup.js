import { createSpinner } from 'nanospinner';
import { VerifyData } from './VerifyData.js';
import { DataSeeder } from './DataSeeder.js';
import { DatabaseHealth } from './DatabaseHealth.js';
import { RubyDependencyInstaller } from './installers/RubyDependencyInstaller.js';
import { pingCanvasAPI } from './utils/TokenManager.js';

export class PostflightSetup {
  constructor(boot, pluginDir, canvasDir, {
    verifierFactory = (...args) => new VerifyData(...args),
    seederFactory = (...args) => new DataSeeder(...args),
    rubyDependencyInstallerFactory = (...args) => new RubyDependencyInstaller(...args),
    databaseHealthFactory = (...args) => new DatabaseHealth(...args)
  } = {}) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.verifierFactory = verifierFactory;
    this.seederFactory = seederFactory;
    this.rubyDependencyInstallerFactory = rubyDependencyInstallerFactory;
    this.databaseHealthFactory = databaseHealthFactory;
  }

  async runChecks() {
    this.boot.info('Starting post-startup verification of the University and the LTI plugin');

    const verifier = this.verifierFactory(this.boot, this.canvasDir);
    const seeder = this.seederFactory(this.boot, this.pluginDir, this.canvasDir);

    const hasData = await verifier.isDataPopulated();

    if (!hasData) {
      this.boot.warn('Faltan los datos base de la Universidad. Intentando inyectar datos...');

      const rubyDependencyInstaller = this.rubyDependencyInstallerFactory(this.boot, this.canvasDir);
      const gemsOk = await rubyDependencyInstaller.ensureBundlerPlugins();
      if (!gemsOk) {
        this.boot.error('No se pudieron instalar los plugins de Bundler requeridos.');
        return false;
      }

      const dbHealth = this.databaseHealthFactory(this.boot, this.canvasDir);
      await dbHealth.ensureDatabaseReady();

      const seeded = await seeder.seedData();
      if (!seeded) {
        this.boot.error('Could not automatically inject base data.');
        return false;
      }

      const hasDataAfter = await verifier.isDataPopulated(3, 5);
      if (!hasDataAfter) {
        this.boot.error('Final data verification failed even after injecting.');
        return false;
      }
    } else {
      this.boot.info('Datos base de la Universidad validados. Sincronizando tokens locales desde Docker...');
      await seeder.synchronizeLocalToken();
    }

    // Verify that Canvas is responding before continuing with the LTI phase.
    // El healTokenViaFile se realiza dentro de LtiBootstrap → TeacherTokenGenerator,
    // which is solely responsible for token management (DRY principle).
    const spinner = createSpinner('Verifying connectivity with Canvas...').start();
    const { ready, error: pingError } = await pingCanvasAPI();
    if (!ready) {
      spinner.warn({ text: `Canvas is not responding yet (${pingError || 'timeout'}). The token will be validated during LTI initialization.`, mark: '  !' });
    } else {
      spinner.success({ text: 'Canvas is responding correctly.', mark: '  √' });
    }


    this.boot.info('Post-startup verification successful.');
    return true;
  }
}
