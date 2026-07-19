import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { promptDeployConfig, ask } from './prompts.mjs';
import { ensureEnvConfigured } from './envManager.mjs';
import { buildDynamicLtiConfig } from './configBuilder.mjs';
import { CanvasApi } from './canvasApi.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(__dirname, '..', '..');

/**
 * Punto de entrada principal para el Flujo de Despliegue Automatizado LTI.
 */
export async function runDeploymentSetup() {
  try {
    // 1. Recopilar datos interactivos del usuario
    const configData = await promptDeployConfig();

    // 2. Si el usuario no tiene llave y provee el token, realizamos el handshake con la API de Canvas
    if (!configData.hasKey) {
      if (!configData.canvasToken) {
        throw new Error('No se proporcionó un API Token, no es posible continuar con el registro automatizado.');
      }

      console.log('\n' + pc.cyan('========================================================='));
      console.log('  ' + pc.bold(pc.white('REGISTRANDO HERRAMIENTA EN CANVAS LTI 1.3')));
      console.log(pc.cyan('========================================================='));

      const api = new CanvasApi(configData.canvasUrl, configData.canvasToken);

      // 2.1 Armar el JSON dinámico
      const ltiJson = await buildDynamicLtiConfig(PLUGIN_DIR, configData.domain);

      // 2.2 Crear Developer Key
      const devKeyId = await api.createDeveloperKey(configData.accountId, ltiJson);
      configData.developerKeyId = devKeyId;

      // 2.3 Activar la Developer Key (pasa de OFF a ON)
      await api.enableDeveloperKey(devKeyId);

      // 2.4 Instalar la app (External Tool) en la cuenta
      await api.installExternalTool(configData.accountId, devKeyId);
    }

    // 3. Escribir/Actualizar .env con las credenciales finales y secrets
    console.log('\n' + pc.cyan('========================================================='));
    console.log('  ' + pc.bold(pc.white('CONFIGURANDO ENTORNO LOCAL (.ENV)')));
    console.log(pc.cyan('========================================================='));
    
    await ensureEnvConfigured(PLUGIN_DIR, configData);

    console.log('\n' + pc.green('🎉 ¡Setup de Despliegue LTI completado exitosamente!'));
    console.log(pc.white('El plugin está completamente enlazado a tu entorno Canvas.'));
    console.log(pc.gray('Para iniciar en producción, asegúrate de compilar primero (`npm run build`) y usar la Opción 1 del Orquestador.'));
    
    await ask('\nPresione Enter para regresar al menú principal o salir...');

  } catch (err) {
    console.error('\n' + pc.red('❌ Ocurrió un error crítico durante el despliegue:'));
    console.error(pc.red(err.message));
    console.log(pc.gray('Revisa la documentación y asegúrate de contar con los permisos y rutas correctas.'));
    await ask('\nPresione Enter para regresar...');
  }
}

// Permitir ejecución directa por CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDeploymentSetup().then(() => process.exit(0));
}
