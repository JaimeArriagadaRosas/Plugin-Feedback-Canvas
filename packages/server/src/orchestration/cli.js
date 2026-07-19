import * as readline from 'node:readline';
import dotenv from 'dotenv';
import pc from 'picocolors';

// Cargar .env para que NON_INTERACTIVE/STARTUP_MODE estén disponibles
dotenv.config();

export function ask(question, defaultValue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('- ' + pc.bold(question) + ': ', (answer) => {
      rl.close();
      resolve(answer.trim() || (defaultValue !== undefined ? String(defaultValue) : ''));
    });
  });
}

export async function showMainMenu() {
  // En modo NON_INTERACTIVE, usar el STARTUP_MODE del .env o el default '3'.
  // Esto permite que el arranque automático (por CI/CD o scripts) omita el prompt.
  const isNonInteractive = process.env.NON_INTERACTIVE === 'true';
  if (isNonInteractive) {
    const mode = process.env.STARTUP_MODE || '3';
    console.log(pc.blue('\n========================================================='));
    console.log('  ' + pc.bold(pc.white('SELECCIONE EL MODO DE INICIO DEL SERVIDOR')));
    console.log(pc.blue('========================================================='));
    console.log('  ' + pc.green('[1]') + ' Ejecutar Entorno de Producción LTI 1.3 ' + pc.dim('(Servidor Real/AWS)'));
    console.log('  ' + pc.magenta('[2]') + ' Setup de Despliegue LTI ' + pc.dim('(Instalación Automatizada en Canvas)'));
    console.log('  ' + pc.yellow('[3]') + ' Ejecutar localmente Canvas LMS ' + pc.dim('(Entorno Docker de desarrollo)'));
    console.log('  ' + pc.yellow('[4]') + ' Modo Standalone / Pruebas de API ' + pc.dim('(Frontend + API Token manual)'));
    console.log('  ' + pc.red('[5]') + ' Validaciones de Caja Negra ' + pc.dim('(Health Checks y Tests E2E)'));
    console.log(pc.blue('========================================================='));
    console.log(`- Seleccion automatica: ${mode} (NON_INTERACTIVE mode)`);
    return mode;
  }

  console.log('\n' + pc.blue('========================================================='));
  console.log('  ' + pc.bold(pc.white('SELECCIONE EL MODO DE INICIO DEL SERVIDOR')));
  console.log(pc.blue('========================================================='));
  console.log('  ' + pc.green('[1]') + ' Ejecutar Entorno de Producción LTI 1.3 ' + pc.dim('(Servidor Real/AWS)'));
  console.log('  ' + pc.magenta('[2]') + ' Setup de Despliegue LTI ' + pc.dim('(Instalación Automatizada en Canvas)'));
  console.log('  ' + pc.yellow('[3]') + ' Ejecutar localmente Canvas LMS ' + pc.dim('(Entorno Docker de desarrollo)'));
  console.log('  ' + pc.yellow('[4]') + ' Modo Standalone / Pruebas de API ' + pc.dim('(Frontend + API Token manual)'));
  console.log('  ' + pc.red('[5]') + ' Validaciones de Caja Negra ' + pc.dim('(Health Checks y Tests E2E)'));
  console.log(pc.blue('========================================================='));
  const mode = await ask('Seleccione una opcion (1-5)', '3');
  return mode;
}

export async function showRoleMenu() {
  console.log('\n' + pc.magenta('========================================================='));
  console.log('  ' + pc.bold(pc.white('SELECCIONE EL ROL PARA INGRESAR')));
  console.log(pc.magenta('========================================================='));
  console.log('  ' + pc.yellow('[1]') + ' Administrador');
  console.log('  ' + pc.yellow('[2]') + ' Profesor');
  console.log('  ' + pc.yellow('[3]') + ' Estudiante');
  console.log(pc.magenta('========================================================='));
  const role = await ask('Seleccione una opcion (1-3)', '1');
  
  if (role === '3') {
    console.log('\n' + pc.green('========================================================='));
    console.log('  ' + pc.bold(pc.white('SELECCIONE EL PERFIL DE ESTUDIANTE')));
    console.log(pc.green('========================================================='));
    console.log('  ' + pc.yellow('[1]') + ' Juan Perez ' + pc.dim('(Estudiante promedio)'));
    console.log('  ' + pc.yellow('[2]') + ' Maria Garcia ' + pc.dim('(Estudiante sobresaliente)'));
    console.log('  ' + pc.yellow('[3]') + ' Pedro Lopez ' + pc.dim('(Estudiante en riesgo)'));
    console.log('  ' + pc.yellow('[4]') + ' Ana Torres ' + pc.dim('(Estudiante promedio alto)'));
    console.log('  ' + pc.yellow('[5]') + ' Carlos Mendez ' + pc.dim('(Estudiante de excelencia)'));
    console.log(pc.green('========================================================='));
    const studentIdx = await ask('Seleccione una opcion (1-5)', '1');
    return `student-${studentIdx}`;
  }
  
  return role;
}

export async function showApiTokenMenu(defaultUrl, defaultToken, defaultCourseId) {
  console.log('\n' + pc.magenta('========================================================='));
  console.log('  ' + pc.bold(pc.white('CONFIGURACIÓN DE CONEXIÓN POR API')));
  console.log(pc.magenta('========================================================='));
  
  const baseUrl = await ask(`URL de Canvas (actual: ${defaultUrl || 'Ninguna'})`, defaultUrl || 'https://canvas.instructure.com');
  const token = await ask(`Token de API (actual: ${defaultToken ? '***' : 'Ninguno'})`, defaultToken || '');
  const courseId = await ask(`ID del Curso (actual: ${defaultCourseId || '1'})`, defaultCourseId || '1');
  
  return { baseUrl, token, courseId };
}
