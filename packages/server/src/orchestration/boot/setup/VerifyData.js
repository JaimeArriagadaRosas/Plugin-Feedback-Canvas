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

    const sqlCheck = "SELECT 1 FROM users LIMIT 1;";
    const spinner = createSpinner('Verificando datos institucionales (SQL puro)...').start();

    // Aumentado a 12 reintentos para evitar fallos tempranos durante inicialización pesada
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { success, out, err } = await runCommand('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'canvas_development', '-tAc', sqlCheck], { 
        cwd: this.canvasDir,
        timeout: 15000 // 15 seconds max for psql
      });

      if (err.includes('relation') && err.includes('does not exist') || err.includes('database') && err.includes('does not exist')) {
        spinner.error({ text: 'La base de datos no está migrada o no existe la tabla users.', mark: '  ×' });
        this.boot.error('La base de datos de Canvas no está inicializada. Ejecute migraciones.');
        return false;
      }

      if (success) {
        if (out.trim() === '1') {
          spinner.success({ text: 'Datos base de la institución encontrados en Canvas.', mark: '  √' });
          return true;
        } else {
          spinner.warn({ text: 'Los datos base de la institución no están instalados.', mark: '  !' });
          return false;
        }
      }

      this.boot.debug(`Intento ${attempt} fallido para Datos Base. Out: ${out}, Err: ${err}`);
      
      if (attempt < maxRetries) {
        spinner.update({ text: `Verificando datos institucionales... (Intento ${attempt + 1}/${maxRetries})` });
        await new Promise(r => setTimeout(r, waitSeconds * 1000));
      }
    }

    spinner.error({ text: 'Los datos base de la institución no están instalados.', mark: '  !' });
    return false;
  }
}
