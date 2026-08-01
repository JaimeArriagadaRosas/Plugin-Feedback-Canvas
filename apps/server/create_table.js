import db from './src/data/db.js';

async function run() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Preferencias_Notificacion_Estudiante (
          estudiante_id VARCHAR(50) PRIMARY KEY,
          metodo VARCHAR(20) DEFAULT 'canvas_inapp',
          frecuencia VARCHAR(20) DEFAULT 'inmediata',
          actualizado_en TIMESTAMPTZ DEFAULT NOW()
      );
      
      DROP TRIGGER IF EXISTS pref_notif_estud_updated_at ON Preferencias_Notificacion_Estudiante;
      CREATE TRIGGER pref_notif_estud_updated_at
        BEFORE UPDATE ON Preferencias_Notificacion_Estudiante
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
    console.log("Tabla Preferencias_Notificacion_Estudiante creada correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("Error creando la tabla:", error);
    process.exit(1);
  }
}

run();
