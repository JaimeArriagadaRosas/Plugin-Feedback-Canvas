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
    this.boot.info('Iniciando verificación post-arranque de la Universidad y el plugin LTI');

    const verifier = this.verifierFactory(this.boot, this.canvasDir);
    const seeder = this.seederFactory(this.boot, this.pluginDir, this.canvasDir);

    const hasData = await verifier.isDataPopulated();

    if (!hasData) {
      this.boot.warn('Faltan los datos base de la Universidad. Intentando inyectar datos...');
      
      const gemInstaller = this.gemInstallerFactory(this.boot, this.canvasDir);
      const gemsOk = await gemInstaller.ensureBundlerPlugins();
      if (!gemsOk) {
        this.boot.error('No se pudieron instalar los plugins de Bundler requeridos.');
        return false;
      }
      
      const dbHealth = this.databaseHealthFactory(this.boot, this.canvasDir);
      await dbHealth.ensureDatabaseReady();
      
      const seeded = await seeder.seedData();
      if (!seeded) {
        this.boot.error('No se pudieron inyectar los datos base automáticamente.');
        return false;
      }
      
      const hasDataAfter = await verifier.isDataPopulated(3, 5);
      if (!hasDataAfter) {
        this.boot.error('La verificación final de datos falló incluso después de inyectar.');
        return false;
      }
    } else {
      this.boot.info('Datos base de la Universidad validados. Sincronizando tokens locales desde Docker...');
      await seeder.synchronizeLocalToken();
    }

    // Verificar que Canvas esté respondiendo antes de continuar con la fase LTI.
    // El healTokenViaFile se realiza dentro de LtiBootstrap → TeacherTokenGenerator,
    // que es el único responsable de gestión de tokens (principio DRY).
    const spinner = createSpinner('Verificando conectividad con Canvas...').start();
    const { ready, error: pingError } = await pingCanvasAPI();
    if (!ready) {
      spinner.warn({ text: `Canvas no está respondiendo aún (${pingError || 'timeout'}). El token se validará durante la inicialización LTI.`, mark: '  !' });
    } else {
      spinner.success({ text: 'Canvas responde correctamente.', mark: '  √' });
    }

    
    this.boot.info('Verificación post-arranque exitosa.');
    return true;
  }
}
