import { createSpinner } from 'nanospinner';
import { VerifyData } from './VerifyData.js';
import { DataSeeder } from './DataSeeder.js';
import { DatabaseHealth } from './DatabaseHealth.js';
import { GemInstaller } from './installers/GemInstaller.js';
import { LtiBootstrap } from '../lti.js';
import { pingCanvasAPI } from './utils/TokenManager.js';

export class PostflightSetup {
  constructor(boot, pluginDir, canvasDir) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
  }

  async runChecks() {
    this.boot.info('Iniciando verificación post-arranque de la Universidad y el plugin LTI');

    const verifier = new VerifyData(this.boot, this.canvasDir);
    const seeder = new DataSeeder(this.boot, this.pluginDir, this.canvasDir);

    const hasData = await verifier.isDataPopulated();

    if (!hasData) {
      this.boot.warn('Faltan los datos base de la Universidad. Intentando inyectar datos...');
      
      const gemInstaller = new GemInstaller(this.boot, this.canvasDir);
      const gemsOk = await gemInstaller.ensureBundlerPlugins();
      if (!gemsOk) {
        this.boot.error('No se pudieron instalar los plugins de Bundler requeridos.');
        return false;
      }
      
      const dbHealth = new DatabaseHealth(this.boot, this.canvasDir);
      await dbHealth.ensureDatabaseReady();
      
      const seeded = await seeder.seedData();
      if (!seeded) {
        this.boot.error('No se pudieron inyectar los datos base automáticamente.');
        return false;
      }
      
      const hasDataAfter = await verifier.isDataPopulated(1, 1);
      if (!hasDataAfter) {
        this.boot.error('La verificación final de datos falló incluso después de inyectar.');
        return false;
      }
    } else {
      this.boot.info('Datos base de la Universidad validados. Sincronizando tokens locales desde Docker...');
      await seeder._syncTokenFromContainer();
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
    
    this.boot.info('Ejecutando verificación LTI final...');
    const ltiBoot = new LtiBootstrap({ mode: '3', log: this.boot });
    const ltiRes = await ltiBoot.run();
    if (!ltiRes.ok && !ltiRes?.data?.skipped) {
      this.boot.error(`Verificación LTI falló en el Postflight: ${ltiRes.data?.error || ltiRes.message}`);
      return false;
    }
    
    this.boot.info('Verificación post-arranque exitosa.');
    return true;
  }
}
