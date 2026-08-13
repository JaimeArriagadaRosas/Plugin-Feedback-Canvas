import * as readline from 'node:readline';
import pc from 'picocolors';

/**
 * Módulo de interacción por consola.
 * Agrupa la lógica para hacer preguntas al administrador.
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
  console.log('  ' + pc.bold(pc.white('ASISTENTE DE DESPLIEGUE LTI 1.3')));
  console.log(pc.cyan('========================================================='));

  const domain = await ask('Dominio Público del Plugin (ej. https://feedback.unab.cl)');
  
  if (!domain.startsWith('https://')) {
    console.warn(pc.yellow('⚠️ Advertencia: LTI 1.3 exige HTTPS. Asegúrate de que el dominio provisto soporte TLS.'));
  }

  const hasKey = await askBoolean('¿Ya posees una Developer Key (Client ID) entregada por el administrador de Canvas?');
  
  let developerKeyId = null;
  let canvasUrl = null;
  let canvasToken = null;
  let accountId = null;

  if (hasKey) {
    developerKeyId = await ask('Ingresa la Developer Key (Client ID)');
    canvasUrl = await ask('Ingresa la URL Base de Canvas (ej. https://canvas.unab.cl)');
  } else {
    console.log('\n' + pc.blue('--- Creación Automatizada vía API ---'));
    console.log(pc.gray('Necesitarás un Token de Canvas con permisos de "Account Admin".'));
    canvasUrl = await ask('URL Base de Canvas (ej. https://canvas.unab.cl)');
    canvasToken = await ask('Token de Acceso de Canvas (Account Admin)');
    accountId = await ask('ID de la Cuenta o Sub-cuenta donde instalar (Por defecto Root = 1)', '1');
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
