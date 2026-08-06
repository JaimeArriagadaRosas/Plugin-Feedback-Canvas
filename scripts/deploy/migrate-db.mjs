import { runMigrations } from '../setup/migrate.mjs';
import dotenv from 'dotenv';

// Cargar variables de entorno si existen
dotenv.config();

console.log('Iniciando script de migración automática...');

runMigrations()
  .then(() => {
    console.log('Migraciones completadas exitosamente.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fallo crítico ejecutando migraciones:', err);
    process.exit(1);
  });
