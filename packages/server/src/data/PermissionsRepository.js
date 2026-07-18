import db from './db.js';

export default class PermissionsRepository {
  async getPermissions() {
    const res = await db.query('SELECT rol, permisos FROM Permisos_Rol ORDER BY rol');
    return res.rows;
  }

  async getPermissionsByRole(role) {
    const res = await db.query('SELECT permisos FROM Permisos_Rol WHERE rol = $1', [role]);
    return res.rows[0]?.permisos;
  }

  async updatePermissions(role, permissions) {
    const res = await db.query(
      `INSERT INTO Permisos_Rol (rol, permisos) 
       VALUES ($1, $2) 
       ON CONFLICT (rol) 
       DO UPDATE SET permisos = $2, actualizado_en = NOW() 
       RETURNING *`,
      [role, permissions]
    );
    return res.rows[0];
  }
}
