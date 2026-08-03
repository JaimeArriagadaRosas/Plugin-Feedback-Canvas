import { Router } from 'express';
import logger from '../utils/logger.js';
import { requirePermission } from '../authz/requirePermission.js';

export default class SystemNotificationController {
  constructor(systemNotificationService) {
    this.systemNotificationService = systemNotificationService;
  }

  getRouter() {
    const router = Router();
    
    // GET /api/system-notifications/pending
    router.get('/pending', requirePermission('view_feedback'), this.getPending.bind(this));
    
    // POST /api/system-notifications/clear
    router.post('/clear', requirePermission('submit_feedback'), this.clearPending.bind(this));

    // POST /api/system-notifications/simulate (Test only, no auth required to allow external scripts)
    router.post('/simulate', this.simulateError.bind(this));

    return router;
  }

  async getPending(req, res, next) {
    try {
      const profesorId = req.appIdentity?.canonicalUserId || req.user?.id;
      if (!profesorId) {
        return res.json({ exito: true, data: [] });
      }

      const pendingCounts = await this.systemNotificationService.getPendingCounts(profesorId);
      res.json({ exito: true, data: pendingCounts });
    } catch (error) {
      next(error);
    }
  }

  async clearPending(req, res, next) {
    try {
      const profesorId = req.appIdentity?.canonicalUserId || req.user?.id;
      const { tipo_error } = req.body;
      
      if (!profesorId) {
        return res.status(401).json({ exito: false, error: { mensaje: 'No autenticado' } });
      }
      
      if (!tipo_error) {
        return res.status(400).json({ exito: false, error: { mensaje: 'Falta tipo_error' } });
      }

      await this.systemNotificationService.clearPending(profesorId, tipo_error);
      res.json({ exito: true });
    } catch (error) {
      next(error);
    }
  }

  async simulateError(req, res, next) {
    try {
      const { profesor_id, tipo_error, mensaje_error } = req.body;
      if (!profesor_id || !tipo_error) {
        return res.status(400).json({ exito: false, error: { mensaje: 'Faltan parámetros' } });
      }

      // 1. CHOCAR EN CONSOLA: Esto hará que el usuario lo vea en su CMD
      logger.error('💥 [SIMULACIÓN DE FALLO] 💥', {
        event: 'simulated_crash',
        tipo_error,
        profesor_id,
        mensaje_error: mensaje_error || 'Fallo simulado por script'
      });
      console.error(`\n======================================================`);
      console.error(`❌ ERROR CRÍTICO SIMULADO: ${tipo_error}`);
      console.error(`📝 Detalle: ${mensaje_error || 'N/A'}`);
      console.error(`👤 Afectado: Profesor ${profesor_id}`);
      console.error(`======================================================\n`);

      // 2. Insertar en base de datos
      await this.systemNotificationService.saveNotification(profesor_id, tipo_error, mensaje_error || 'Fallo simulado');
      
      res.json({ exito: true, mensaje: 'Error simulado correctamente en el servidor' });
    } catch (error) {
      next(error);
    }
  }
}
