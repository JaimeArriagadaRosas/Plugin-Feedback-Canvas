import logger from '../utils/logger.js';
import { nowIso } from '../utils/datetime.js';

/**
 * Servicio de Historial Académico
 * Coordina la obtención de datos de Canvas y la persistencia local del historial.
 */
export default class AcademicHistoryService {
  constructor(canvasGateway, studentRepo) {
    this.canvasGateway = canvasGateway;
    this.studentRepo = studentRepo;
  }

  /**
   * Obtiene y procesa el historial de un estudiante en un curso específico.
   * Phase 8 y 9: Descarga submissions reales de Canvas.
   */
  async getStudentAcademicProfile(courseId, studentId, teacherToken = null) {
    // Intentar obtener de cache local primero (si aplica)
    // Para reflejar el historial real y fresco, consultamos a Canvas.
    
    let submissions = [];
    let assignmentsMap = {};
    try {
      submissions = await this.canvasGateway.getStudentSubmissions(courseId, studentId, teacherToken);
      try {
        const assignments = await this.canvasGateway.getAssignments(courseId, teacherToken);
        assignments.forEach(a => {
          assignmentsMap[a.id] = { name: a.name, points_possible: a.points_possible };
        });
      } catch (aErr) {
        logger.warn(`[AcademicHistoryService] No se pudieron obtener las tareas: ${aErr.message}`);
      }
    } catch (err) {
      logger.warn(`[AcademicHistoryService] Could not fetch Canvas submission history: ${err.message}`);
      // Fallback a base de datos si Canvas falla
      const cached = await this.studentRepo.getHistory(studentId, courseId);
      if (cached && cached.length > 0) {
        return {
          history: cached,
          trend: this._calculateTrend(cached),
          source: 'cache'
        };
      }
      return { history: [], trend: 'NONE', source: 'empty' };
    }

    // Filtrar entregas que no tienen score y mapear
    const validHistory = submissions
      .filter(sub => sub.score !== null && sub.score !== undefined)
      .map(sub => {
        const assignmentInfo = assignmentsMap[sub.assignment_id] || {};
        return {
          assignmentId: sub.assignment_id,
          assignmentName: sub.assignment?.name || assignmentInfo.name || `Tarea ${sub.assignment_id}`,
          grade: sub.score,
          pointsPossible: sub.assignment?.points_possible || assignmentInfo.points_possible || 100,
          date: sub.submitted_at || sub.graded_at || nowIso()
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Orden cronológico (más antiguo primero)

    const trend = this._calculateTrend(validHistory);

    // Guardar en BD para caché de lecturas offline
    if (validHistory.length > 0) {
      this.studentRepo.updateHistory(studentId, courseId, validHistory).catch(e => {
         logger.error(`Error guardando historial en caché: ${e.message}`);
      });
    }

    return {
      history: validHistory,
      trend,
      source: 'canvas'
    };
  }

  /**
   * Phase 9: Analiza la trayectoria del estudiante
   * Compara los últimos rendimientos para definir tendencia.
   */
  _calculateTrend(history) {
    if (!history || history.length < 2) return 'NONE';

    // Tomamos las dos últimas calificaciones como base simple de tendencia
    const last = history[history.length - 1];
    const prev = history[history.length - 2];

    // Normalizar a porcentaje
    const lastPct = (last.grade / (last.pointsPossible || 100)) * 100;
    const prevPct = (prev.grade / (prev.pointsPossible || 100)) * 100;

    const diff = lastPct - prevPct;

    if (diff >= 5) return 'UP';
    if (diff <= -5) return 'DOWN';
    return 'FLAT';
  }
}
