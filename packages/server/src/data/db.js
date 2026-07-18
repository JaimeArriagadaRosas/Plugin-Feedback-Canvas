import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { handleDbError } from '../security/dbGuard.js';
import { isLocalModeAllowed, isProduction } from '../security/envGuard.js';
import { getEnv } from '../config/index.js';
import { now } from '../utils/datetime.js';

dotenv.config();

const { Pool } = pg;

let pool = null;

function isLocalMode() {
  return isLocalModeAllowed() || (!process.env.DB_HOST && !isProduction());
}

// El hash se proveerá mediante .env para desarrollo local
const LOCAL_DEV_PASSWORD_HASH = process.env.LOCAL_DEV_PASSWORD_HASH || '';

const localFeedbacks = [
  { id: 1, estudiante_id: 1, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Buen trabajo en la entrega. Presentas una estructura bastante sólida y bien enfocada. Sigue así.", estado: "EDITADO", calificacion_profesor: 4, calificacion_estudiante: null, fecha_generacion: now() },
  { id: 2, estudiante_id: 2, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Muy buen desarrollo, demuestras un dominio sobresaliente de los conceptos de diseño y análisis.", estado: "APROBADO", calificacion_profesor: 5, calificacion_estudiante: null, fecha_generacion: now() },
  { id: 3, estudiante_id: 3, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Se requiere revisión urgente de los temas de arquitectura de software para nivelar el desempeño.", estado: "RECHAZADO", calificacion_profesor: null, calificacion_estudiante: null, fecha_generacion: now() }
];

const localWebhookEvents = [];

const localApiKeys = [];

const localTemplates = [
  { id: 1, nombre: 'Plantilla de Retroalimentación Estándar', contenido: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0 ({{CANVAS_SCORE}} de {{POINTS_POSSIBLE}} puntos en Canvas).\n\n{{TONE_INSTRUCTION}}.\n\nResultados del examen:\n{{QUESTIONS_DETAIL}}\n\nRevisa especialmente los temas donde tuviste dificultades y no dudes en consultar en la próxima clase.\n\nSaludos cordiales,\nProfesor' }
];

const localCourseConfig = [];

const localAssignmentConfig = [];
const localAssignmentVariables = [];

const localUsers = [
  { id: 1, email: 'admin@canvas.local', nombre: 'Admin Sistema', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'admin', estudiante_index: null, canvas_user_id: '10000001', canvas_user_uuid: 'a6e2e413-4afb-4b60-90d1-8b0344df3e91', activo: true },
  { id: 2, email: 'profesor@canvas.local', nombre: 'Dr. Elena Ramirez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'teacher', estudiante_index: null, canvas_user_id: '10000002', canvas_user_uuid: 'b7f3f524-5bac-4c71-91e2-9bce55ef4f02', activo: true },
  { id: 3, email: 'estudiante1@canvas.local', nombre: 'Juan Perez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 1, canvas_user_id: '10000003', canvas_user_uuid: 'c8d4a635-6cad-4d82-92f3-acf66ef5a613', activo: true },
  { id: 4, email: 'estudiante2@canvas.local', nombre: 'Maria Garcia', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 2, canvas_user_id: '10000004', canvas_user_uuid: 'd9e5b746-7dbe-4e93-93a4-bda77be6b824', activo: true },
  { id: 5, email: 'estudiante3@canvas.local', nombre: 'Pedro Lopez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 3, canvas_user_id: '10000005', canvas_user_uuid: 'e0f6c857-8ecf-4f04-94b5-ced88cf7c935', activo: true },
  { id: 6, email: 'estudiante4@canvas.local', nombre: 'Ana Torres', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 4, canvas_user_id: '10000006', canvas_user_uuid: 'f1a7d968-9fda-4a15-95c6-dfe99da8d046', activo: true },
  { id: 7, email: 'estudiante5@canvas.local', nombre: 'Carlos Mendez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 5, canvas_user_id: '10000007', canvas_user_uuid: 'a2b8e079-0aeb-4b26-96d7-efa00eabe157', activo: true },
];

if (!isLocalMode()) {
   try {
     pool = new Pool({
      host: getEnv('DB_HOST'),
      user: getEnv('DB_USER'),
      password: getEnv('DB_PASSWORD'),
      database: getEnv('DB_NAME'),
      port: getEnv('DB_PORT'),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('[DB] Error inesperado en el pool:', { error: err.message });
    });
  } catch (error) {
    logger.warn('[DB] No se pudo inicializar el pool de conexiones.', { error: error.message });
    handleDbError(error, 'pool-init');
    // Nunca fallbackeamos silenciosamente en prod/stage. Si llegó aquí y no lanzó en handleDbError
    // igual no habilitamos isLocalMode para no entrar en un split-brain.
  }
} else {
  logger.info('[DB] Inicializando base de datos en modo LOCAL.');
}

/**
 * Cliente Local para desarrollo sin PostgreSQL.
 *
 * SEC/ARQ (S2.1): antes el dispatch se hacía con `text.includes(...)` sobre el
 * SQL crudo (anti-patrón frágil: un cambio de mayúsculas/espacios rompía la ruta,
 * y permitía nombres de tabla inconsistentes). Ahora se enruta de forma determinista
 * por VERBO (SELECT/INSERT/UPDATE/DELETE) + TABLA, usando un store en memoria real.
 * El comportamiento de negocio se conserva; solo se elimina el acoplamiento al string SQL.
 */
function sqlVerb(text) {
  const m = text.trim().match(/^(SELECT|INSERT|UPDATE|DELETE|TRUNCATE)/i);
  return m ? m[1].toUpperCase() : null;
}
function sqlTable(text) {
  const patterns = [
    /historial_feedback_generado/i,
    /plantilla_feedback/i,
    /historial_academico_local/i,
    /configuracion_curso_tarea/i,
    /llaves_api_ia/i,
    /logs_auditoria/i,
    /notificaciones_feedback/i,
    /webhook_events/i,
    /configuracion_asignacion/i,
    /variables_asignacion/i,
    /configuracion_ia/i,
    /usuarios_local/i,
    /user_lti_mappings/i,
  ];
  for (const p of patterns) {
    if (p.test(text)) {
      const m = text.match(p);
      return m[0].toLowerCase();
    }
  }
  return null;
}

const localDb = {
  query: async (text, params) => {
    logger.debug(`[DB-LOCAL] Ejecutando: ${text.substring(0, 100)}...`);

    const verb = sqlVerb(text);
    const table = sqlTable(text);

    if (verb === 'TRUNCATE') return { rows: [], rowCount: 0 };

    // 1. Plantilla_Feedback
    if (table === 'plantilla_feedback') {
      if (verb === 'SELECT') {
        if (text.includes('WHERE id')) {
          const id = params ? params[0] : null;
          const template = localTemplates.find(t => t.id == id);
          return { rows: template ? [template] : [] };
        }
        return { rows: [...localTemplates] };
      }
      if (verb === 'INSERT') {
        const newTemplate = {
          id: localTemplates.length > 0 ? Math.max(...localTemplates.map(t => t.id)) + 1 : 1,
          nombre: params[0],
          contenido: params[1]
        };
        localTemplates.push(newTemplate);
        return { rows: [newTemplate] };
      }
      if (verb === 'UPDATE') {
        const id = params[params.length - 1];
        const template = localTemplates.find(t => t.id == id);
        if (template) {
          template.nombre = params[0];
          template.contenido = params[1];
          template.actualizado_en = now();
        }
        return { rows: template ? [template] : [] };
      }
      if (verb === 'DELETE') {
        const id = params[0];
        const idx = localTemplates.findIndex(t => t.id == id);
        if (idx >= 0) localTemplates.splice(idx, 1);
        return { rows: [] };
      }
    }

    // 2. Historial académico local (por estudiante)
    if (table === 'historial_academico_local') {
      const studentId = params && params[0]
        ? parseInt(params[0])
        : (text.match(/WHERE estudiante_id\s*=\s*(\d+)/i) || [0, 1])[1];
      const historyMap = {
        1: [{ grade: 9.0, date: '2026-05-01' }, { grade: 8.5, date: '2026-05-05' }, { grade: 9.5, date: '2026-05-15' }],
        2: [{ grade: 5.0, date: '2026-05-01' }, { grade: 6.0, date: '2026-05-05' }, { grade: 5.5, date: '2026-05-15' }],
        3: [{ grade: 3.5, date: '2026-05-01' }, { grade: 4.0, date: '2026-05-05' }, { grade: 3.8, date: '2026-05-15' }],
        4: [{ grade: 8.0, date: '2026-05-01' }, { grade: 8.5, date: '2026-05-05' }, { grade: 8.8, date: '2026-05-15' }],
      };
      return { rows: [{ historial_json: historyMap[studentId] || [{ grade: 5.0, date: '2026-05-01' }] }] };
    }

    // 3. Historial_Feedback_Generado
    if (table === 'historial_feedback_generado') {
      if (verb === 'INSERT') {
        const newFb = {
          id: localFeedbacks.length > 0 ? Math.max(...localFeedbacks.map(f => f.id)) + 1 : 10,
          estudiante_id: params[0],
          curso_id: params[1],
          tarea_id: params[2],
          plantilla_id: params[3],
          contenido_generado: params[4],
          prompt_usado: params[5],
          estado: 'PENDIENTE',
          fecha_generacion: now(),
          nota_canvas: params[6] || null,
          nota_chile: params[7] || null,
          aprobado: params[8] !== undefined ? params[8] : null
        };
        localFeedbacks.unshift(newFb);
        return { rows: [newFb] };
      }
      if (verb === 'SELECT') {
        return { rows: localFeedbacks };
      }
      if (verb === 'UPDATE') {
        if (text.includes('calificacion_profesor')) {
          const fb = localFeedbacks.find(f => f.id == params[1]);
          if (fb) fb.calificacion_profesor = params[0];
          return { rows: [fb] };
        }
        if (text.includes('calificacion_estudiante')) {
          const fb = localFeedbacks.find(f => f.id == params[1]);
          if (fb) fb.calificacion_estudiante = params[0];
          return { rows: [fb] };
        }
        // UPDATE estado/contenido (COALESCE)
        const id = params[params.length - 1];
        const fb = localFeedbacks.find(f => f.id == id);
        if (fb) {
          fb.estado = params[0];
          if (params[1] !== undefined && params[1] !== null) fb.contenido_generado = params[1];
        }
        return { rows: fb ? [fb] : [] };
      }
    }

    // 4. Configuracion_Curso_Tarea
    if (table === 'configuracion_curso_tarea') {
      const contextoTipo = params && params[0];
      const contextoId = params && params[1];
      if (verb === 'SELECT' && text.includes('WHERE')) {
        const row = localCourseConfig.find(c => c.contexto_tipo === contextoTipo && c.contexto_id === String(contextoId));
        return { rows: row ? [{ config_json: row.config_json }] : [] };
      }
      if (verb === 'INSERT') {
        const newConfig = { id: localCourseConfig.length + 1, contexto_tipo: contextoTipo, contexto_id: String(contextoId), config_json: params[2], actualizado_en: now() };
        localCourseConfig.push(newConfig);
        return { rows: [{ config_json: newConfig.config_json }] };
      }
      if (verb === 'UPDATE') {
        const existing = localCourseConfig.find(c => c.contexto_tipo === contextoTipo && c.contexto_id === String(contextoId));
        if (existing) {
          existing.config_json = params[0];
          existing.actualizado_en = now();
        }
        return { rows: existing ? [{ config_json: existing.config_json }] : [] };
      }
    }

    // 5. Llaves_API_IA
    if (table === 'llaves_api_ia') {
      if (verb === 'SELECT') {
        const requestedService = params && params[0] ? String(params[0]).toLowerCase() : null;
        const matched = text.includes('activo = TRUE')
          ? localApiKeys.filter(k => k.activo && (!requestedService || k.servicio === requestedService))
          : localApiKeys.filter(k => !requestedService || k.servicio === requestedService);
        return { rows: matched };
      }
      if (verb === 'INSERT') {
        const newKey = {
          id: localApiKeys.length > 0 ? Math.max(...localApiKeys.map(k => k.id)) + 1 : 1,
          servicio: params[0],
          api_key_encriptada: params[1],
          activo: true
        };
        localApiKeys.push(newKey);
        return { rows: [newKey] };
      }
      if (verb === 'UPDATE') {
        const idx = localApiKeys.findIndex(k => k.servicio === params[0]);
        if (idx >= 0) {
          localApiKeys[idx].api_key_encriptada = params[1];
          localApiKeys[idx].activo = true;
          return { rows: [localApiKeys[idx]] };
        }
        return { rows: [] };
      }
      return { rows: [] };
    }

    // 6. Logs_Auditoria
    if (table === 'logs_auditoria') {
      if (verb === 'INSERT') return { rows: [{ id: Date.now() }] };
      return { rows: [] };
    }

    // 7. Notificaciones_Feedback
    if (table === 'notificaciones_feedback') {
      if (verb === 'INSERT') return { rows: [{ id: Date.now() }] };
      return { rows: [] };
    }

    // 8. webhook_events
    if (table === 'webhook_events') {
      if (verb === 'SELECT' && text.includes('WHERE event_hash')) {
        const hash = params && params[0];
        const exists = localWebhookEvents.some(ev => ev.event_hash === hash);
        return { rows: exists ? [{ event_hash: hash }] : [] };
      }
      if (verb === 'INSERT') {
        const newEvent = {
          event_hash: params[0],
          event_type: params[1] || null,
          processed_at: now()
        };
        localWebhookEvents.push(newEvent);
        return { rows: [newEvent] };
      }
      if (verb === 'DELETE') {
        const hash = params && params[0];
        const idx = localWebhookEvents.findIndex(ev => ev.event_hash === hash);
        if (idx >= 0) localWebhookEvents.splice(idx, 1);
        return { rows: [] };
      }
      return { rows: [] };
    }

    // 9. configuracion_asignacion / variables_asignacion
    if (table === 'configuracion_asignacion') {
      if (verb === 'SELECT') {
        if (text.includes('WHERE canvas_course_id') && text.includes('canvas_assignment_id')) {
          const courseId = String(params[0]);
          const assignmentId = String(params[1]);
          const row = localAssignmentConfig.find(c => c.canvas_course_id === courseId && c.canvas_assignment_id === assignmentId);
          return { rows: row ? [row] : [] };
        }
        return { rows: [...localAssignmentConfig] };
      }
      if (verb === 'INSERT') {
        const newConfig = {
          id_configuracion: localAssignmentConfig.length > 0 ? Math.max(...localAssignmentConfig.map(c => c.id_configuracion)) + 1 : 1,
          canvas_course_id: String(params[0]),
          canvas_assignment_id: String(params[1]),
          feedback_activo: params[2],
          plantilla_id: params[3],
          profesor_id: params[4],
          fecha_modificacion: now()
        };
        const existing = localAssignmentConfig.find(c => c.canvas_course_id === newConfig.canvas_course_id && c.canvas_assignment_id === newConfig.canvas_assignment_id);
        if (existing) {
          Object.assign(existing, newConfig);
          return { rows: [existing] };
        }
        localAssignmentConfig.push(newConfig);
        return { rows: [newConfig] };
      }
      if (verb === 'UPDATE') {
        const courseId = String(params[0]);
        const assignmentId = String(params[1]);
        const existing = localAssignmentConfig.find(c => c.canvas_course_id === courseId && c.canvas_assignment_id === assignmentId);
        if (existing) {
          if (params[2] !== undefined) existing.feedback_activo = params[2];
          if (params[3] !== undefined) existing.plantilla_id = params[3];
          if (params[4] !== undefined) existing.profesor_id = params[4];
          existing.fecha_modificacion = now();
          return { rows: [existing] };
        }
        return { rows: [] };
      }
      if (verb === 'DELETE') {
        const courseId = String(params[0]);
        const assignmentId = String(params[1]);
        const idx = localAssignmentConfig.findIndex(c => c.canvas_course_id === courseId && c.canvas_assignment_id === assignmentId);
        if (idx >= 0) localAssignmentConfig.splice(idx, 1);
        return { rows: [] };
      }
    }
    if (table === 'variables_asignacion') {
      if (verb === 'SELECT') {
        if (text.includes('WHERE configuracion_id')) {
          const configId = params[0];
          const vars = localAssignmentVariables.filter(v => v.configuracion_id == configId);
          return { rows: vars };
        }
        return { rows: [...localAssignmentVariables] };
      }
      if (verb === 'INSERT') {
        const newVar = {
          id: localAssignmentVariables.length > 0 ? Math.max(...localAssignmentVariables.map(v => v.id)) + 1 : 1,
          configuracion_id: params[0],
          variable_id: params[1],
          variable_activa: params[2],
          ponderacion: params[3]
        };
        localAssignmentVariables.push(newVar);
        return { rows: [newVar] };
      }
      if (verb === 'DELETE') {
        if (text.includes('WHERE configuracion_id')) {
          const configId = params[0];
          for (let i = localAssignmentVariables.length - 1; i >= 0; i--) {
            if (localAssignmentVariables[i].configuracion_id == configId) {
              localAssignmentVariables.splice(i, 1);
            }
          }
        }
        return { rows: [] };
      }
    }

    // 10. Configuracion_IA
    if (table === 'configuracion_ia') {
      if (verb === 'SELECT') {
        return { rows: [{ id: 1, modelo_preferido: 'gemini-1.5-flash', prompt_base: 'Eres un asistente de feedback...', temperatura: 0.7, longitud_maxima: 2048, endpoint_api: null }] };
      }
      return { rows: [{ id: 1, modelo_preferido: params[0] || 'gemini-1.5-flash', prompt_base: params[1] || 'Nuevo prompt', temperatura: params[2], longitud_maxima: params[3], endpoint_api: params[4] }] };
    }

    // 11. usuarios_local
    if (table === 'usuarios_local') {
      if (verb === 'SELECT') {
        if (text.includes('WHERE email')) {
          const email = params && params[0];
          const user = localUsers.find(u => u.email === email);
          return { rows: user ? [user] : [] };
        }
        if (text.includes('WHERE id')) {
          const id = params && params[0];
          const user = localUsers.find(u => String(u.id) === String(id));
          return { rows: user ? [user] : [] };
        }
        if (text.includes('WHERE canvas_user_id')) {
          const canvasUserId = params && params[0];
          const user = localUsers.find(u => u.canvas_user_id === canvasUserId);
          return { rows: user ? [user] : [] };
        }
        return { rows: [] };
      }
      if (verb === 'INSERT') {
        const newUser = {
          id: localUsers.length > 0 ? Math.max(...localUsers.map(u => u.id)) + 1 : 1,
          email: params[0],
          nombre: params[1],
          password_hash: params[2],
          rol: params[3],
          estudiante_index: params[4],
          canvas_user_id: params[5],
          canvas_user_uuid: params[6],
          activo: params[7] !== false,
          creado_en: now(),
          actualizado_en: now()
        };
        const exists = localUsers.find(u => u.email === newUser.email);
        if (exists) {
          Object.assign(exists, newUser);
        } else {
          localUsers.push(newUser);
        }
        return { rows: [newUser] };
      }
      if (verb === 'UPDATE') {
        if (text.includes('WHERE email')) {
          const email = params[0];
          const user = localUsers.find(u => u.email === email);
          if (user) {
            user.nombre = params[1];
            user.password_hash = params[2];
            user.rol = params[3];
            user.estudiante_index = params[4];
            user.canvas_user_id = params[5];
            user.canvas_user_uuid = params[6];
            user.activo = params[7] !== false;
            user.actualizado_en = now();
          }
          return { rows: user ? [user] : [] };
        }
        if (text.includes('WHERE id')) {
          const id = params[params.length - 1];
          const user = localUsers.find(u => String(u.id) === String(id));
          if (user) {
            user.nombre = params[0];
            user.password_hash = params[1];
            user.rol = params[2];
            user.estudiante_index = params[3];
            user.canvas_user_id = params[4];
            user.canvas_user_uuid = params[5];
            user.activo = params[6] !== false;
            user.actualizado_en = now();
          }
          return { rows: user ? [user] : [] };
        }
      }
      if (verb === 'DELETE') {
        if (text.includes('WHERE email')) {
          const email = params[0];
          const idx = localUsers.findIndex(u => u.email === email);
          if (idx >= 0) localUsers.splice(idx, 1);
          return { rows: [] };
        }
        if (text.includes('WHERE id')) {
          const id = params[0];
          const idx = localUsers.findIndex(u => String(u.id) === String(id));
          if (idx >= 0) localUsers.splice(idx, 1);
          return { rows: [] };
        }
      }
      return { rows: [] };
    }

    // 12. user_lti_mappings
    if (table === 'user_lti_mappings') {
      if (verb === 'INSERT') {
        return { rows: [{ id: Date.now(), local_user_id: params[0], canvas_sub: params[1], canvas_uuid: params[2], deployment_id: params[3], issuer: params[4] }] };
      }
      if (verb === 'SELECT') {
        return { rows: [] };
      }
      return { rows: [] };
    }

    return { rows: [], rowCount: 0 };
  }
};

export default {
  query: async (text, params) => {
    if (isLocalMode()) return localDb.query(text, params);
    try {
      return await pool.query(text, params);
    } catch (error) {
      handleDbError(error, 'query');
      throw error;
    }
  },
  get pool() {
    return pool;
  },
  isLocalMode: () => isLocalMode(),
  executeTransaction: async (callback) => {
    if (isLocalMode()) {
      // En modo local, solo ejecutamos el callback con un cliente simulado
      const mockClient = { query: (text, params) => localDb.query(text, params) };
      return await callback(mockClient);
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      handleDbError(e, 'transaction');
      throw e;
    } finally {
      client.release();
    }
  }
};
