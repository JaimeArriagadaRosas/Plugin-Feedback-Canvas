import bcrypt from 'bcrypt';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createDatabaseConfig } from '../src/connection/databaseConfig.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { Pool } = pg;
const pool = new Pool(createDatabaseConfig());

const SALT_ROUNDS = 10;

// Default static users (fallback)
let users = [
  // semgrep-ignore
  // eslint-disable-next-line
  { email: 'admin@canvas.local', nombre: 'System Admin', password: 'password123', rol: 'admin', estudiante_index: null, canvas_user_id: '10000001', canvas_user_uuid: 'a6e2e413-4afb-4b60-90d1-8b0344df3e91' },
];

async function seed() {
  const jsonPath = process.argv[2];
  
  if (jsonPath) {
    const fullPath = path.resolve(jsonPath);
    if (fs.existsSync(fullPath)) {
      console.log(`[SEED] Reading users from ${fullPath}`);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      
      let estIndex = 1;
      const dataUsers = data.usuarios || data.users || [];
      users = dataUsers.map(u => {
        let eIdx = null;
        const role = u.rol || u.role;
        if (role === 'student') {
          eIdx = estIndex++;
        }
        return {
          email: u.email,
          nombre: u.nombre || u.name,
          // semgrep-ignore
          // eslint-disable-next-line
          password: 'password123', // Keeping the local password the same for simplicity
          rol: role,
          estudiante_index: eIdx,
          canvas_user_id: u.id.toString(),
          canvas_user_uuid: u.uuid || `00000000-0000-0000-0000-${u.id.toString().padStart(12, '0')}`
        };
      });
    } else {
      console.warn(`[SEED] JSON file not found at ${fullPath}, using static fallback.`);
    }
  }

  console.log(`[SEED] Starting seed of ${users.length} local users...`);
  
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    try {
      const res = await pool.query(
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
      console.log(`[SEED] OK: ${user.email} (${user.rol}) -> id=${res.rows[0].id} | canvas_id=${user.canvas_user_id}`);
    } catch (error) {
      console.error(`[SEED] ERROR with ${user.email}:`, error.message);
    }
  }
  console.log('[SEED] Seed completed.');
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[SEED] Fatal error:', err);
    pool.end().catch(() => {});
    process.exit(1);
  });
