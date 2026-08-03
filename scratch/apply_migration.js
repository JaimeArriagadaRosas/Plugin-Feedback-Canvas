import db from './src/data/db.js';

async function runMigration() {
  try {
    console.log('Running RLS policy migration...');
    const result = await db.query(`
      DROP POLICY IF EXISTS aislar_tenant_feedback ON Historial_Feedback_Generado;
      CREATE POLICY aislar_tenant_feedback ON Historial_Feedback_Generado
      USING (profesor_id = current_setting('app.current_tenant', true) OR estudiante_id = current_setting('app.current_tenant', true));
    `);
    console.log('Migration successful.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
