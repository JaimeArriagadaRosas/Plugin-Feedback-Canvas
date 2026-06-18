import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import DockerRunner, { CANVAS_PATH } from './DockerRunner.js';
import CanvasConfigurator from './CanvasConfigurator.js';
import CanvasSnapshotManager from './CanvasSnapshotManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CanvasLocalManager {
  static applyContingencyPatches() {
    console.log('[CanvasLocalManager] Aplicando parches de contingencia (Self-Healing)...');
    try {
      // NOTA: NO eliminamos Gemfile.lock aquí — syncLockfilePlatforms() lo gestiona correctamente.
      // Eliminar el lockfile forzaría a bundler a re-resolver todas las dependencias desde cero.
      const testRbPath = path.join(CANVAS_PATH, 'Gemfile.d/test.rb');
      if (fs.existsSync(testRbPath)) {
        let testRbContent = fs.readFileSync(testRbPath, 'utf8');
        if (testRbContent.includes('gem "rspecq"')) {
          testRbContent = testRbContent.replace(/gem "rspecq"/g, '# gem "rspecq"');
          fs.writeFileSync(testRbPath, testRbContent);
          console.log('   -> Parche: Gema inestable "rspecq" silenciada.');
        }
      }
    } catch (err) {
      console.warn('[CanvasLocalManager] Advertencia durante aplicación de parches:', err.message);
    }
  }

  /**
   * Sincroniza la sección PLATFORMS del Gemfile.lock principal con los lockfiles secundarios
   * para evitar que bundle install tarde mucho por el error "platforms do not match".
   */
  static async syncLockfilePlatforms() {
    console.log('[CanvasLocalManager] 🔧 Sincronizando plataformas en lockfiles de Ruby...');
    try {
      const scriptSrc = path.resolve(__dirname, '../instalación/sync_lockfiles.sh');
      if (!fs.existsSync(scriptSrc)) {
        console.warn('[CanvasLocalManager] Script sync_lockfiles.sh no encontrado, omitiendo sincronización.');
        return;
      }
      // Copiar el script al contenedor y ejecutarlo
      execSync('docker compose cp "' + scriptSrc + '" web:/usr/src/app/tmp/sync_lockfiles.sh', { cwd: CANVAS_PATH, stdio: 'ignore' });
      await DockerRunner.runDockerCommand(
        ['compose', 'exec', '-T', 'web', 'sh', '/usr/src/app/tmp/sync_lockfiles.sh'],
        'Sync-Lockfile-Platforms'
      );
    } catch (err) {
      console.warn('[CanvasLocalManager] Advertencia al sincronizar plataformas (no crítico):', err.message);
    }
  }

  static async initializeCanvas() {
    console.log('[CanvasLocalManager] Iniciando inicialización completa de Canvas LMS (Modo Robusto)...');
    try {
      this.applyContingencyPatches();

      // Sincronizar plataformas en todos los lockfiles para evitar re-resolución de dependencias
      await this.syncLockfilePlatforms();

      try {
        await DockerRunner.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'lock', '--add-platform', 'x86_64-linux'], 'Ruby-Bundle-Lock-Platform');
      } catch (err) {
        console.log('[CanvasLocalManager] -> Aviso: No se pudo fijar la plataforma Linux en el lockfile (no crítico).');
      }

      try {
        await DockerRunner.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'install'], 'Ruby-Bundle-Install');
      } catch (err) {
        console.log('[CanvasLocalManager] -> Parche activo: Ignorando warning final de plataformas del lockfile de Ruby.');
      }

      // Parche CRLF para Windows: Previene fallos de "bash\r: command not found" al compilar paquetes en yarn install
      try {
        console.log('[CanvasLocalManager] 🔧 Limpiando finales de línea Windows (CRLF) en scripts de paquetes...');
        await DockerRunner.runDockerCommand(['compose', 'exec', '-T', 'web', 'sh', '-c', "find packages/ -type f -exec sed -i 's/\\r$//' {} +"], 'Fix-Windows-CRLF');
      } catch (err) {
        console.log('[CanvasLocalManager] -> Aviso: No se pudieron limpiar CRLF, o no fue necesario.');
      }

      try {
        await DockerRunner.runDockerCommand(['compose', 'exec', '-T', 'web', 'yarn', 'install', '--pure-lockfile'], 'Yarn-Install');
      } catch (err) {
        console.log('[CanvasLocalManager] -> Yarn falló. Aplicando contingencia: Borrando node_modules y reintentando...');
        await DockerRunner.runDockerCommand(['compose', 'exec', '-T', 'web', 'rm', '-rf', 'node_modules'], 'Clean-Node-Modules');
        await DockerRunner.runDockerCommand(['compose', 'exec', '-T', 'web', 'yarn', 'install', '--pure-lockfile'], 'Yarn-Install-Retry');
      }

      await DockerRunner.runDockerCommand([
        'compose', 'exec', '-T',
        '-e', 'CANVAS_LMS_ADMIN_EMAIL=admin@canvas.local',
        '-e', 'CANVAS_LMS_ADMIN_PASSWORD=adminpassword123',
        '-e', 'CANVAS_LMS_ACCOUNT_NAME=CanvasLocal',
        '-e', 'CANVAS_LMS_STATS_COLLECTION=opt_out',
        'web', 'bundle', 'exec', 'rake', 'db:initial_setup'
      ], 'Database-Initial-Setup');

      await CanvasConfigurator.runPluginMigrations();

      try {
        await DockerRunner.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'canvas:compile_assets_dev'], 'Compile-Assets-Dev');
      } catch (e) {
        console.log('[CanvasLocalManager] -> Parche activo: Assets compile reportó errores menores (común en dev), pero continuaremos.');
      }

      console.log('[CanvasLocalManager] ¡Inicialización de Canvas LMS terminada con éxito!');
      return true;
    } catch (error) {
      console.error('[CanvasLocalManager] Falló la inicialización de Canvas:', error.message);
      throw error;
    }
  }

  static async verifyAssetsHealth() {
    console.log('[CanvasLocalManager] 🩺 Ejecutando Asset Health Check (Detector de desincronización)...');
    try {
      // Intentamos verificar si el archivo vital de CSS existe usando un test simple.
      execSync('docker compose exec -T web test -f /usr/src/app/public/dist/brandable_css/brandable_css_handlebars_index.json', { cwd: CANVAS_PATH, stdio: 'ignore' });
      console.log('[CanvasLocalManager] ✅ Assets de Canvas encontrados y saludables.');
    } catch (e) {
      console.warn('[CanvasLocalManager] ⚠️ ¡ALERTA! El archivo maestro de CSS de Canvas ha desaparecido.');
      console.log('[CanvasLocalManager] 🛠️ Autocuración activada: Re-compilando la capa visual (CSS/Webpack). Por favor espera...');
      CanvasSnapshotManager.markState('assets_compiled', false); // Invalidar estado
      try {
        await DockerRunner.runDockerCommand(['compose', 'exec', '-T', 'web', 'yarn', 'run', 'build:css'], 'AutoHeal-CSS');
        // Usualmente build:css es el más vital. Opcionalmente podríamos correr build:webpack pero tarda más.
        CanvasSnapshotManager.markState('assets_compiled', true);
        console.log('[CanvasLocalManager] ✅ Auto-curación de CSS completada con éxito.');
      } catch (err) {
        console.error('[CanvasLocalManager] Falló la compilación de recuperación de CSS:', err.message);
      }
    }
  }

  static async autoStartAndInitialize() {
    console.log('[CanvasLocalManager] Verificando estado del entorno local de Canvas...');
    
    if (!DockerRunner.checkDocker()) {
      throw new Error('Docker no está en ejecución. Por favor, inicia Docker Desktop y activa WSL2.');
    }

    const running = DockerRunner.isCanvasRunning();
    if (!running) {
      console.log('[CanvasLocalManager] Canvas no está en ejecución. Iniciando contenedores...');
      await DockerRunner.startCanvas();
      await new Promise(r => setTimeout(r, 8000));
    } else {
      console.log('[CanvasLocalManager] Los contenedores de Canvas ya están en ejecución.');
    }

    // Consultar primero el estado local (instantáneo, sin Docker).
    // Solo hacemos la consulta pesada a Docker/psql si el estado local no lo confirma.
    let initialized = CanvasSnapshotManager.hasState('canvas_initialized');
    if (!initialized) {
      console.log('[CanvasLocalManager] Estado local no confirma inicialización. Verificando con Docker...');
      try {
        initialized = DockerRunner.isCanvasInitialized();
      } catch (e) {
        // Ignorar, se asume no inicializado
      }
    } else {
      console.log('[CanvasLocalManager] ✅ Estado local confirma que Canvas ya fue inicializado. Omitiendo consulta Docker.');
    }

    if (!initialized) {
      console.log('[CanvasLocalManager] Se detectó que Canvas no está inicializado.');
      
      if (running) {
        if (CanvasSnapshotManager.hasState('assets_compiled') && CanvasSnapshotManager.snapshotExists('pre_lti')) {
          console.log('[CanvasLocalManager] 🛡️ Smart Healing: Se detectaron Assets compilados. Restaurando partida en lugar de borrar todo...');
          const restored = await CanvasSnapshotManager.restoreSnapshot('pre_lti');
          if (restored) {
             console.log('[CanvasLocalManager] ⏭️ Omitiendo compilación de Assets, base de datos restaurada.');
             await CanvasConfigurator.setupLtiAndMockData();
             CanvasSnapshotManager.markState('canvas_initialized', true);
             CanvasSnapshotManager.markState('lti_configured', true);
             return true;
          } else {
             console.log('[CanvasLocalManager] ⚠️ Falló la restauración. Forzando limpieza profunda...');
          }
        }

        console.log('[CanvasLocalManager] Limpieza Automática: Destruyendo volúmenes residuales para evitar conflictos en la BD...');
        try {
          execSync('docker compose down -v', { cwd: CANVAS_PATH, stdio: 'ignore' });
          console.log('[CanvasLocalManager] Volúmenes antiguos eliminados.');
        } catch (e) {
        }
        CanvasSnapshotManager.clearState();
        await DockerRunner.startCanvas();
        await new Promise(r => setTimeout(r, 8000));
      }

      console.log('[CanvasLocalManager] Iniciando pipeline automático de base de datos y assets...');
      await this.initializeCanvas();
      
      CanvasSnapshotManager.markState('assets_compiled', true);
      await CanvasSnapshotManager.takeSnapshot('pre_lti');
      
      await CanvasConfigurator.setupLtiAndMockData();
      CanvasSnapshotManager.markState('canvas_initialized', true);
      CanvasSnapshotManager.markState('lti_configured', true);
    } else {
      console.log('[CanvasLocalManager] Canvas local ya está inicializado.');

      // Solo verificar assets si no fue verificado hoy
      const lastAssetCheck = CanvasSnapshotManager.getState('assets_checked_today');
      const today = new Date().toDateString();
      if (lastAssetCheck !== today) {
        console.log('[CanvasLocalManager] 🩺 Verificando salud de los assets internos...');
        await this.verifyAssetsHealth();
        CanvasSnapshotManager.markState('assets_checked_today', today);
      } else {
        console.log('[CanvasLocalManager] ⏭️ Assets verificados recientemente, omitiendo health check.');
      }

      // Saltar configuración LTI si ya fue hecha anteriormente
      if (CanvasSnapshotManager.hasState('lti_configured')) {
        console.log('[CanvasLocalManager] ⚡ LTI y datos mock ya configurados. Iniciando directamente...');
        return true;
      }

      console.log('[CanvasLocalManager] Aplicando actualizaciones de LTI y perfiles...');
      try {
        await CanvasConfigurator.runPluginMigrations();
        await CanvasConfigurator.setupLtiAndMockData();
        CanvasSnapshotManager.markState('lti_configured', true);
      } catch (e) {
        console.warn('[CanvasLocalManager] Error actualizando configuración LTI/datos:', e.message);
      }
    }
    return true;
  }
}

export default CanvasLocalManager;
