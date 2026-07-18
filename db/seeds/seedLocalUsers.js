import bcrypt from 'bcrypt';
import db from '../../packages/server/src/data/db.js';

const SALT_ROUNDS = 10;

const users = [
  { email: 'admin@canvas.local', nombre: 'Admin Sistema', password: 'password123', rol: 'admin', estudiante_index: null, canvas_user_id: '10000001', canvas_user_uuid: 'a6e2e413-4afb-4b60-90d1-8b0344df3e91' },
  { email: 'profesor@canvas.local', nombre: 'Dr. Elena Ramirez', password: 'password123', rol: 'teacher', estudiante_index: null, canvas_user_id: '10000002', canvas_user_uuid: 'b7f3f524-5bgc-5c71-91e2-9bce55ef4f02' },
  { email: 'estudiante1@canvas.local', nombre: 'Juan Perez', password: 'password123', rol: 'student', estudiante_index: 1, canvas_user_id: '10000003', canvas_user_uuid: 'c8g4g635-6chd-6d82-92f3-acf66fg5g13' },
  { email: 'estudiante2@canvas.local', nombre: 'Maria Garcia', password: 'password123', rol: 'student', estudiante_index: 2, canvas_user_id: '10000004', canvas_user_uuid: 'd9h5h746-7die-7e93-93g4-bdg77hh6h24' },
  { email: 'estudiante3@canvas.local', nombre: 'Pedro Lopez', password: 'password123', rol: 'student', estudiante_index: 3, canvas_user_id: '10000005', canvas_user_uuid: 'e0i6i857-8ejf-8f04-94h5-ceh88ii7i35' },
  { email: 'estudiante4@canvas.local', nombre: 'Ana Torres', password: 'password123', rol: 'student', estudiante_index: 4, canvas_user_id: '10000006', canvas_user_uuid: 'f1j7j968-9fkg-9g15-95i6-dfi99jj8j46' },
  { email: 'estudiante5@canvas.local', nombre: 'Carlos Mendez', password: 'password123', rol: 'student', estudiante_index: 5, canvas_user_id: '10000007', canvas_user_uuid: 'g2k8k079-0ghl-0h26-96j7-egj00kk9k57' },
];

async function seed() {
  console.log('[SEED] Iniciando seed de usuarios locales...');
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    try {
      const res = await db.query(
        `INSERT INTO usuarios_local (email, nombre, password_hash, rol, estudiante_index, canvas_user_id, canvas_user_uuid)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           password_hash = EXCLUDED.password_hash,
           rol = EXCLUDED.rol,
           estudiante_index = EXCLUDED.estudiante_index,
           canvas_user_id = EXCLUDED.canvas_user_id,
           canvas_user_uuid = EXCLUDED.canvas_user_uuid,
           actualizado_en = NOW()
         RETURNING id, email`,
        [user.email, user.nombre, passwordHash, user.rol, user.estudiante_index, user.canvas_user_id, user.canvas_user_uuid]
      );
      console.log(`[SEED] OK: ${user.email} (${user.rol}) -> id=${res.rows[0].id}`);
    } catch (error) {
      console.error(`[SEED] ERROR con ${user.email}:`, error.message);
    }
  }
  console.log('[SEED] Seed completado.');
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[SEED] Error fatal:', err);
    process.exit(1);
  });
