import 'dotenv/config';
import db from '../src/data/db.js';

async function simulate() {
  console.log('Simulating error: AI_GENERATION_FAILED');
  
  let profesorId = process.env.TEST_PROFESOR_ID;
  if (!profesorId) {
    const tokenRes = await db.query('SELECT canvas_sub FROM canvas_user_tokens ORDER BY actualizado_en DESC LIMIT 1');
    profesorId = tokenRes.rows.length > 0 ? tokenRes.rows[0].canvas_sub : 1;
  }
  console.log(`Using profesor_id (canvas_sub): ${profesorId}`);
  
  const payload = {
    profesor_id: profesorId,
    tipo_error: 'AI_GENERATION_FAILED',
    mensaje_error: 'The Gemini API returned a 500 error (Internal Server Error).'
  };

  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const res = await fetch('https://localhost:3000/api/system-notifications/simulate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      console.log('✅ Error sent to the server via HTTP successfully.');
    } else {
      console.error('⚠️ The server rejected the simulation via HTTP:', await res.text());
      console.log('🔄 Attempting fallback: Inserting directly into the database...');
      await db.query(`
        INSERT INTO notificaciones_sistema (profesor_id, tipo_error, mensaje_error, detalle, contexto)
        VALUES ($1, $2, $3, $4, $5)
      `, [profesorId, payload.tipo_error, payload.mensaje_error, 'Failure simulated by script', JSON.stringify({})]);
      console.log('✅ Fallback successful. Notification inserted directly into PostgreSQL.');
    }
  } catch (err) {
    console.error('⚠️ HTTP call failed:', err.message);
    console.log('🔄 Attempting fallback: Inserting directly into the database...');
    await db.query(`
      INSERT INTO notificaciones_sistema (profesor_id, tipo_error, mensaje_error, detalle, contexto)
      VALUES ($1, $2, $3, $4, $5)
    `, [profesorId, payload.tipo_error, payload.mensaje_error, 'Failure simulated by script', JSON.stringify({})]);
    console.log('✅ Fallback successful. Notification inserted directly into PostgreSQL.');
  }
  
  process.exit(0);
}

simulate().catch(err => {
  console.error(err);
  process.exit(1);
});
