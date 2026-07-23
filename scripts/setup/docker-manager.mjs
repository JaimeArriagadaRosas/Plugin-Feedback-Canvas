import { execa } from 'execa';
import chalk from 'chalk';
import os from 'os';

export async function checkAndStartDocker() {
  const cli = await detectContainerCli();
  
  if (!cli) {
    throw new Error('No se detectó Docker, Podman, Colima ni OrbStack. Instala un motor de contenedores o usa DevContainers.');
  }

  console.log(chalk.blue(`Motor de contenedores detectado: ${cli}`));

  try {
    await execa(cli, ['info']);
    return cli; // Ya está corriendo
  } catch (error) {
    console.log(chalk.yellow(`El demonio de ${cli} está apagado. Intentando iniciarlo automáticamente...`));
    await startDaemon(cli);
    
    // Esperar a que inicie
    let retries = 15;
    while (retries > 0) {
      try {
        await execa(cli, ['info']);
        console.log(chalk.green(`\n¡${cli} iniciado exitosamente!`));
        return cli;
      } catch (e) {
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 2000));
        retries--;
      }
    }
    throw new Error(`\nTiempo de espera agotado al iniciar ${cli}. Inícialo manualmente.`);
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

async function startDaemon(cli) {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    if (cli === 'orbstack') await execa('open', ['-a', 'OrbStack']);
    else if (cli === 'colima') await execa('colima', ['start']);
    else await execa('open', ['--background', '-a', 'Docker']);
  } else if (platform === 'win32') {
    // Windows requiere PowerShell para Start-Process
    await execa('powershell', ['-Command', 'Start-Process "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"']);
  } else if (platform === 'linux') {
    if (cli === 'docker') {
      try {
        await execa('sudo', ['systemctl', 'start', 'docker']);
      } catch {
        await execa('systemctl', ['--user', 'start', 'docker-desktop']);
      }
    } else if (cli === 'podman') {
      await execa('systemctl', ['--user', 'start', 'podman.socket']);
    }
  }
}
