import 'dotenv/config';
import db from '../src/data/db.js';

async function simulate() {
  console.log('Simulating error: INSUFFICIENT_DATA');
  
  let profesorId = process.env.TEST_PROFESOR_ID;
  if (!profesorId) {
    const tokenRes = await db.query('SELECT canvas_sub FROM canvas_user_tokens ORDER BY actualizado_en DESC LIMIT 1');
    profesorId = tokenRes.rows.length > 0 ? tokenRes.rows[0].canvas_sub : 1;
  }
  console.log(`Using profesor_id (canvas_sub): ${profesorId}`);
  
  const payload = {
    profesor_id: profesorId,
    tipo_error: 'INSUFFICIENT_DATA',
    mensaje_error: 'The student has not submitted the assignment and has no evaluated rubric.'
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
      console.log('Error sent to the server successfully. Check your Node server console!');
    } else {
      console.error('The server rejected the simulation:', await res.text());
    }
  } catch (err) {
    console.error('Could not connect to the server at https://localhost:3000. Is it running? Error:', err.message);
  }
  
  process.exit(0);
}

simulate().catch(err => {
  console.error(err);
  process.exit(1);
});
