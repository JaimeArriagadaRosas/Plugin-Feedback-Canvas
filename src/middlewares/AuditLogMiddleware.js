import db from '../datos/db.js';

export const auditLogMiddleware = async (req, res, next) => {
  const method = req.method;
  
  // Interceptar solo acciones que modifiquen datos
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    // Almacenar el write original
    const originalSend = res.send;
    
    res.send = async function (data) {
      res.send = originalSend;
      
      try {
        const url = req.originalUrl;
        const usuarioId = req.headers['authorization'] ? 'LTI_USER' : 'ANON';
        const accion = `${method} ${url}`;
        const detalle = `Body: ${JSON.stringify(req.body).substring(0, 200)}`;
        
        // Registrar en BD (simulada o real)
        if (db.isMock && db.isMock()) {
          console.log(`[AUDIT MOCK] ${accion} por ${usuarioId}`);
        } else {
          await db.query(
            `INSERT INTO logs_auditoria (usuario_id, accion, detalle) VALUES ($1, $2, $3)`,
            [usuarioId, accion, detalle]
          );
        }
      } catch (err) {
        console.error('Error guardando audit log:', err.message);
      }
      
      return res.send(data);
    };
  }
  
  next();
};
