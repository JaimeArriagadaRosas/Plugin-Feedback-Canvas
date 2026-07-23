import { runCommand } from './utils/Runner.js';
import { createSpinner } from 'nanospinner';

export class VerifyData {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
  }

  async isDataPopulated(maxRetries = 12, waitSeconds = 5) {
    this.boot.info('Verificando existencia de la base de datos de la Universidad (Cursos, Usuarios)...');
    
    // Check if web container is up
    const { success: webUp, out: webOut } = await runCommand('docker', ['compose', 'ps', '-q', 'web'], { cwd: this.canvasDir });
    if (!webUp || !webOut.trim()) {
      this.boot.error("El contenedor 'web' de Canvas no está corriendo. No se puede verificar la BD.");
      return false;
    }

    const rubyCheck = "puts User.where(workflow_state: 'registered').count > 0 ? 'DATA_OK' : 'DATA_MISSING'";
    const spinner = createSpinner('Verificando datos institucionales...').start();

    // Aumentado a 12 reintentos para evitar fallos tempranos durante inicialización pesada
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { success, out, err } = await runCommand('docker', ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', rubyCheck], { 
        cwd: this.canvasDir,
        timeout: 90000 // 90 seconds max for Rails runner cold boot
      });

      // Detección temprana de errores de Bundler plugins - evitar reintentos inútiles
      if (err.includes('bundler-multilock plugin is not installed')) {
        spinner.error({ text: 'Falta instalar bundler-multilock. Deteniendo reintentos.' });
        this.boot.error('ERROR: bundler-multilock plugin no está instalado en el contenedor web.');
        this.boot.info('Ejecute: docker compose exec web gem install bundler-multilock');
        return false;
      }

      if (err.includes('relation') && err.includes('does not exist')) {
        spinner.error({ text: 'La base de datos no está migrada.' });
        this.boot.error('ERROR: La base de datos de Canvas no está inicializada. Ejecute migraciones.');
        return false;
      }

      if (success && out.includes('DATA_OK')) {
        spinner.success({ text: 'Datos base de la institución encontrados en Canvas.', mark: '  √' });
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
