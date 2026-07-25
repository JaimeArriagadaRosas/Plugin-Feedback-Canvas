import { execa } from 'execa';
import chalk from 'chalk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ListrInquirerPromptAdapter } from '@listr2/prompt-adapter-inquirer';

export async function checkAndStartDocker(task) {
  const cli = await detectContainerCli();
  
  if (!cli) {
    const platform = os.platform();
    let physicallyInstalled = false;
    if (platform === 'win32') {
      const defaultWinPath = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe');
      if (fs.existsSync(defaultWinPath)) physicallyInstalled = true;
    } else if (platform === 'darwin') {
      if (fs.existsSync('/Applications/Docker.app/Contents/Resources/bin/docker')) physicallyInstalled = true;
    }

    if (physicallyInstalled) {
      throw new Error('Docker está instalado físicamente en tu sistema, pero el comando "docker" falló. Agrégalo al PATH o abre Docker Desktop para configurarlo.');
    }
    throw new Error('No se detectó el programa de Docker. Por favor, instala Docker Desktop u otro motor de contenedores.');
  }

  task.title = `Motor detectado: ${cli}. Verificando estado...`;

  try {
    await execa(cli, ['info']);
    task.title = `Motor activo: ${cli}`;
    return cli; // Ya está corriendo
  } catch (error) {
    if (process.env.DOCKER_HOST) {
       throw new Error(`No pudimos conectar con el daemon remoto en DOCKER_HOST (${process.env.DOCKER_HOST}). Revisa tu conexión VPN o red.`);
    }

    let isUpdating = false;
    if (os.platform() === 'win32') {
      try {
        const tasklist = await execa('tasklist', ['/fi', 'imagename eq Docker Desktop Installer.exe']);
        if (tasklist.stdout.includes('Docker Desktop Installer.exe')) {
          isUpdating = true;
        }
      } catch (e) { /* ignorar */ }
    }

    if (isUpdating) {
      task.output = `Docker Desktop se está actualizando (proceso en curso). Esperando adaptativamente...`;
    } else {
      task.output = `La aplicación de ${cli} (Daemon) no está disponible. 👉 Por favor, ábrela o espera si está arrancando.`;
    }
    
    // Si se está actualizando o arrancando puede tardar mucho más de 90s, subimos el timeout a ~10 mins
    let retries = 120;
    while (retries > 0) {
      try {
        await execa(cli, ['info']);
        task.title = `Motor activo: ${cli}`;
        task.output = `¡${cli} detectado exitosamente!`;
        return cli;
      } catch (e) {
        if (isUpdating) {
           task.title = `Docker se está actualizando. Esperando adaptativamente (restan ${Math.floor(retries * 5 / 60)} min)...`;
        } else {
           task.title = `Esperando a que el daemon de ${cli} esté listo (restan ${retries} intentos)...`;
        }
        await new Promise(r => setTimeout(r, 5000));
        retries--;
      }
    }
    throw new Error(`Tiempo agotado esperando a ${cli}. Si estaba actualizándose, puede que requiera tu confirmación manual (UAC).`);
  }
}

async function detectContainerCli() {
  const options = ['docker', 'podman', 'orbstack', 'colima', 'nerdctl'];
  for (const opt of options) {
    try {
      await execa(opt, ['--version']);
      return opt;
    } catch {
      continue;
    }
  }
  return null;
}
