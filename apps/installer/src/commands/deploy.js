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
 * Main entry point for the Automated LTI Deployment Flow.
 */
export async function runDeploymentSetup() {
  try {
    // 1. Collect interactive data from the user
    const configData = await promptDeployConfig();

    // 2. If the user does not have a key and provides the token, we perform the handshake with the Canvas API
    if (!configData.hasKey) {
      if (!configData.canvasToken) {
        throw new Error('No API Token was provided, it is not possible to continue with the automated registration.');
      }

      console.log('\n' + pc.cyan('========================================================='));
      console.log('  ' + pc.bold(pc.white('REGISTERING TOOL IN CANVAS LTI 1.3')));
      console.log(pc.cyan('========================================================='));

      const deployment = new CanvasDeploymentService({
        baseUrl: configData.canvasUrl,
        token: configData.canvasToken,
      });

      // 2.1 Build dynamic JSON
      const ltiJson = await buildDynamicLtiConfig(PLUGIN_DIR, configData.domain);

      // 2.2 Create Developer Key
      const devKeyId = await deployment.ensureDeveloperKey(configData.accountId, ltiJson);
      configData.developerKeyId = devKeyId;

      // 2.3 Activate the Developer Key (switches from OFF to ON)
      await deployment.enableDeveloperKey(devKeyId);

      // 2.4 Install the app (External Tool) in the account
      await deployment.ensureExternalTool(configData.accountId, devKeyId);
    }

    // 3. Write/Update .env with final credentials and secrets
    console.log('\n' + pc.cyan('========================================================='));
    console.log('  ' + pc.bold(pc.white('CONFIGURING LOCAL ENVIRONMENT (.ENV)')));
    console.log(pc.cyan('========================================================='));
    
    await ensureEnvConfigured(PLUGIN_DIR, configData);

    console.log('\n' + pc.green('🎉 LTI Deployment Setup completed successfully!'));
    console.log(pc.white('The plugin is fully linked to your Canvas environment.'));
    console.log(pc.gray('To start in production, make sure to build first (`npm run build`) and use Option 1 in the Orchestrator.'));
    
    await ask('\nPress Enter to return to the main menu or exit...');

  } catch (err) {
    console.error('\n' + pc.red('❌ A critical error occurred during deployment:'));
    console.error(pc.red(err.message));
    console.log(pc.gray('Check the documentation and make sure you have the correct permissions and paths.'));
    await ask('\nPress Enter to return...');
  }
}

// Allow direct execution via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDeploymentSetup().then(() => process.exit(0));
}
