import dotenv from 'dotenv';
import pc from 'picocolors';
import { confirm, input } from '@inquirer/prompts';

// Load .env so NON_INTERACTIVE/STARTUP_MODE are available
dotenv.config({ quiet: true });

export async function ask(question, defaultValue) {
  try {
    const answer = await input({
      message: '- ' + pc.bold(question) + ':'
    });
    const trimmed = answer.trim();
    return trimmed || (defaultValue !== undefined ? String(defaultValue) : '');
  } catch {
    return defaultValue !== undefined ? String(defaultValue) : '';
  }
}

export async function showMainMenu() {
  // In NON_INTERACTIVE mode, use STARTUP_MODE from .env or default '3'.
  // This allows automatic startup (CI/CD or scripts) to skip the prompt.
  const isNonInteractive = process.env.NON_INTERACTIVE === 'true';
  if (isNonInteractive) {
    const mode = process.env.STARTUP_MODE || '3';
    console.log(pc.blue('\n========================================================='));
    console.log('  ' + pc.bold(pc.white('SELECT SERVER STARTUP MODE')));
    console.log(pc.blue('========================================================='));
    console.log('  ' + pc.green('[1]') + ' Run LTI 1.3 Production Environment ' + pc.dim('(Real Server / AWS)'));
    console.log('  ' + pc.magenta('[2]') + ' LTI Deployment Setup ' + pc.dim('(Automated Canvas Installation)'));
    console.log('  ' + pc.yellow('[3]') + ' Run Canvas LMS Locally ' + pc.dim('(Docker Development Environment)'));
    console.log('  ' + pc.red('[4]') + ' Black-Box Validation ' + pc.dim('(Health Checks & E2E Tests)'));
    console.log(pc.blue('========================================================='));
    console.log(`- Auto-selected: ${mode} (NON_INTERACTIVE mode)`);
    return mode;
  }

  console.log('\n' + pc.blue('========================================================='));
  console.log('  ' + pc.bold(pc.white('SELECT SERVER STARTUP MODE')));
  console.log(pc.blue('========================================================='));
  console.log('  ' + pc.green('[1]') + ' Run LTI 1.3 Production Environment ' + pc.dim('(Real Server / AWS)'));
  console.log('  ' + pc.magenta('[2]') + ' LTI Deployment Setup ' + pc.dim('(Automated Canvas Installation)'));
  console.log('  ' + pc.yellow('[3]') + ' Run Canvas LMS Locally ' + pc.dim('(Docker Development Environment)'));
  console.log('  ' + pc.red('[4]') + ' Black-Box Validation ' + pc.dim('(Health Checks & E2E Tests)'));
  console.log(pc.blue('========================================================='));
  const mode = await ask('Select an option (1-4)', '3');
  return mode;
}

export async function showRoleMenu() {
  console.log('\n' + pc.magenta('========================================================='));
  console.log('  ' + pc.bold(pc.white('SELECT ROLE TO LOG IN AS')));
  console.log(pc.magenta('========================================================='));
  console.log('  ' + pc.yellow('[1]') + ' Administrator');
  console.log('  ' + pc.yellow('[2]') + ' Teacher');
  console.log('  ' + pc.yellow('[3]') + ' Student');
  console.log(pc.magenta('========================================================='));
  const role = await ask('Select an option (1-3)', '1');
  
  if (role === '3') {
    console.log('\n' + pc.green('========================================================='));
    console.log('  ' + pc.bold(pc.white('SELECT STUDENT PROFILE')));
    console.log(pc.green('========================================================='));
    console.log('  ' + pc.yellow('[1]') + ' John Smith ' + pc.dim('(Average student)'));
    console.log('  ' + pc.yellow('[2]') + ' Mary Johnson ' + pc.dim('(Outstanding student)'));
    console.log('  ' + pc.yellow('[3]') + ' Peter Brown ' + pc.dim('(At-risk student)'));
    console.log('  ' + pc.yellow('[4]') + ' Anna Torres ' + pc.dim('(Above-average student)'));
    console.log('  ' + pc.yellow('[5]') + ' Charles Mendez ' + pc.dim('(Excellence student)'));
    console.log(pc.green('========================================================='));
    const studentIdx = await ask('Select an option (1-5)', '1');
    return `student-${studentIdx}`;
  }
  
  return role;
}



export async function askConfirm(message, defaultVal = false) {
  try {
    return await confirm({
      message: message,
      default: defaultVal
    });
  } catch {
    return defaultVal;
  }
}
