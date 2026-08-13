import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { promptDeployConfig, ask } from '../deployment/prompts.js';
import { ensureEnvConfigured } from '../deployment/envManager.js';
import { buildDynamicLtiConfig } from '../deployment/configBuilder.js';
import { CanvasDeploymentService } from '../deployment/CanvasDeploymentService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(__dirname, '..', '..', '..', '..');

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

      const deployment = new CanvasDeploymentService({
        baseUrl: configData.canvasUrl,
        token: configData.canvasToken,
      });

      // 2.1 Armar el JSON dinámico
      const ltiJson = await buildDynamicLtiConfig(PLUGIN_DIR, configData.domain);

      // 2.2 Crear Developer Key
      const devKeyId = await deployment.ensureDeveloperKey(configData.accountId, ltiJson);
      configData.developerKeyId = devKeyId;

      // 2.3 Activar la Developer Key (pasa de OFF a ON)
      await deployment.enableDeveloperKey(devKeyId);

      // 2.4 Instalar la app (External Tool) en la cuenta
      await deployment.ensureExternalTool(configData.accountId, devKeyId);
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
