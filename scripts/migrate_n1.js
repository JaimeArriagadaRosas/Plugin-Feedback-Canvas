import db from './apps/server/src/data/db.js';

async function main() {
  try {
    await db.query(`ALTER TABLE Historial_Feedback_Generado ADD COLUMN IF NOT EXISTS nombre_curso VARCHAR(255)`);
    await db.query(`ALTER TABLE Historial_Feedback_Generado ADD COLUMN IF NOT EXISTS nombre_tarea VARCHAR(255)`);
    await db.query(`ALTER TABLE Historial_Feedback_Generado ADD COLUMN IF NOT EXISTS nombre_estudiante VARCHAR(255)`);
    console.log('Migración exitosa: columnas añadidas.');
  } catch (error) {
    console.error('Error en migración:', error);
  } finally {
    process.exit(0);
  }
}

main();
