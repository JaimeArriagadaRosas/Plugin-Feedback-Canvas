import 'dotenv/config';
import db from '../src/data/db.js';

async function simulate() {
  console.log('Simulando error: INSUFFICIENT_DATA');
  
  let profesorId = process.env.TEST_PROFESOR_ID;
  if (!profesorId) {
    const tokenRes = await db.query('SELECT canvas_sub FROM canvas_user_tokens ORDER BY actualizado_en DESC LIMIT 1');
    profesorId = tokenRes.rows.length > 0 ? tokenRes.rows[0].canvas_sub : 1;
  }
  console.log(`Usando profesor_id (canvas_sub): ${profesorId}`);
  
  const payload = {
    profesor_id: profesorId,
    tipo_error: 'INSUFFICIENT_DATA',
    mensaje_error: 'El estudiante no ha entregado la asignación y no tiene rúbrica evaluada.'
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
      console.log('Error enviado al servidor con éxito. ¡Revisa la consola de tu servidor Node!');
    } else {
      console.error('El servidor rechazó la simulación:', await res.text());
    }
  } catch (err) {
    console.error('No se pudo conectar con el servidor en https://localhost:3000. ¿Está ejecutándose? Error:', err.message);
  }
  
  process.exit(0);
}

simulate().catch(err => {
  console.error(err);
  process.exit(1);
});
