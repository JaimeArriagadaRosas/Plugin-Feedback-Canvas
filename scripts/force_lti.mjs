import path from 'path';
import { fileURLToPath } from 'url';
import { DockerLtiConfigurator } from '../apps/server/src/setup/local/DockerLtiConfigurator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  try {
    const ltiJsonPath = path.join(__dirname, '../config/lti_placement.json');
    console.log('Iniciando inyección LTI con JSON:', ltiJsonPath);
    const clientId = await DockerLtiConfigurator.injectLtiTool(ltiJsonPath, null);
    console.log('LTI Client ID:', clientId);
  } catch (e) {
    console.error(e);
  }
}

run();
