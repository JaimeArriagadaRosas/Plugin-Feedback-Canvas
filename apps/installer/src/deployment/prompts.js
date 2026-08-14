import * as readline from 'node:readline';
import pc from 'picocolors';

/**
 * Console interaction module.
 * Groups the logic for asking questions to the administrator.
 */

export function ask(question, defaultValue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('- ' + pc.bold(question) + (defaultValue ? ` [${defaultValue}]` : '') + ': ', (answer) => {
      rl.close();
      resolve(answer.trim() || (defaultValue !== undefined ? String(defaultValue) : ''));
    });
  });
}

export async function askBoolean(question, defaultYes = true) {
  const options = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await ask(`${question} ${options}`, defaultYes ? 'y' : 'n');
  const normalized = answer.toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

export async function promptDeployConfig() {
  console.log('\n' + pc.cyan('========================================================='));
  console.log('  ' + pc.bold(pc.white('LTI 1.3 DEPLOYMENT WIZARD')));
  console.log(pc.cyan('========================================================='));

  const domain = await ask('Plugin Public Domain (e.g. https://feedback.example.com)');
  
  if (!domain.startsWith('https://')) {
    console.warn(pc.yellow('⚠️ Warning: LTI 1.3 requires HTTPS. Ensure the provided domain supports TLS.'));
  }

  const hasKey = await askBoolean('Do you already have a Developer Key (Client ID) provided by the Canvas administrator?');
  
  let developerKeyId = null;
  let canvasUrl = null;
  let canvasToken = null;
  let accountId = null;

  if (hasKey) {
    developerKeyId = await ask('Enter the Developer Key (Client ID)');
    canvasUrl = await ask('Enter the Canvas Base URL (e.g. https://canvas.example.com)');
  } else {
    console.log('\n' + pc.blue('--- Automated Creation via API ---'));
    console.log(pc.gray('You will need a Canvas Token with "Account Admin" permissions.'));
    canvasUrl = await ask('Canvas Base URL (e.g. https://canvas.example.com)');
    canvasToken = await ask('Canvas Access Token (Account Admin)');
    accountId = await ask('Account or Sub-account ID where to install (Default Root = 1)', '1');
  }

  return {
    domain,
    hasKey,
    developerKeyId,
    canvasUrl,
    canvasToken,
    accountId
  };
}
