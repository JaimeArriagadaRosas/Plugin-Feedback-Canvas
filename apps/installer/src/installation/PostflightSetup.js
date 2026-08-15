import { createSpinner } from 'nanospinner';
import { VerifyData } from './VerifyData.js';
import { DataSeeder } from './DataSeeder.js';
import { DatabaseHealth } from './DatabaseHealth.js';
import { GemInstaller } from './installers/GemInstaller.js';
import { pingCanvasAPI } from './utils/TokenManager.js';

export class PostflightSetup {
  constructor(boot, pluginDir, canvasDir, {
    verifierFactory = (...args) => new VerifyData(...args),
    seederFactory = (...args) => new DataSeeder(...args),
    gemInstallerFactory = (...args) => new GemInstaller(...args),
    databaseHealthFactory = (...args) => new DatabaseHealth(...args)
  } = {}) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.verifierFactory = verifierFactory;
    this.seederFactory = seederFactory;
    this.gemInstallerFactory = gemInstallerFactory;
    this.databaseHealthFactory = databaseHealthFactory;
  }

  async runChecks() {
    this.boot.info('Starting post-boot verification of the University and the LTI plugin');

    const verifier = this.verifierFactory(this.boot, this.canvasDir);
    const seeder = this.seederFactory(this.boot, this.pluginDir, this.canvasDir);

    const hasData = await verifier.isDataPopulated();

    if (!hasData) {
      this.boot.warn('Missing base University data. Attempting to inject data...');
      
      const gemInstaller = this.gemInstallerFactory(this.boot, this.canvasDir);
      const gemsOk = await gemInstaller.ensureBundlerPlugins();
      if (!gemsOk) {
        this.boot.error('Failed to install required Bundler plugins.');
        return false;
      }
      
      const dbHealth = this.databaseHealthFactory(this.boot, this.canvasDir);
      await dbHealth.ensureDatabaseReady();
      
      const seeded = await seeder.seedData();
      if (!seeded) {
        this.boot.error('Failed to automatically inject base data.');
        return false;
      }
      
      const hasDataAfter = await verifier.isDataPopulated(3, 5);
      if (!hasDataAfter) {
        this.boot.error('Final data verification failed even after injection.');
        return false;
      }
    } else {
      this.boot.info('University base data validated. Synchronizing local tokens from Docker...');
      await seeder.synchronizeLocalToken();
    }

    // Verify that Canvas is responding before continuing with the LTI phase.
    // The healTokenViaFile is performed inside LtiBootstrap → TeacherTokenGenerator,
    // which is solely responsible for token management (DRY principle).
    const spinner = createSpinner('Verifying connectivity with Canvas...').start();
    const { ready, error: pingError } = await pingCanvasAPI();
    if (!ready) {
      spinner.warn({ text: `Canvas is not responding yet (${pingError || 'timeout'}). The token will be validated during LTI initialization.`, mark: '  !' });
    } else {
      spinner.success({ text: 'Canvas is responding correctly.', mark: '  √' });
    }

    
    this.boot.info('Post-boot verification successful.');
    return true;
  }
}
