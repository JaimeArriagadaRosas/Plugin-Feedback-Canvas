import path from 'path';
import { fileURLToPath } from 'url';
import { DockerLtiConfigurator } from '../../local/DockerLtiConfigurator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  try {
    const ltiJsonPath = path.resolve(__dirname, '..', '..', '..', '..', '..', 'config', 'lti_placement.json');
    console.log('Starting LTI injection with JSON:', ltiJsonPath);
    const clientId = await DockerLtiConfigurator.injectLtiTool(ltiJsonPath, null);
    console.log('LTI Client ID:', clientId);
  } catch (e) {
    console.error(e);
  }
}

run();
