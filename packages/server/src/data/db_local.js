import logger from '../utils/logger.js';
import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Inicia el contenedor de base de datos local (PostgreSQL) usando Docker Compose.
 * Exclusivo para desarrollo local (sufijo _local).
 */
export async function autoStartLocalDbContainer() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const projectRoot = path.resolve(path.dirname(__filename), '../../../../');
    const composeFile = path.join(projectRoot, 'docker-compose.db.yml');
    
    if (fs.existsSync(composeFile)) {
      // Usar execa para comprobar si ya está running y healthy
      try {
        const { stdout } = await execa('docker', ['compose', '-f', 'docker-compose.db.yml', 'ps', '--format', 'json'], { cwd: projectRoot });
        const containers = stdout.trim() ? stdout.trim().split('\n').map(JSON.parse) : [];
        const dbContainer = containers.find(c => c.Service === 'db' || c.Name.includes('db'));
        
        if (dbContainer && dbContainer.State === 'running' && dbContainer.Health === 'healthy') {
          return true; // Ya está activo
        }
      } catch (e) {
        // Ignorar si el ps falla y proceder a iniciar
      }

      logger.info('[DB] Base de datos inactiva o no encontrada. Encendiendo contenedor de PostgreSQL (Docker)...');
      await execa('docker', ['compose', '-f', 'docker-compose.db.yml', 'up', '-d', '--wait'], { cwd: projectRoot });
      logger.info('[DB] Contenedor iniciado y PostgreSQL está listo (healthy).');
      return true;
    }
  } catch (err) {
    logger.warn('[DB] No se pudo iniciar el contenedor de BD automáticamente:', { error: err.message });
  }
  return false;
}
