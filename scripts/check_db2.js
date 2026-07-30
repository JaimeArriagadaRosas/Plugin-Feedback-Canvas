import db from './apps/server/src/data/db.js';

async function main() {
  const res = await db.query('SELECT id, profesor_id, curso_id, estudiante_id, tarea_id, estado FROM Historial_Feedback_Generado');
  console.log('Feedbacks en DB:');
  console.table(res.rows);
  process.exit(0);
}
main().catch(console.error);
