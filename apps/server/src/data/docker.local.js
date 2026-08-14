import logger from '../utils/logger.js';
import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Starts the local database container (PostgreSQL) using Docker Compose.
 * Exclusive for local development (_local suffix).
 */
export async function autoStartLocalDbContainer() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const projectRoot = path.resolve(path.dirname(__filename), '../../../../');
    const composeFile = path.join(projectRoot, 'docker-compose.db.yml');
    
    if (fs.existsSync(composeFile)) {
      // Use execa to check if it's already running and healthy
      try {
        const { stdout } = await execa('docker', ['compose', '-f', 'docker-compose.db.yml', 'ps', '--format', 'json'], { cwd: projectRoot });
        const containers = stdout.trim() ? stdout.trim().split('\n').map(JSON.parse) : [];
        const dbContainer = containers.find(c => c.Service === 'db' || c.Name.includes('db'));
        
        if (dbContainer && dbContainer.State === 'running' && dbContainer.Health === 'healthy') {
          return true; // Already active
        }
      } catch (e) {
        // Ignore if ps fails and proceed to start
      }

      logger.info('[DB] Database inactive or not found. Starting PostgreSQL container (Docker)...');
      await execa('docker', ['compose', '-f', 'docker-compose.db.yml', 'up', '-d', '--wait'], { cwd: projectRoot });
      logger.info('[DB] Container started and PostgreSQL is ready (healthy).');
      return true;
    }
  } catch (err) {
    logger.warn('[DB] Could not automatically start the DB container:', { error: err.message });
  }
  return false;
}
