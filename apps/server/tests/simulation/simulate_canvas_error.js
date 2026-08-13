import 'dotenv/config';
import db from '../src/data/db.js';

async function simulate() {
  console.log('Simulando error: CANVAS_CONNECTION_FAILED');
  
  let profesorId = process.env.TEST_PROFESOR_ID;
  if (!profesorId) {
    const tokenRes = await db.query('SELECT canvas_sub FROM canvas_user_tokens ORDER BY actualizado_en DESC LIMIT 1');
    profesorId = tokenRes.rows.length > 0 ? tokenRes.rows[0].canvas_sub : 1;
  }
  console.log(`Usando profesor_id (canvas_sub): ${profesorId}`);
  
  const payload = {
    profesor_id: profesorId,
    tipo_error: 'CANVAS_CONNECTION_FAILED',
    mensaje_error: 'Canvas API timeout o endpoint inaccesible.'
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
      console.log('✅ Error enviado al servidor por HTTP con éxito.');
    } else {
      console.error('⚠️ El servidor rechazó la simulación por HTTP:', await res.text());
      console.log('🔄 Intentando fallback: Insertando directamente en la base de datos...');
      await db.query(`
        INSERT INTO notificaciones_sistema (profesor_id, tipo_error, mensaje_error, detalle, contexto)
        VALUES ($1, $2, $3, $4, $5)
      `, [profesorId, payload.tipo_error, payload.mensaje_error, 'Fallo simulado por script', JSON.stringify({})]);
      console.log('✅ Fallback exitoso. Se insertó la notificación directamente en PostgreSQL.');
    }
  } catch (err) {
    console.error('⚠️ Falló la llamada HTTP:', err.message);
    console.log('🔄 Intentando fallback: Insertando directamente en la base de datos...');
    await db.query(`
      INSERT INTO notificaciones_sistema (profesor_id, tipo_error, mensaje_error, detalle, contexto)
      VALUES ($1, $2, $3, $4, $5)
    `, [profesorId, payload.tipo_error, payload.mensaje_error, 'Fallo simulado por script', JSON.stringify({})]);
    console.log('✅ Fallback exitoso. Se insertó la notificación directamente en PostgreSQL.');
  }

  process.exit(0);
}

simulate().catch(err => {
  console.error(err);
  process.exit(1);
});
