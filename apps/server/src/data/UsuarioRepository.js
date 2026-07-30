import db from './db.js';

export default class UsuarioRepository {
  async findByEmail(email) {
    const res = await db.query(
      'SELECT id, email, nombre, password_hash, rol, estudiante_index, canvas_user_id, canvas_user_uuid, activo FROM usuarios_local WHERE email = $1',
      [email]
    );
    return res.rows[0] || null;
  }

  async findById(id) {
    const res = await db.query(
      'SELECT id, email, nombre, rol, estudiante_index, canvas_user_id, canvas_user_uuid, activo FROM usuarios_local WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async findByCanvasUserId(canvasUserId) {
    const res = await db.query(
      'SELECT id, email, nombre, rol, estudiante_index, canvas_user_id, canvas_user_uuid, activo FROM usuarios_local WHERE canvas_user_id = $1',
      [canvasUserId]
    );
    return res.rows[0] || null;
  }
}
