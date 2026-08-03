import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://postgres:CHANGE_ME_db_password_strong@127.0.0.1:5432/feedback_plugin_db'
});
async function check() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='historial_feedback_generado';
    `);
    console.log('Columns:', res.rows.map(r => r.column_name));
    
    await client.query(`
      ALTER TABLE Historial_Feedback_Generado 
      ADD COLUMN IF NOT EXISTS profesor_id TEXT DEFAULT '';
    `);
    console.log('Added profesor_id if it was missing.');
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
check();
