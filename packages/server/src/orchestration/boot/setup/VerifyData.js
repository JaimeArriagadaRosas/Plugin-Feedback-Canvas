import { runCommand } from './utils/Runner.js';
import { createSpinner } from 'nanospinner';

export class VerifyData {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
  }

  async isDataPopulated(maxRetries = 12, waitSeconds = 5) {
    this.boot.info('Verificando existencia de la base de datos de la Universidad (Cursos, Usuarios)...');
    const rubyCheck = "puts User.where(workflow_state: 'registered').count > 0 ? 'DATA_OK' : 'DATA_MISSING'";
    
    // Check if web container is up
    const { success: webUp, out: webOut } = await runCommand('docker', ['compose', 'ps', '-q', 'web'], { cwd: this.canvasDir });
    if (!webUp || !webOut.trim()) {
      this.boot.error("El contenedor 'web' de Canvas no está corriendo. No se puede verificar la BD.");
      return false;
    }

    const spinner = createSpinner('Verificando datos institucionales...').start();

    // Aumentado a 12 reintentos para evitar fallos tempranos durante inicialización pesada
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { success, out, err } = await runCommand('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'runner', rubyCheck], { 
        cwd: this.canvasDir,
        timeout: 30000 // 30 seconds max for Rails runner
      });

      if (success && out.includes('DATA_OK')) {
        spinner.success({ text: ' Datos base de la institución encontrados en Canvas.' });
        return true;
      }

      this.boot.debug(`Intento ${attempt} fallido para Datos Base. Out: ${out}, Err: ${err}`);
      
      if (attempt < maxRetries) {
        spinner.update({ text: `Verificando datos institucionales... (Intento ${attempt + 1}/${maxRetries})` });
        await new Promise(r => setTimeout(r, waitSeconds * 1000));
      }
    }

    spinner.error({ text: 'Los datos base de la institución no están instalados.' });
    return false;
  }
}
