import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://postgres:CHANGE_ME_db_password_strong@127.0.0.1:5432/feedback_plugin_db'
});
async function alter() {
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE Historial_Feedback_Generado 
      ADD COLUMN IF NOT EXISTS nombre_curso VARCHAR(255),
      ADD COLUMN IF NOT EXISTS nombre_tarea VARCHAR(255),
      ADD COLUMN IF NOT EXISTS nombre_estudiante VARCHAR(255);
    `);
    console.log('Added missing columns');
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
alter();
