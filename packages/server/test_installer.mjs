import fs from 'fs/promises';
import { spawn } from 'child_process';

async function test() {
  const ltiJson = await fs.readFile('../../config/lti_placement.json', 'utf-8');
  let rubyScript = await fs.readFile('./src/setup/canvas_lti_1_3_installer.rb', 'utf-8');
  
  rubyScript = rubyScript.replace("ENV['LTI_PLACEMENT_JSON']", `<<~JSON_EOF\n${ltiJson}\nJSON_EOF`);
  rubyScript = rubyScript.replace("ENV['PLUGIN_URL']", `'https://localhost:3000'`);
  rubyScript = rubyScript.replace("ENV['CANVAS_GLOBAL_JS_URL']", `'https://localhost:3000/api/canvas/canvas-logs.js'`);

  const proc = spawn('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'runner', '-'], {
    cwd: '../../../../canvas-lms-master',
    shell: true
  });

  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);

  proc.stdin.write(rubyScript);
  proc.stdin.end();
}
test();
