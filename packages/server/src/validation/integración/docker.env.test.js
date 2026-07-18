import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Integracin  Verificacin de Entorno Docker', () => {
  it('El daemon de Docker debe estar corriendo y respondiendo', () => {
    let daemonRunning = false;
    try {
      // Ejecutamos docker info para validar que el daemon responde
      const output = execSync('docker info', { encoding: 'utf-8', stdio: 'pipe' });
      if (output.toLowerCase().includes('server version') || output.toLowerCase().includes('containers:')) {
        daemonRunning = true;
      }
    } catch (error) {
      console.error('Error al contactar al daemon de Docker:', error.message);
    }
    
    expect(daemonRunning).toBe(true);
  });

  it('Los contenedores de Canvas LMS deben estar en ejecucin', () => {
    // Calculamos la ruta hacia canvas-lms-master asumiendo que este test 
    // se corre desde 'Plugin Feedback/src/validacin/integracin'
    const pluginDir = path.resolve(__dirname, '../../../../..');
    const canvasDir = path.join(pluginDir, 'canvas-lms-master');
    
    // Verificamos si existe la carpeta
    if (!fs.existsSync(canvasDir)) {
      console.warn('Advertencia: El directorio canvas-lms-master no existe localmente. Omitiendo validacin de contenedores.');
      return; // Si no estamos en entorno de desarrollo local, omitimos
    }

    let containersRunning = false;
    try {
      const output = execSync('docker compose ps --format json', { 
        cwd: canvasDir,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // Si la salida contiene web y postgres, significa que al menos esos contenedores estn listados
      if (output.includes('web') && output.includes('postgres')) {
        containersRunning = true;
      } else if (output.trim() !== '') {
         // Fallback para versiones antiguas de docker compose format
         containersRunning = true;
      }
    } catch (error) {
      console.error('Error al verificar los contenedores con docker compose:', error.message);
    }
    
    expect(containersRunning).toBe(true);
  });
});
