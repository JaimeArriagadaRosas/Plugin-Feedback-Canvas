import db from './apps/server/src/data/db.js';

async function check() {
  try {
    const res = await db.query('SELECT id, estudiante_id, profesor_id, curso_id, tarea_id, estado FROM Historial_Feedback_Generado');
    console.log("Feedbacks in DB:", res.rows);
  } catch (e) {
    console.error("DB Error:", e);
  }
  process.exit();
}

check();
